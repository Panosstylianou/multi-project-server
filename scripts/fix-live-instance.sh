#!/bin/bash
# Fix the live instance - restart containers and verify everything is working
# Usage: ./scripts/fix-live-instance.sh

set -e

INSTANCE_ID="${1:-i-0eeb2f36b052f1228}"

echo "🔧 Fixing live instance..."
echo "   Instance ID: $INSTANCE_ID"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS CLI not configured. Please run 'aws configure' first."
  exit 1
fi

echo "📝 Sending fix command via SSM..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Fix live instance - restart containers" \
  --parameters "commands=[
    \"cd /opt/pocketbase-manager\",
    \"echo '=== Current Status ==='\",
    \"docker ps -a | grep -E 'pocketbase|traefik' || echo 'No containers found'\",
    \"echo ''\",
    \"echo '=== Stopping all containers ==='\",
    \"docker compose -f docker-compose.prod.yml down --remove-orphans || true\",
    \"docker rm -f pocketbase-manager traefik 2>/dev/null || true\",
    \"echo ''\",
    \"echo '=== Checking .env file ==='\",
    \"cat .env | grep -E 'ADMIN_EMAIL|ADMIN_PASSWORD|BASE_DOMAIN' || echo 'Missing env vars'\",
    \"echo ''\",
    \"echo '=== Updating docker-compose.prod.yml to use env_file ==='\",
    \"# Backup existing file\",
    \"cp docker-compose.prod.yml docker-compose.prod.yml.backup\",
    \"# Update to use env_file instead of hardcoded variables\",
    \"sed -i 's|^      - BASE_DOMAIN=.*||' docker-compose.prod.yml\",
    \"sed -i 's|^      - USE_HTTPS=.*||' docker-compose.prod.yml\",
    \"sed -i 's|^      - API_KEY=.*||' docker-compose.prod.yml\",
    \"sed -i 's|^      - ADMIN_EMAIL=.*||' docker-compose.prod.yml\",
    \"sed -i 's|^      - ADMIN_PASSWORD=.*||' docker-compose.prod.yml\",
    \"# Add env_file if not present\",
    \"if ! grep -q 'env_file:' docker-compose.prod.yml; then\",
    \"  sed -i '/container_name: pocketbase-manager/a\\    env_file:\\n      - .env' docker-compose.prod.yml\",
    \"fi\",
    \"echo 'docker-compose.prod.yml updated'\",
    \"echo ''\",
    \"echo '=== Loading environment variables ==='\",
    \"export \$(cat .env | grep -v '^#' | xargs)\",
    \"echo 'BASE_DOMAIN='\$BASE_DOMAIN\",
    \"echo 'ADMIN_EMAIL='\$ADMIN_EMAIL\",
    \"echo ''\",
    \"echo '=== Starting containers ==='\",
    \"docker compose -f docker-compose.prod.yml up -d\",
    \"echo ''\",
    \"echo '=== Waiting for containers to start ==='\",
    \"sleep 10\",
    \"echo ''\",
    \"echo '=== Container Status ==='\",
    \"docker ps | grep -E 'pocketbase|traefik'\",
    \"echo ''\",
    \"echo '=== Checking container logs ==='\",
    \"docker logs pocketbase-manager --tail 20 2>&1 || echo 'Container not running'\",
    \"echo ''\",
    \"echo '=== Checking Traefik logs ==='\",
    \"docker logs traefik --tail 10 2>&1 || echo 'Traefik not running'\",
    \"echo ''\",
    \"echo '=== Verifying environment variables in container ==='\",
    \"docker exec pocketbase-manager env | grep -E 'ADMIN|BASE_DOMAIN' || echo 'Container not ready'\",
    \"echo ''\",
    \"echo '✅ Fix complete!'\"
  ]" \
  --output text \
  --query 'Command.CommandId')

if [ -z "$COMMAND_ID" ]; then
  echo "❌ Failed to send command"
  exit 1
fi

echo "✅ Command sent. Command ID: $COMMAND_ID"
echo ""
echo "⏳ Waiting for command to complete..."

# Poll for command completion
MAX_ATTEMPTS=30
ATTEMPT=0
STATUS="InProgress"

while [ "$STATUS" = "InProgress" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  sleep 3
  ATTEMPT=$((ATTEMPT + 1))
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query 'Status' \
    --output text 2>/dev/null || echo "InProgress")
  
  if [ "$STATUS" != "InProgress" ]; then
    break
  fi
  
  echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS - Status: $STATUS"
done

echo ""
echo "📋 Command output:"
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query 'StandardOutputContent' \
  --output text

echo ""
echo "📋 Error output (if any):"
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query 'StandardErrorContent' \
  --output text

echo ""
echo "✅ Fix complete!"
echo ""
echo "💡 Check the site: https://manager.db.oceannet.dev/"
