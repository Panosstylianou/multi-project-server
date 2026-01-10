# Deployment Guide

This guide covers deploying the PocketBase Multi-Project Server to AWS.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured (`aws configure`)
3. **Terraform** >= 1.0 installed
4. **Domain name** (recommended for production)
5. **SSH key pair** created in AWS EC2

## Step 1: Prepare Configuration

### 1.1 Create terraform.tfvars

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
# AWS Configuration
aws_region  = "us-east-1"  # Choose your region
environment = "prod"

# Security - IMPORTANT: Replace with your IP!
allowed_ssh_cidrs = ["YOUR_PUBLIC_IP/32"]
allowed_api_cidrs = ["0.0.0.0/0"]  # Or restrict as needed

# EC2 Configuration
instance_type    = "t3.small"  # Adjust based on expected load
key_pair_name    = "your-existing-keypair"  # Must exist in AWS
data_volume_size = 50  # GB, increase for more storage

# Domain - Required for SSL
domain = "pocketbase.youragency.com"

# Optional: If using Route53
route53_zone_id = "Z1234567890ABC"

# Application Configuration
api_key     = "generate-a-strong-random-key-here"
admin_email = "admin@youragency.com"
acme_email  = "ssl@youragency.com"
```

### 1.2 Generate a Strong API Key

```bash
# On macOS/Linux
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 2: Deploy Infrastructure

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview the changes
terraform plan

# Apply the configuration
terraform apply
```

Note the outputs:
- `server_public_ip` - Your server's IP address
- `manager_url` - URL for the management interface
- `s3_backup_bucket` - S3 bucket for backups
- `ssh_command` - Command to SSH into the server

## Step 3: Configure DNS

### Option A: Using Route53 (Automatic)

If you set `route53_zone_id`, DNS records are created automatically.

### Option B: Manual DNS Configuration

Add these records to your DNS provider:

```
Type: A
Name: pocketbase.youragency.com
Value: <server_public_ip>

Type: A
Name: *.pocketbase.youragency.com
Value: <server_public_ip>
```

## Step 4: Verify Deployment

### 4.1 Check Server Status

```bash
# SSH into the server
ssh -i your-keypair.pem ec2-user@<server_public_ip>

# Check Docker containers
docker ps

# View logs
docker logs pocketbase-manager
docker logs traefik
```

### 4.2 Test the API

```bash
# Health check
curl https://manager.pocketbase.youragency.com/api/health

# List projects (should be empty)
curl -H "x-api-key: your-api-key" \
  https://manager.pocketbase.youragency.com/api/projects
```

### 4.3 Create Test Project

```bash
curl -X POST https://manager.pocketbase.youragency.com/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "name": "Test Project",
    "slug": "test"
  }'
```

Visit `https://test.pocketbase.youragency.com/_/` to access PocketBase admin.

## Step 5: Set Up CI/CD

### 5.1 Configure GitHub Secrets

Go to your repository Settings → Secrets and Variables → Actions:

**Secrets:**
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- `API_KEY` - Your PocketBase manager API key

**Variables:**
- `AWS_REGION` - e.g., `us-east-1`
- `AWS_KEY_PAIR_NAME` - Your key pair name
- `DOMAIN` - e.g., `pocketbase.youragency.com`
- `ADMIN_EMAIL` - Admin email
- `ACME_EMAIL` - Let's Encrypt email
- `PRODUCTION_INSTANCE_ID` - EC2 instance ID (from Terraform output)

### 5.2 Deploy Updates

Push to `main` branch or create a version tag:

```bash
# Manual deployment
git push origin main

# Release with version tag
git tag v1.0.0
git push origin v1.0.0
```

## Scaling Considerations

### Vertical Scaling

For more clients, increase instance size:

```hcl
# terraform.tfvars
instance_type = "t3.medium"  # or t3.large, etc.
```

Run `terraform apply` to apply changes.

### Storage Scaling

Increase EBS volume:

```hcl
# terraform.tfvars
data_volume_size = 100  # GB
```

Note: This requires manual filesystem expansion after `terraform apply`.

### Recommended Instance Sizes

| Clients | Instance Type | Memory | Est. Cost |
|---------|---------------|--------|-----------|
| 1-10 | t3.small | 2 GB | $15/month |
| 10-25 | t3.medium | 4 GB | $30/month |
| 25-50 | t3.large | 8 GB | $60/month |
| 50+ | Consider multiple servers or ECS |

## Backup and Recovery

### Automatic Backups

Backups run daily at 3 AM UTC:
- Local backups: `/opt/pocketbase-manager/backups/`
- S3 backups: `s3://your-bucket/full-backups/`

### Manual Backup

```bash
# SSH into server
ssh -i keypair.pem ec2-user@<ip>

# Run backup script
/opt/pocketbase-manager/backup.sh
```

### Restore from Backup

```bash
# List available backups
aws s3 ls s3://your-bucket/full-backups/

# Download backup
aws s3 cp s3://your-bucket/full-backups/full-backup-20240101_030000.tar.gz .

# Stop services
cd /opt/pocketbase-manager
docker compose down

# Extract backup
tar -xzf full-backup-*.tar.gz -C /opt/pocketbase-manager/

# Start services
docker compose up -d
```

## Monitoring

### CloudWatch Metrics

The EC2 instance sends basic metrics to CloudWatch:
- CPU Utilization
- Network In/Out
- Disk Read/Write

### Application Logs

```bash
# View manager logs
docker logs -f pocketbase-manager

# View Traefik logs
docker logs -f traefik

# View specific project logs
docker logs -f pocketbase-<project-slug>
```

### Health Check Endpoint

Set up CloudWatch or external monitoring to check:
```
https://manager.pocketbase.youragency.com/api/health
```

## Troubleshooting

### Common Issues

**SSL Certificate Issues:**
```bash
# Check Traefik logs
docker logs traefik | grep -i cert

# Ensure DNS is propagated
dig pocketbase.youragency.com

# Force certificate renewal
docker exec traefik rm /letsencrypt/acme.json
docker restart traefik
```

**Container Won't Start:**
```bash
# Check Docker daemon
systemctl status docker

# Check system resources
free -h
df -h

# View container logs
docker logs pocketbase-manager
```

**Can't Connect to API:**
```bash
# Check security group
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Check if port is listening
ss -tlnp | grep 3000

# Test locally first
curl http://localhost:3000/api/health
```

### Getting Help

1. Check logs: `docker logs <container-name>`
2. Check user-data script output: `cat /var/log/user-data.log`
3. Review Terraform outputs: `terraform output`
4. Check CloudWatch logs (if enabled)

