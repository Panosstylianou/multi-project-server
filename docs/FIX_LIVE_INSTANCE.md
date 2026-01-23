# Fix Live Instance Guide

## Problem

The live site at https://manager.db.oceannet.dev/ is not responding after updating credentials.

## Root Cause

The `docker-compose.prod.yml` file on the live instance was using environment variable substitution (`${BASE_DOMAIN}`) but wasn't properly loading the `.env` file. Docker Compose needs either:
1. `env_file: - .env` directive, OR
2. Variables exported before running docker-compose

## Solution

### Option 1: Quick Fix (Recommended)

Run the fix script to update the docker-compose file and restart containers:

```bash
./scripts/fix-live-instance.sh
```

This script will:
1. Stop all containers
2. Update `docker-compose.prod.yml` to use `env_file: - .env`
3. Restart containers
4. Verify everything is working

### Option 2: Manual Fix via SSH

```bash
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201

cd /opt/pocketbase-manager

# Backup existing file
cp docker-compose.prod.yml docker-compose.prod.yml.backup

# Update to use env_file
# Remove hardcoded environment variables
sed -i '/BASE_DOMAIN=/d' docker-compose.prod.yml
sed -i '/USE_HTTPS=/d' docker-compose.prod.yml
sed -i '/API_KEY=/d' docker-compose.prod.yml
sed -i '/ADMIN_EMAIL=/d' docker-compose.prod.yml
sed -i '/ADMIN_PASSWORD=/d' docker-compose.prod.yml

# Add env_file directive (after container_name line)
sed -i '/container_name: pocketbase-manager/a\
    env_file:\
      - .env' docker-compose.prod.yml

# Restart containers
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Verify
docker ps
docker logs pocketbase-manager --tail 20
```

### Option 3: Full Rebuild

If the quick fix doesn't work, push changes and rebuild:

```bash
# Commit and push changes
git add .
git commit -m "Fix docker-compose to use env_file for environment variables"
git push origin main

# The GitHub Actions workflow will automatically rebuild
# Or trigger manually via GitHub Actions UI
```

## Verification

After fixing, verify the site is working:

```bash
# Check health endpoint
curl https://manager.db.oceannet.dev/api/health

# Should return: {"status":"ok",...}

# Check containers are running
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201 \
  "docker ps | grep -E 'pocketbase|traefik'"

# Check logs
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201 \
  "docker logs pocketbase-manager --tail 50"
```

## Expected docker-compose.prod.yml Structure

After the fix, the manager service should look like:

```yaml
services:
  manager:
    image: pocketbase-manager:latest
    container_name: pocketbase-manager
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
      - DOCKER_SOCKET=/var/run/docker.sock
      - POCKETBASE_IMAGE=ghcr.io/muchobien/pocketbase:latest
      - POCKETBASE_NETWORK=pocketbase-network
      - DATA_DIR=/app/data
      - BACKUPS_DIR=/app/backups
    # ... rest of config
```

The `env_file: - .env` directive will automatically load all variables from the `.env` file.
