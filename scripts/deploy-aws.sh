#!/bin/bash
set -e

echo "🚀 PocketBase Multi-Project Server - AWS Deployment"
echo "===================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    echo "Install: brew install awscli"
    exit 1
fi
echo -e "${GREEN}✓${NC} AWS CLI installed"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓${NC} AWS credentials configured (Account: $ACCOUNT_ID)"

# Check Terraform
if ! command -v terraform &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Terraform not installed"
    echo ""
    read -p "Install Terraform with Homebrew? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        brew tap hashicorp/tap
        brew install hashicorp/tap/terraform
    else
        echo "Please install Terraform manually: https://www.terraform.io/downloads"
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} Terraform installed: $(terraform version | head -1)"

echo ""
echo "🔐 Setting up SSH key pair..."

KEY_NAME="pocketbase-manager-key"
KEY_PATH="$HOME/.ssh/$KEY_NAME.pem"

# Check if key already exists
if aws ec2 describe-key-pairs --key-names $KEY_NAME &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Key pair '$KEY_NAME' already exists in AWS"
    if [ ! -f "$KEY_PATH" ]; then
        echo -e "${RED}❌ But local key file not found at $KEY_PATH${NC}"
        echo "Either:"
        echo "  1. Delete the AWS key: aws ec2 delete-key-pair --key-name $KEY_NAME"
        echo "  2. Or use a different key name in this script"
        exit 1
    fi
else
    echo "Creating new key pair..."
    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --query 'KeyMaterial' \
        --output text > "$KEY_PATH"
    chmod 400 "$KEY_PATH"
    echo -e "${GREEN}✓${NC} Key pair created: $KEY_PATH"
fi

echo ""
echo "⚙️  Configuration..."

# Get current IP
CURRENT_IP=$(curl -s ifconfig.me)
echo "Your public IP: $CURRENT_IP"

# Generate API key
API_KEY=$(openssl rand -hex 32)

# Get region
AWS_REGION=$(aws configure get region || echo "us-east-1")

echo ""
read -p "Enter your domain (e.g., pocketbase.youragency.com) or press Enter to skip: " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN="localhost"
    echo -e "${YELLOW}⚠${NC}  No domain set. You'll access via IP address (no SSL)"
fi

read -p "Enter your admin email: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
    ADMIN_EMAIL="admin@$DOMAIN"
fi

read -p "Enter email for SSL certificates (Let's Encrypt): " ACME_EMAIL
if [ -z "$ACME_EMAIL" ]; then
    ACME_EMAIL="$ADMIN_EMAIL"
fi

read -p "EC2 instance type [t3.small]: " INSTANCE_TYPE
INSTANCE_TYPE=${INSTANCE_TYPE:-t3.small}

read -p "Storage size in GB [50]: " STORAGE_SIZE
STORAGE_SIZE=${STORAGE_SIZE:-50}

# Check for Route53 zone
ROUTE53_ZONE=""
if [ "$DOMAIN" != "localhost" ]; then
    echo ""
    echo "Checking for Route53 hosted zone..."
    ZONES=$(aws route53 list-hosted-zones --output json 2>/dev/null || echo "{}")
    if echo "$ZONES" | grep -q "HostedZones"; then
        echo "Available hosted zones:"
        echo "$ZONES" | jq -r '.HostedZones[] | "\(.Name) - \(.Id)"'
        echo ""
        read -p "Enter Route53 Zone ID (or press Enter to skip): " ROUTE53_ZONE
    fi
fi

echo ""
echo "📝 Creating terraform.tfvars..."

cd terraform

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
route53_zone_id = "$ROUTE53_ZONE"

# Application Configuration
api_key     = "$API_KEY"
admin_email = "$ADMIN_EMAIL"
acme_email  = "$ACME_EMAIL"
EOF

echo -e "${GREEN}✓${NC} Configuration saved to terraform/terraform.tfvars"

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
echo "You'll need this to access the management API!"
echo ""

# Save to a secure file
echo "$API_KEY" > .api_key.txt
chmod 600 .api_key.txt
echo "API key saved to: terraform/.api_key.txt (keep this secure!)"

echo ""
read -p "Ready to deploy to AWS? This will create resources and incur costs. (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled. Configuration saved in terraform/terraform.tfvars"
    echo "You can deploy later by running:"
    echo "  cd terraform && terraform init && terraform apply"
    exit 0
fi

echo ""
echo "🚀 Deploying to AWS..."

terraform init

echo ""
echo "Running terraform plan..."
terraform plan -out=tfplan

echo ""
read -p "Review the plan above. Apply these changes? (y/n) " -n 1 -r
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
S3_BUCKET=$(terraform output -raw s3_backup_bucket)

echo "📊 Deployment Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Server IP:     $SERVER_IP"
echo "Instance ID:   $INSTANCE_ID"
echo "S3 Bucket:     $S3_BUCKET"
echo "SSH Key:       $KEY_PATH"
echo ""

if [ "$DOMAIN" = "localhost" ]; then
    echo "Manager API:   http://$SERVER_IP:3000"
    echo "Health Check:  http://$SERVER_IP:3000/api/health"
else
    echo "Manager URL:   https://manager.$DOMAIN"
    echo "Health Check:  https://manager.$DOMAIN/api/health"
    
    if [ -z "$ROUTE53_ZONE" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  DNS Configuration Required${NC}"
        echo "Add these DNS records to your domain provider:"
        echo ""
        echo "  A    $DOMAIN              → $SERVER_IP"
        echo "  A    *.$DOMAIN            → $SERVER_IP"
        echo ""
    fi
fi

echo ""
echo "⏳ Note: Server is setting up (takes 5-10 minutes)"
echo "   - Installing Docker"
echo "   - Pulling images"
echo "   - Getting SSL certificates"
echo ""

echo "🔍 Monitor setup progress:"
echo "   aws ssm start-session --target $INSTANCE_ID"
echo "   Then run: tail -f /var/log/user-data.log"
echo ""

echo "📝 Next Steps:"
echo "1. Wait 5-10 minutes for setup to complete"
echo "2. Test health endpoint"
echo "3. Create your first project"
echo ""

echo "💾 Important Files:"
echo "   API Key:  terraform/.api_key.txt"
echo "   SSH Key:  $KEY_PATH"
echo "   Config:   terraform/terraform.tfvars"
echo ""

echo -e "${GREEN}Deployment successful!${NC}"

