#!/bin/bash
# Check what databases exist on the live instance
# Usage: ./scripts/check-databases.sh

set -e

INSTANCE_ID="${1:-i-0eeb2f36b052f1228}"

echo "🔍 Checking databases on live instance..."
echo "   Instance ID: $INSTANCE_ID"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS CLI not configured. Please run 'aws configure' first."
  exit 1
fi

echo "📝 Sending diagnostic command via SSM..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Check databases and metadata" \
  --parameters "commands=[
    \"cd /opt/pocketbase-manager\",
    \"echo '=== Running Containers ==='\",
    \"docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' | grep -E 'pocketbase|NAMES' || echo 'No containers'\",
    \"echo ''\",
    \"echo '=== All Containers (including stopped) ==='\",
    \"docker ps -a --format 'table {{.Names}}\\t{{.Status}}' | grep pocketbase || echo 'No pocketbase containers'\",
    \"echo ''\",
    \"echo '=== Metadata.json ==='\",
    \"cat data/metadata.json 2>/dev/null | jq '.' || echo 'metadata.json not found or invalid'\",
    \"echo ''\",
    \"echo '=== Database Credentials ==='\",
    \"cat data/database-credentials.json 2>/dev/null | jq '.databases | keys' || echo 'database-credentials.json not found or invalid'\",
    \"echo ''\",
    \"echo '=== Checking for Oceannet container ==='\",
    \"docker ps -a | grep -E 'pocketbase-api|oceannet' || echo 'Oceannet container not found'\",
    \"echo ''\",
    \"echo '=== Checking for ChordsMaster container ==='\",
    \"docker ps -a | grep -E 'pocketbase-chords|chords' || echo 'ChordsMaster container not found'\",
    \"echo ''\",
    \"echo '=== Data directory contents ==='\",
    \"ls -la data/projects/ 2>/dev/null || echo 'No projects directory'\"
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
MAX_ATTEMPTS=20
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
echo "✅ Diagnostic complete!"
