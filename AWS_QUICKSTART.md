# AWS Deployment - Quick Start

## TL;DR

```bash
# One command to deploy everything:
./scripts/deploy-aws.sh
```

This script will:
1. ✅ Check prerequisites (AWS CLI, Terraform)
2. 🔐 Create SSH key pair
3. ⚙️ Configure settings interactively
4. 🚀 Deploy to AWS
5. 📊 Show deployment details

**Estimated time**: 15-20 minutes (5 min setup + 10 min deployment)

**Estimated cost**: ~$20-25/month

---

## Step-by-Step

### 1. Install Terraform (if needed)

```bash
# macOS
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

### 2. Run Deployment Script

```bash
./scripts/deploy-aws.sh
```

The script will ask you for:
- **Domain**: Your domain name (optional, can use IP)
- **Admin Email**: For notifications
- **SSL Email**: For Let's Encrypt certificates
- **Instance Type**: Default `t3.small` ($15/month)
- **Storage Size**: Default 50GB

### 3. Wait for Setup (5-10 minutes)

The server needs time to:
- Install Docker
- Pull PocketBase images
- Configure SSL certificates
- Start services

### 4. Verify Deployment

```bash
./scripts/verify-deployment.sh
```

This checks:
- ✅ EC2 instance running
- ✅ DNS configured (if using domain)
- ✅ API responding
- ✅ Docker containers running

### 5. Configure DNS (if not using Route53)

If you're using an external DNS provider, add these records:

```
Type: A
Name: pocketbase.yourdomain.com
Value: <server_public_ip>  (from terraform output)
TTL: 300

Type: A
Name: *.pocketbase.yourdomain.com
Value: <server_public_ip>
TTL: 300
```

### 6. Create Your First Project

```bash
# Get your API key
cat terraform/.api_key.txt

# Create a project (replace YOUR_API_KEY and YOUR_DOMAIN)
curl -X POST https://manager.YOUR_DOMAIN/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "name": "First Client Project",
    "clientName": "Acme Corp"
  }'
```

---

## What Gets Created

| Resource | Purpose | Cost/Month |
|----------|---------|------------|
| EC2 t3.small | Application server | ~$15 |
| EBS 50GB gp3 | Data storage | ~$4 |
| Elastic IP | Static IP address | $0 (while attached) |
| S3 Bucket | Backups | ~$0.50 |
| Security Groups | Firewall rules | Free |
| **Total** | | **~$20** |

---

## Access Your Server

### SSH Access

```bash
ssh -i ~/.ssh/pocketbase-manager-key.pem ec2-user@<server_ip>
```

### AWS Systems Manager (recommended)

```bash
INSTANCE_ID=$(cd terraform && terraform output -raw server_instance_id)
aws ssm start-session --target $INSTANCE_ID
```

### View Logs

```bash
# On the server
docker logs pocketbase-manager
docker logs traefik

# Setup logs
tail -f /var/log/user-data.log
```

---

## Common Issues

### "Port already in use"

This happened locally. On AWS, clean slate - no conflicts!

### "DNS not propagated"

DNS can take 5-60 minutes. Use IP address temporarily:
```bash
curl http://<server_ip>:3000/api/health
```

### "SSL certificate error"

Let's Encrypt needs DNS to be working. Wait for DNS propagation, then:
```bash
docker restart traefik
docker logs traefik
```

### "API key invalid"

Check the API key:
```bash
cat terraform/.api_key.txt
```

Make sure it matches what's in your curl command.

---

## Updating the Server

### Code Updates

```bash
# SSH into server
ssh -i ~/.ssh/pocketbase-manager-key.pem ec2-user@<server_ip>

# Pull latest
cd /opt/pocketbase-manager
docker compose pull
docker compose up -d
```

### Infrastructure Updates

```bash
cd terraform

# Edit terraform.tfvars (e.g., change instance_type)
vim terraform.tfvars

# Apply changes
terraform apply
```

---

## Backup and Recovery

### Automatic Backups

- Run daily at 3 AM UTC
- Stored in S3 bucket
- Lifecycle: 30 days → Standard-IA → 90 days → Glacier → 365 days deleted

### Manual Backup

```bash
# SSH into server
/opt/pocketbase-manager/backup.sh
```

### Restore from Backup

```bash
# List backups
aws s3 ls s3://$(terraform output -raw s3_backup_bucket)/full-backups/

# Download
aws s3 cp s3://BUCKET/full-backups/backup-DATE.tar.gz .

# On server: extract to /opt/pocketbase-manager/data/
```

---

## Monitoring

### Health Check

```bash
curl https://manager.YOUR_DOMAIN/api/health
```

Response should show:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "docker": true,
    "storage": true,
    "projects": { ... }
  }
}
```

### CloudWatch Metrics

View in AWS Console:
- EC2 → Instances → Monitoring tab
- Metrics: CPU, Network, Disk I/O

### Set Up Alerts (optional)

```bash
# Create SNS topic for alerts
aws sns create-topic --name pocketbase-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:pocketbase-alerts \
  --protocol email \
  --notification-endpoint your@email.com
```

---

## Cost Optimization

### Reduce Costs

1. **Use t3.micro** (512MB RAM) - ~$7/month
   - Good for 1-5 projects
   
2. **Use Spot Instance** - 70% cheaper
   - Add to terraform: `spot_price = "0.01"`
   
3. **Stop when not needed**:
   ```bash
   aws ec2 stop-instances --instance-ids $INSTANCE_ID
   ```

### Scale Up for Growth

1. **More RAM**: Change to `t3.medium` (4GB) - ~$30/month
2. **More Storage**: Increase `data_volume_size`
3. **Multiple regions**: Deploy in different AWS regions

---

## Next Steps

1. ✅ Deployment complete
2. 🔐 Set up GitHub Actions for CI/CD (see GitHub Actions section)
3. 🌐 Create projects for your clients
4. 📊 Monitor usage and costs
5. 🔄 Set up automated backups monitoring

---

## Cleanup (Delete Everything)

⚠️ **Warning**: This deletes all resources and data!

```bash
cd terraform
terraform destroy
```

Also delete:
```bash
# Delete S3 bucket contents first
aws s3 rm s3://$(terraform output -raw s3_backup_bucket) --recursive

# Delete key pair
aws ec2 delete-key-pair --key-name pocketbase-manager-key
rm ~/.ssh/pocketbase-manager-key.pem
```

---

## Support

- 📖 Full docs: `docs/AWS_SETUP.md`
- 🤖 AI integration: `docs/AGENT_GUIDE.md`
- 🚀 Main README: `README.md`

Questions? Check the troubleshooting sections in the docs!

