#!/bin/bash
# Verify AWS deployment is working

set -e

cd "$(dirname "$0")/../terraform"

if [ ! -f terraform.tfstate ]; then
    echo "❌ No deployment found. Run ./scripts/deploy-aws.sh first"
    exit 1
fi

echo "🔍 Verifying PocketBase Manager Deployment"
echo "=========================================="
echo ""

# Get outputs
SERVER_IP=$(terraform output -raw server_public_ip 2>/dev/null || echo "")
INSTANCE_ID=$(terraform output -raw server_instance_id 2>/dev/null || echo "")
DOMAIN=$(terraform output -raw manager_url 2>/dev/null | sed 's|https://manager.||' || echo "localhost")

if [ -z "$SERVER_IP" ]; then
    echo "❌ Could not get server info from terraform"
    exit 1
fi

echo "📊 Deployment Info:"
echo "  Server IP:   $SERVER_IP"
echo "  Instance ID: $INSTANCE_ID"
echo "  Domain:      $DOMAIN"
echo ""

# Check instance status
echo "1️⃣  Checking EC2 instance..."
INSTANCE_STATE=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text)

if [ "$INSTANCE_STATE" = "running" ]; then
    echo "  ✅ Instance is running"
else
    echo "  ❌ Instance state: $INSTANCE_STATE"
    exit 1
fi

# Check if using domain or IP
if [ "$DOMAIN" != "localhost" ]; then
    MANAGER_URL="https://manager.$DOMAIN"
    HEALTH_URL="$MANAGER_URL/api/health"
    
    echo ""
    echo "2️⃣  Checking DNS..."
    DNS_IP=$(dig +short manager.$DOMAIN | tail -1)
    if [ "$DNS_IP" = "$SERVER_IP" ]; then
        echo "  ✅ DNS configured correctly"
    else
        echo "  ⚠️  DNS not configured or not propagated yet"
        echo "     Expected: $SERVER_IP"
        echo "     Got:      $DNS_IP"
        echo "     Using IP address for testing..."
        HEALTH_URL="http://$SERVER_IP:3000/api/health"
    fi
else
    HEALTH_URL="http://$SERVER_IP:3000/api/health"
fi

echo ""
echo "3️⃣  Checking API health..."
for i in {1..5}; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo "  ✅ API is responding"
        HEALTH=$(curl -s "$HEALTH_URL")
        echo ""
        echo "  Health Status:"
        echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
        break
    else
        if [ $i -eq 5 ]; then
            echo "  ❌ API not responding after 5 attempts"
            echo ""
            echo "  Troubleshooting:"
            echo "  1. Server might still be setting up (wait 5-10 minutes)"
            echo "  2. Check logs: aws ssm start-session --target $INSTANCE_ID"
            echo "  3. Then run: tail -f /var/log/user-data.log"
            exit 1
        fi
        echo "  ⏳ Attempt $i/5 - waiting..."
        sleep 10
    fi
done

echo ""
echo "4️⃣  Checking Docker containers..."
echo "  Connecting via SSM..."
CONTAINERS=$(aws ssm send-command \
    --instance-ids $INSTANCE_ID \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["docker ps --format \"table {{.Names}}\t{{.Status}}\""]' \
    --query 'Command.CommandId' \
    --output text)

sleep 3

aws ssm get-command-invocation \
    --command-id $CONTAINERS \
    --instance-id $INSTANCE_ID \
    --query 'StandardOutputContent' \
    --output text

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Verification Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$DOMAIN" != "localhost" ]; then
    echo "🌐 URLs:"
    echo "  Manager:  https://manager.$DOMAIN"
    echo "  Traefik:  https://traefik.$DOMAIN"
else
    echo "🌐 URLs (IP-based):"
    echo "  Manager:  http://$SERVER_IP:3000"
fi

echo ""
echo "🔐 To create your first project:"
API_KEY=$(cat .api_key.txt 2>/dev/null || echo "YOUR_API_KEY")
echo ""
echo "curl -X POST $MANAGER_URL/api/projects \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'x-api-key: $API_KEY' \\"
echo "  -d '{\"name\": \"My First Project\", \"clientName\": \"Client Corp\"}'"
echo ""

echo "📖 More commands: cat docs/AWS_SETUP.md"

