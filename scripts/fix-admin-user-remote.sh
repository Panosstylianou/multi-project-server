#!/bin/bash
# Fix admin user for a PocketBase database on AWS
# Usage: ./scripts/fix-admin-user-remote.sh <domain> <email> <password> [container-name]

set -e

DOMAIN="${1:-api.db.oceannet.dev}"
EMAIL="${2:-hello@oceannet.dev}"
PASSWORD="${3:-BetterMapRules8}"
CONTAINER="${4:-}"

# AWS connection details
PROD_HOST="${AWS_HOST:-13.135.181.201}"
PROD_USER="${AWS_USER:-ec2-user}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/bettermap-key.pem}"

# If container not provided, infer from domain
if [ -z "$CONTAINER" ]; then
  # Extract subdomain from domain (e.g., "api" from "api.db.oceannet.dev")
  SUBDOMAIN=$(echo "$DOMAIN" | cut -d'.' -f1)
  CONTAINER="pocketbase-${SUBDOMAIN}"
fi

echo "🔧 Fixing admin user for database on AWS: $DOMAIN"
echo "   Host: $PROD_HOST"
echo "   Container: $CONTAINER"
echo "   Email: $EMAIL"
echo ""

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
  echo "❌ SSH key not found: $SSH_KEY"
  echo "   Set SSH_KEY environment variable or place key at ~/.ssh/bettermap-key.pem"
  exit 1
fi

# Test SSH connection
echo "🔌 Testing SSH connection..."
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROD_USER@$PROD_HOST" 'exit' 2>/dev/null; then
  echo "❌ Cannot connect to AWS server via SSH"
  echo "   Host: $PROD_HOST"
  echo "   User: $PROD_USER"
  echo "   Key: $SSH_KEY"
  exit 1
fi
echo "✅ SSH connection successful"

# Check if container exists
echo ""
echo "📦 Checking container..."
if ! ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker ps -a --format '{{.Names}}' | grep -q '^${CONTAINER}$'" 2>/dev/null; then
  echo "❌ Container '$CONTAINER' not found on AWS server!"
  echo ""
  echo "Available containers:"
  ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker ps -a --format '  {{.Names}}' | grep pocketbase || echo '  (none found)'"
  exit 1
fi
echo "✅ Container found: $CONTAINER"

# Check if container is running
echo ""
echo "🔄 Checking container status..."
CONTAINER_STATUS=$(ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker ps --format '{{.Names}}' | grep -q '^${CONTAINER}$' && echo 'running' || echo 'stopped'")

if [ "$CONTAINER_STATUS" != "running" ]; then
  echo "⚠️  Container is not running. Starting it..."
  ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker start $CONTAINER"
  echo "   Waiting for PocketBase to start..."
  sleep 5
fi
echo "✅ Container is running"

# Create admin user
echo ""
echo "📝 Creating admin user..."
if ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker exec $CONTAINER /usr/local/bin/pocketbase superuser upsert '$EMAIL' '$PASSWORD'" 2>&1; then
  echo ""
  echo "✅ Admin user created successfully!"
  echo ""
  echo "   Email:    $EMAIL"
  echo "   Domain:   $DOMAIN"
  echo "   Admin:    https://$DOMAIN/_/"
  echo ""
  echo "You can now login to the admin panel with these credentials."
else
  echo ""
  echo "❌ Failed to create admin user"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check if container is running: ssh -i $SSH_KEY $PROD_USER@$PROD_HOST 'docker ps | grep $CONTAINER'"
  echo "  2. Check container logs: ssh -i $SSH_KEY $PROD_USER@$PROD_HOST 'docker logs $CONTAINER'"
  exit 1
fi
