#!/bin/bash
# Rebuild Docker image on live instance to get latest dashboard
# Usage: ./scripts/rebuild-dashboard.sh

set -e

INSTANCE_ID="${1:-i-0eeb2f36b052f1228}"

echo "🔨 Rebuilding Docker image on live instance to update dashboard..."
echo "   Instance ID: $INSTANCE_ID"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS CLI not configured. Please run 'aws configure' first."
  exit 1
fi

echo "📝 Sending rebuild command via SSM..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Rebuild Docker image with latest dashboard" \
  --parameters 'commands=[
    "cd /opt/pocketbase-manager",
    "echo \"=== Pulling latest code ===\"",
    "git pull origin main || echo \"Git pull failed, continuing with existing code\"",
    "echo \"\"",
    "echo \"=== Rebuilding Docker image ===\"",
    "docker build -t pocketbase-manager:latest .",
    "echo \"\"",
    "echo \"=== Stopping containers ===\"",
    "docker compose -f docker-compose.prod.yml down",
    "echo \"\"",
    "echo \"=== Starting containers with new image ===\"",
    "docker compose -f docker-compose.prod.yml up -d",
    "echo \"\"",
    "echo \"=== Waiting for containers to start ===\"",
    "sleep 10",
    "echo \"\"",
    "echo \"=== Container status ===\"",
    "docker ps | grep -E '\''pocketbase|traefik'\''",
    "echo \"\"",
    "echo \"=== Checking dashboard file ===\"",
    "docker exec pocketbase-manager ls -la /app/dashboard/ | head -10 || echo '\''Container not ready'\''",
    "echo \"\"",
    "echo \"✅ Rebuild complete!\""
  ]' \
  --output text \
  --query 'Command.CommandId')

if [ -z "$COMMAND_ID" ]; then
  echo "❌ Failed to send command"
  exit 1
fi

echo "✅ Command sent. Command ID: $COMMAND_ID"
echo ""
echo "⏳ Waiting for rebuild to complete (this takes 3-5 minutes)..."

# Poll for command completion
MAX_ATTEMPTS=60
ATTEMPT=0
STATUS="InProgress"

while [ "$STATUS" = "InProgress" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  sleep 5
  ATTEMPT=$((ATTEMPT + 1))
  STATUS=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query 'Status' \
    --output text 2>/dev/null || echo "InProgress")
  
  if [ "$STATUS" != "InProgress" ]; then
    break
  fi
  
  if [ $((ATTEMPT % 6)) -eq 0 ]; then
    echo "   Still building... ($ATTEMPT/$MAX_ATTEMPTS attempts)"
  fi
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
echo "✅ Rebuild complete!"
echo ""
echo "💡 Check the site: https://manager.db.oceannet.dev/"
echo "   The Details button should now appear on database cards."
