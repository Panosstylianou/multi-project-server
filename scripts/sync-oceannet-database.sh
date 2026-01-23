#!/bin/bash
# Sync/add Oceannet database to live instance metadata
# Usage: ./scripts/sync-oceannet-database.sh

set -e

INSTANCE_ID="${1:-i-0eeb2f36b052f1228}"

echo "🔄 Syncing Oceannet database to live instance..."
echo "   Instance ID: $INSTANCE_ID"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ AWS CLI not configured. Please run 'aws configure' first."
  exit 1
fi

# Read the Oceannet database info from local files
OCEANNET_METADATA=$(cat << 'EOF'
{
  "id": "HemBb2I2pmtw",
  "name": "Oceannet",
  "slug": "api",
  "clientName": "Oceannet",
  "status": "running",
  "containerName": "pocketbase-api",
  "port": 8090,
  "domain": "api.db.oceannet.dev",
  "createdAt": "2026-01-23T10:00:00.000Z",
  "updatedAt": "2026-01-23T12:00:00.000Z",
  "config": {
    "memoryLimit": "256m",
    "cpuLimit": "0.5",
    "autoBackup": true,
    "enabledFeatures": {
      "auth": true,
      "storage": true,
      "realtime": true
    }
  }
}
EOF
)

OCEANNET_CREDENTIALS=$(cat << 'EOF'
{
  "projectId": "HemBb2I2pmtw",
  "projectName": "Oceannet",
  "projectSlug": "api",
  "domain": "api.db.oceannet.dev",
  "adminEmail": "hello@oceannet.dev",
  "adminPassword": "BetterMapRules8",
  "createdAt": "2026-01-23T10:00:00.000Z",
  "updatedAt": "2026-01-23T12:00:00.000Z"
}
EOF
)

echo "📝 Sending sync command via SSM..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Sync Oceannet database to metadata" \
  --parameters "commands=[
    \"cd /opt/pocketbase-manager\",
    \"echo '=== Checking current metadata ==='\",
    \"cat data/metadata.json | jq '.projects | keys' || echo 'No metadata.json'\",
    \"echo ''\",
    \"echo '=== Checking if Oceannet container exists ==='\",
    \"docker ps -a | grep pocketbase-api || echo 'Oceannet container not found'\",
    \"echo ''\",
    \"echo '=== Adding Oceannet to metadata.json ==='\",
    \"# Backup existing metadata\",
    \"cp data/metadata.json data/metadata.json.backup\",
    \"# Use jq to add Oceannet project\",
    \"cat data/metadata.json | jq '.projects + {\"HemBb2I2pmtw\": {\"id\": \"HemBb2I2pmtw\", \"name\": \"Oceannet\", \"slug\": \"api\", \"clientName\": \"Oceannet\", \"status\": \"running\", \"containerName\": \"pocketbase-api\", \"port\": 8090, \"domain\": \"api.db.oceannet.dev\", \"createdAt\": \"2026-01-23T10:00:00.000Z\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\", \"config\": {\"memoryLimit\": \"256m\", \"cpuLimit\": \"0.5\", \"autoBackup\": true, \"enabledFeatures\": {\"auth\": true, \"storage\": true, \"realtime\": true}}}} | {projects: ., lastUpdated: \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"} > data/metadata.json.tmp\",
    \"mv data/metadata.json.tmp data/metadata.json\",
    \"echo 'Metadata updated'\",
    \"echo ''\",
    \"echo '=== Adding Oceannet to database-credentials.json ==='\",
    \"# Backup existing credentials\",
    \"cp data/database-credentials.json data/database-credentials.json.backup\",
    \"# Use jq to add Oceannet credentials\",
    \"cat data/database-credentials.json | jq '.databases + {\"HemBb2I2pmtw\": {\"projectId\": \"HemBb2I2pmtw\", \"projectName\": \"Oceannet\", \"projectSlug\": \"api\", \"domain\": \"api.db.oceannet.dev\", \"adminEmail\": \"hello@oceannet.dev\", \"adminPassword\": \"BetterMapRules8\", \"createdAt\": \"2026-01-23T10:00:00.000Z\", \"updatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}} | {databases: ., lastUpdated: \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"} > data/database-credentials.json.tmp\",
    \"mv data/database-credentials.json.tmp data/database-credentials.json\",
    \"echo 'Credentials updated'\",
    \"echo ''\",
    \"echo '=== Verifying updates ==='\",
    \"echo 'Projects in metadata:'\",
    \"cat data/metadata.json | jq '.projects | keys'\",
    \"echo 'Databases in credentials:'\",
    \"cat data/database-credentials.json | jq '.databases | keys'\",
    \"echo ''\",
    \"echo '=== Restarting manager container to reload metadata ==='\",
    \"docker restart pocketbase-manager || echo 'Container restart failed'\",
    \"sleep 5\",
    \"echo '✅ Sync complete!'\"
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
echo "✅ Sync complete!"
echo ""
echo "💡 Check the site: https://manager.db.oceannet.dev/"
echo "   The Oceannet database should now appear in the list."
