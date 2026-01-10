# AWS Deployment - Step by Step Guide

## Prerequisites Checklist

- ✅ AWS CLI configured (Account: 323603432190)
- ⚠️ Terraform needs to be installed
- ❓ Domain name (optional but recommended)
- ❓ EC2 Key Pair (for SSH access)

## Step 1: Install Terraform

### macOS (using Homebrew)
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
terraform --version
```

### Alternative: Download directly
```bash
# Download for macOS
curl -O https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_darwin_amd64.zip
unzip terraform_1.6.6_darwin_amd64.zip
sudo mv terraform /usr/local/bin/
terraform --version
```

## Step 2: Create EC2 Key Pair

```bash
# Create a new key pair for SSH access
aws ec2 create-key-pair \
  --key-name pocketbase-manager-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/pocketbase-manager-key.pem

# Set proper permissions
chmod 400 ~/.ssh/pocketbase-manager-key.pem

# Verify it was created
aws ec2 describe-key-pairs --key-names pocketbase-manager-key
```

## Step 3: Configure Domain (Optional)

### Option A: Using Route53 (Recommended)

If you have a domain in Route53:
```bash
# List your hosted zones
aws route53 list-hosted-zones

# Note the Zone ID for your domain
```

### Option B: External DNS Provider

If your domain is elsewhere (GoDaddy, Namecheap, etc.):
- You'll manually add DNS records after deployment
- We'll provide the IP address to point to

## Step 4: Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your settings:

```hcl
# AWS Configuration
aws_region  = "us-east-1"  # or your preferred region
environment = "prod"

# Security
allowed_ssh_cidrs = ["YOUR_IP/32"]  # Get your IP: curl ifconfig.me
allowed_api_cidrs = ["0.0.0.0/0"]

# EC2
instance_type    = "t3.small"  # $15/month
key_pair_name    = "pocketbase-manager-key"
data_volume_size = 50  # GB

# Domain (use your actual domain or use IP-based access)
domain = "pocketbase.yourdomain.com"  # or just use IP for testing

# Route53 (optional - leave empty if using external DNS)
route53_zone_id = ""  # or your Route53 zone ID

# Application
api_key     = "GENERATE_RANDOM_KEY_HERE"  # See command below
admin_email = "admin@youragency.com"
acme_email  = "ssl@youragency.com"  # For Let's Encrypt
```

### Generate Secure API Key

```bash
openssl rand -hex 32
```

## Step 5: Initialize and Deploy

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Review the plan carefully, then apply
terraform apply

# Type 'yes' when prompted
```

## Step 6: Configure DNS (if not using Route53)

After deployment, Terraform will output your server's public IP:

```bash
terraform output server_public_ip
```

Add these DNS records to your domain provider:

```
Type: A
Name: pocketbase.yourdomain.com
Value: <server_public_ip>
TTL: 300

Type: A
Name: *.pocketbase.yourdomain.com
Value: <server_public_ip>
TTL: 300
```

## Step 7: Wait for Server Setup

The server takes 5-10 minutes to:
- Install Docker
- Download images
- Start services
- Get SSL certificates

Monitor progress:
```bash
# Get instance ID from terraform output
INSTANCE_ID=$(terraform output -raw server_instance_id)

# View user-data script logs
aws ssm start-session --target $INSTANCE_ID
# Then run: tail -f /var/log/user-data.log
```

## Step 8: Verify Deployment

```bash
# Health check (replace with your domain or IP)
curl https://manager.pocketbase.yourdomain.com/api/health

# Or with IP (no SSL)
curl http://<server_public_ip>:3000/api/health
```

## Step 9: Create Your First Project

Using the CLI (pointing to production):

```bash
# Create project via API
curl -X POST https://manager.pocketbase.yourdomain.com/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "name": "First Client Project",
    "clientName": "Client Corp"
  }'
```

## Step 10: Set Up CI/CD (Optional)

See `GITHUB_SETUP.md` for GitHub Actions configuration.

## Cost Breakdown

| Resource | Monthly Cost (est.) |
|----------|-------------------|
| EC2 t3.small | ~$15 |
| EBS 50GB gp3 | ~$4 |
| S3 backups (10GB) | ~$0.23 |
| Data transfer (5GB) | ~$0.45 |
| **Total** | **~$20/month** |

## Troubleshooting

### Can't SSH into server
```bash
# Use AWS Systems Manager instead
INSTANCE_ID=$(terraform output -raw server_instance_id)
aws ssm start-session --target $INSTANCE_ID
```

### SSL certificates not working
```bash
# SSH into server and check Traefik logs
docker logs traefik

# Ensure DNS is propagated
dig pocketbase.yourdomain.com
```

### Server not responding
```bash
# Check security group allows traffic
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw security_group_id)

# Check instance is running
aws ec2 describe-instances \
  --instance-ids $(terraform output -raw server_instance_id)
```

## Updating the Server

```bash
# SSH into server
ssh -i ~/.ssh/pocketbase-manager-key.pem ec2-user@<server_ip>

# Pull latest images
cd /opt/pocketbase-manager
docker compose pull
docker compose up -d
```

## Scaling Up

To increase capacity:

```hcl
# In terraform.tfvars
instance_type = "t3.medium"  # 4GB RAM instead of 2GB
data_volume_size = 100  # More storage
```

Then:
```bash
terraform apply
```

## Backup and Recovery

Automatic backups run daily at 3 AM UTC to S3.

To manually restore:
```bash
# List backups
aws s3 ls s3://$(terraform output -raw s3_backup_bucket)/full-backups/

# Download and restore
aws s3 cp s3://BUCKET/full-backups/backup-NAME.tar.gz .
# Then extract on server
```

