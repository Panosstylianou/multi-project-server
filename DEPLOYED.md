# 🚀 Your PocketBase Server is LIVE!

**Deployed:** January 10, 2026  
**Region:** eu-west-2 (London)  
**Status:** ✅ Active (Redeployed with fixes)

---

## 🌐 Your URLs

| Service | URL |
|---------|-----|
| **Manager API** | https://manager.db.oceannet.dev |
| **API Endpoint** | https://manager.db.oceannet.dev/api |
| **Traefik Dashboard** | https://traefik.db.oceannet.dev |
| **Health Check** | https://manager.db.oceannet.dev/api/health |

---

## 🔐 Credentials

**API Key:**  
```
6362ddb984e89b2049877f7e8c3e8c483348f0c10b9890f29de83018d37bbded
```

**Also saved in:** `terraform/.api_key.txt`

---

## 🖥️ Server Details

| Property | Value |
|----------|-------|
| **IP Address** | 13.135.181.201 |
| **Instance ID** | i-07a1c65a10130ee13 |
| **Instance Type** | t3.small (2 vCPU, 2GB RAM) |
| **Storage** | 50GB EBS (gp3) |
| **SSH Key** | bettermap-key |

---

## 📝 DNS Configuration (Cloudflare)

### ⚠️ IMPORTANT: Configure these in Cloudflare now!

Go to: https://dash.cloudflare.com → oceannet.dev → DNS

**Record 1:**
```
Type:    A
Name:    db
Content: 13.135.181.201
TTL:     1 Hour
```

**Record 2:**
```
Type:    A
Name:    *.db
Content: 13.135.181.201
TTL:     1 Hour
```

**Critical:** Must be **grey cloud** (DNS only), NOT orange (proxied)!

---

## ⏱️ Setup Timeline

- **00:00** - Infrastructure created ✅
- **00:05** - Server installing Docker...
- **00:10** - Building project...
- **00:15** - Getting SSL certificates...
- **00:20** - READY! 🎉

**Current time:** Check back in 15 minutes

---

## 🔍 Monitor Progress

### Option 1: AWS Systems Manager (Recommended)
```bash
aws ssm start-session --target i-07a1c65a10130ee13
sudo tail -f /var/log/user-data.log
```

### Option 2: SSH
```bash
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201
sudo tail -f /var/log/user-data.log
```

### Look for these completion messages:
```
✓ Docker installed
✓ Images pulled
✓ Containers started
✓ Setup complete
```

---

## ✅ Verify Deployment

After DNS propagates and server finishes setup (~15 min):

```bash
# Test health endpoint
curl https://manager.db.oceannet.dev/api/health

# Should return:
# {"success":true,"data":{"status":"healthy",...}}
```

---

## 🎯 Create Your First Client Project

```bash
curl -X POST https://manager.db.oceannet.dev/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: 6362ddb984e89b2049877f7e8c3e8c483348f0c10b9890f29de83018d37bbded" \
  -d '{
    "name": "Acme Corp Website",
    "slug": "acme-corp",
    "clientName": "Acme Corp",
    "clientEmail": "contact@acme.com"
  }'
```

**Result:** Client gets their own PocketBase at:
- **API:** https://acme-corp.db.oceannet.dev
- **Admin:** https://acme-corp.db.oceannet.dev/_/

---

## 💰 Monthly Costs

| Resource | Cost |
|----------|------|
| EC2 t3.small | ~$15 |
| EBS 50GB gp3 | ~$4 |
| S3 backups | ~$0.50 |
| Data transfer | ~$0.50 |
| **Total** | **~$20-25** |

Per client: ~$0.50-2/month (for 10-50 clients)

---

## 🛠️ Management Commands

### Via API
```bash
# List all projects
curl -H "x-api-key: YOUR_KEY" https://manager.db.oceannet.dev/api/projects

# Stop a project
curl -X POST -H "x-api-key: YOUR_KEY" \
  https://manager.db.oceannet.dev/api/projects/acme-corp/stop

# Create backup
curl -X POST -H "x-api-key: YOUR_KEY" \
  https://manager.db.oceannet.dev/api/projects/acme-corp/backups
```

### Via SSH
```bash
# SSH into server
ssh -i ~/.ssh/database_key.pem ec2-user@18.133.25.225

# View running containers
docker ps

# View logs
docker logs pocketbase-manager
docker logs pocketbase-acme-corp

# Manual backup
/opt/pocketbase-manager/backup.sh
```

---

## 📊 AWS Resources Created

| Type | ID | Purpose |
|------|-----|---------|
| VPC | vpc-0e40b897ec45296d5 | Networking |
| Security Group | sg-0214a7434051ac4d5 | Firewall |
| S3 Bucket | pocketbase-manager-backups-20260110181556151000000003 | Backups |
| EC2 Instance | i-07a1c65a10130ee13 | Server |
| Elastic IP | 13.135.181.201 | Static IP |

---

## 🔄 Updates & Maintenance

### Update Server Code
```bash
# SSH into server
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201

# Pull latest from GitHub and rebuild
cd /opt/pocketbase-manager
git pull
docker build -t pocketbase-manager:latest .
docker compose -f docker-compose.prod.yml up -d
```

### Scale Up (More RAM/CPU)
```bash
# On your local machine
cd terraform
vim terraform.tfvars  # Change instance_type to t3.medium
terraform apply
```

---

## 📚 Documentation

- **Main README:** `README.md`
- **AWS Setup:** `docs/AWS_SETUP.md`
- **Cloudflare DNS:** `docs/CLOUDFLARE_DNS_SETUP.md`
- **Agent Integration:** `docs/AGENT_GUIDE.md`
- **Deployment Guide:** `docs/DEPLOYMENT.md`

---

## 🆘 Troubleshooting

### DNS Not Resolving
```bash
# Check DNS propagation
dig db.oceannet.dev

# Should return: 13.135.181.201
```

### SSL Certificate Issues
```bash
# SSH into server
docker logs traefik | grep -i cert

# Ensure DNS records are correct in GoDaddy!
```

### API Not Responding
```bash
# Check if server finished setup
aws ssm start-session --target i-07a1c65a10130ee13
tail -100 /var/log/user-data.log

# Look for "Container pocketbase-manager  Started"
# Look for "Container traefik  Started"
```

---

## 🎉 Success!

Your PocketBase Multi-Project Server is live and ready to host client databases!

**Next:** Configure DNS in Cloudflare, wait 15 minutes, then create your first project!

