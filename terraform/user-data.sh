#!/bin/bash
set -e

# Log all output
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting user-data script at $(date)"

# Update system
dnf update -y

# Install Docker
dnf install -y docker git

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -aG docker ec2-user

# Install Docker Compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Create application directory
mkdir -p /opt/pocketbase-manager
cd /opt/pocketbase-manager

# Wait for EBS volume to be attached
echo "Waiting for EBS volume..."
while [ ! -e /dev/sdf ] && [ ! -e /dev/xvdf ]; do
  sleep 5
done

# Determine device name
if [ -e /dev/xvdf ]; then
  DEVICE=/dev/xvdf
else
  DEVICE=/dev/sdf
fi

# Format and mount EBS volume if new
if ! file -s $DEVICE | grep -q filesystem; then
  echo "Formatting EBS volume..."
  mkfs -t ext4 $DEVICE
fi

# Create mount point and mount
mkdir -p /opt/pocketbase-manager/data
mkdir -p /opt/pocketbase-manager/backups

# Add to fstab if not already there
if ! grep -q "/opt/pocketbase-manager/data" /etc/fstab; then
  echo "$DEVICE /opt/pocketbase-manager/data ext4 defaults,nofail 0 2" >> /etc/fstab
fi

mount -a

# Set proper permissions
chown -R 1000:1000 /opt/pocketbase-manager/data
chown -R 1000:1000 /opt/pocketbase-manager/backups

# Create environment file
cat > /opt/pocketbase-manager/.env << 'EOF'
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Docker settings
DOCKER_SOCKET=/var/run/docker.sock
POCKETBASE_IMAGE=ghcr.io/muchobien/pocketbase:latest
POCKETBASE_NETWORK=pocketbase-network

# Storage
DATA_DIR=/opt/pocketbase-manager/data
BACKUPS_DIR=/opt/pocketbase-manager/backups

# Domain
BASE_DOMAIN=${domain}
USE_HTTPS=true

# AWS
AWS_REGION=${aws_region}
S3_BACKUP_BUCKET=${s3_bucket}

# Security
API_KEY=${api_key}
ADMIN_EMAIL=${admin_email}

# SSL
ACME_EMAIL=${acme_email}
TRAEFIK_INSECURE=false
EOF

# Create docker-compose.yml
cat > /opt/pocketbase-manager/docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  manager:
    image: ghcr.io/YOUR_ORG/pocketbase-manager:latest
    container_name: pocketbase-manager
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
      - DOCKER_SOCKET=/var/run/docker.sock
      - POCKETBASE_IMAGE=ghcr.io/muchobien/pocketbase:latest
      - POCKETBASE_NETWORK=pocketbase-network
      - DATA_DIR=/app/data
      - BACKUPS_DIR=/app/backups
      - BASE_DOMAIN=$${BASE_DOMAIN}
      - USE_HTTPS=$${USE_HTTPS}
      - API_KEY=$${API_KEY}
      - ADMIN_EMAIL=$${ADMIN_EMAIL}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /opt/pocketbase-manager/data:/app/data
      - /opt/pocketbase-manager/backups:/app/backups
    networks:
      - pocketbase-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.manager.rule=Host(`manager.$${BASE_DOMAIN}`)"
      - "traefik.http.routers.manager.entrypoints=websecure"
      - "traefik.http.routers.manager.tls=true"
      - "traefik.http.routers.manager.tls.certresolver=letsencrypt"
      - "traefik.http.services.manager.loadbalancer.server.port=3000"

  traefik:
    image: traefik:v2.11
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=pocketbase-network"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=$${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--log.level=INFO"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt
    networks:
      - pocketbase-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.$${BASE_DOMAIN}`)"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.tls=true"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik.service=api@internal"

networks:
  pocketbase-network:
    name: pocketbase-network
    driver: bridge

volumes:
  traefik-certs:
    name: traefik-certs
COMPOSE_EOF

# Pull images
docker compose pull || true

# Start services
docker compose up -d

# Create systemd service for auto-start
cat > /etc/systemd/system/pocketbase-manager.service << 'SERVICE_EOF'
[Unit]
Description=PocketBase Manager
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/pocketbase-manager
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose down

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable pocketbase-manager

# Set up automatic backup cron
cat > /etc/cron.d/pocketbase-backup << 'CRON_EOF'
# Daily backup at 3 AM
0 3 * * * root /opt/pocketbase-manager/backup.sh >> /var/log/pocketbase-backup.log 2>&1
CRON_EOF

# Create backup script
cat > /opt/pocketbase-manager/backup.sh << 'BACKUP_EOF'
#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/pocketbase-manager/backups"
S3_BUCKET="${s3_bucket}"

# Create backup archive
cd /opt/pocketbase-manager
tar -czf "$BACKUP_DIR/full-backup-$TIMESTAMP.tar.gz" data/

# Upload to S3
aws s3 cp "$BACKUP_DIR/full-backup-$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/full-backups/"

# Keep only last 7 local backups
ls -t $BACKUP_DIR/full-backup-*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed: full-backup-$TIMESTAMP.tar.gz"
BACKUP_EOF

chmod +x /opt/pocketbase-manager/backup.sh

echo "User-data script completed at $(date)"

