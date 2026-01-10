#!/bin/bash
set -e

echo "🚀 PocketBase Multi-Project Server - AWS Deployment (Simple)"
echo "============================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")/../terraform"

echo "⚙️  Configuration..."
echo ""

# Get current IP
CURRENT_IP=$(curl -s ifconfig.me)
echo "Your public IP: $CURRENT_IP"

# Generate API key
API_KEY=$(openssl rand -hex 32)

# Get region
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo "AWS Region: $AWS_REGION"

echo ""
echo "Available SSH key pairs:"
aws ec2 describe-key-pairs --query 'KeyPairs[*].[KeyName]' --output text
echo ""

read -p "Enter the SSH key pair name to use: " KEY_NAME
if [ -z "$KEY_NAME" ]; then
    echo "Error: Key pair name is required"
    exit 1
fi

# Verify key exists
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" &> /dev/null; then
    echo "Error: Key pair '$KEY_NAME' not found"
    exit 1
fi

echo ""
read -p "Enter your domain (e.g., pocketbase.youragency.com) or press Enter to use IP: " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN="localhost"
    echo -e "${YELLOW}⚠${NC}  No domain set. You'll access via IP address (no SSL)"
fi

read -p "Enter your admin email: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
    ADMIN_EMAIL="admin@$DOMAIN"
fi

read -p "Enter email for SSL certificates: " ACME_EMAIL
if [ -z "$ACME_EMAIL" ]; then
    ACME_EMAIL="$ADMIN_EMAIL"
fi

read -p "EC2 instance type [t3.small]: " INSTANCE_TYPE
INSTANCE_TYPE=${INSTANCE_TYPE:-t3.small}

read -p "Storage size in GB [50]: " STORAGE_SIZE
STORAGE_SIZE=${STORAGE_SIZE:-50}

echo ""
echo "📝 Creating terraform.tfvars..."

cat > terraform.tfvars <<EOF
# AWS Configuration
aws_region  = "$AWS_REGION"
environment = "prod"

# Network Security
allowed_ssh_cidrs = ["$CURRENT_IP/32"]
allowed_api_cidrs = ["0.0.0.0/0"]

# EC2 Configuration
instance_type    = "$INSTANCE_TYPE"
key_pair_name    = "$KEY_NAME"
data_volume_size = $STORAGE_SIZE

# Domain Configuration
domain          = "$DOMAIN"
route53_zone_id = ""

# Application Configuration
api_key     = "$API_KEY"
admin_email = "$ADMIN_EMAIL"
acme_email  = "$ACME_EMAIL"
EOF

echo -e "${GREEN}✓${NC} Configuration saved"

echo ""
echo "📄 Configuration Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Region:        $AWS_REGION"
echo "Instance:      $INSTANCE_TYPE (~\$15-30/month)"
echo "Storage:       ${STORAGE_SIZE}GB"
echo "Domain:        $DOMAIN"
echo "SSH Key:       $KEY_NAME"
echo "Your IP:       $CURRENT_IP (allowed for SSH)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🔑 IMPORTANT - Save this API Key:"
echo -e "${YELLOW}$API_KEY${NC}"
echo ""

# Save API key
echo "$API_KEY" > .api_key.txt
chmod 600 .api_key.txt
echo "API key saved to: terraform/.api_key.txt"

echo ""
read -p "Ready to deploy to AWS? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🚀 Deploying to AWS..."

terraform init

echo ""
terraform plan -out=tfplan

echo ""
read -p "Apply these changes? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

terraform apply tfplan

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get outputs
SERVER_IP=$(terraform output -raw server_public_ip)
INSTANCE_ID=$(terraform output -raw server_instance_id)

echo "📊 Deployment Details:"
echo "Server IP:     $SERVER_IP"
echo "Instance ID:   $INSTANCE_ID"
echo ""

if [ "$DOMAIN" = "localhost" ]; then
    echo "Manager API:   http://$SERVER_IP:3000"
    echo ""
    echo "⏳ Wait 5-10 minutes for setup, then test:"
    echo "   curl http://$SERVER_IP:3000/api/health"
else
    echo "Manager URL:   https://manager.$DOMAIN"
    echo ""
    echo -e "${YELLOW}⚠️  Add DNS records:${NC}"
    echo "   A    $DOMAIN      → $SERVER_IP"
    echo "   A    *.$DOMAIN    → $SERVER_IP"
    echo ""
    echo "⏳ Wait 5-10 minutes for setup + DNS propagation"
fi

echo ""
echo "🔍 Monitor progress:"
echo "   aws ssm start-session --target $INSTANCE_ID"
echo "   tail -f /var/log/user-data.log"
echo ""
echo "💾 API Key saved to: terraform/.api_key.txt"

