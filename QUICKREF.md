# 🚀 Quick Reference Guide

Everything you need to know in one place!

---

## 📍 Your Server Details

| Property | Value |
|----------|-------|
| **Domain** | db.oceannet.dev |
| **IP Address** | 13.135.181.201 (permanent!) |
| **Manager API** | https://manager.db.oceannet.dev |
| **Health Check** | https://manager.db.oceannet.dev/api/health |
| **Instance ID** | i-0eeb2f36b052f1228 |
| **Region** | eu-west-2 (London) |
| **Cost** | ~$20-25/month |

---

## 🎯 Common Commands

### Deploy Code
```bash
# Just push! Auto-deploys in 30s
git push origin main
```

### Check Deployment Status
```bash
# View in GitHub
https://github.com/Panosstylianou/multi-project-server/actions

# Or test API
curl https://manager.db.oceannet.dev/api/health
```

### Access Server
```bash
# Via SSM (recommended, no key needed)
aws ssm start-session --target i-0eeb2f36b052f1228

# Via SSH
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201
```

### View Logs
```bash
# Once connected to server
docker logs pocketbase-manager --tail 100
docker logs traefik --tail 100

# Check all containers
docker ps
```

### Manual Rebuild
```bash
# Rebuild instance (keeps same IP)
./scripts/rebuild-instance.sh

# Or via Terraform
cd terraform
terraform taint aws_instance.server
terraform apply -auto-approve
```

---

## 🎨 Create Client Database

### Via API
```bash
curl -X POST https://manager.db.oceannet.dev/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "name": "Client Name",
    "slug": "client-slug",
    "clientName": "Client Company",
    "clientEmail": "client@example.com"
  }'
```

### Result
- **API:** https://client-slug.db.oceannet.dev
- **Admin:** https://client-slug.db.oceannet.dev/_/
- **Cost:** ~$0.50-2/month per client

---

## ⚡ Deployment Types

| Type | When | Time | Triggered By |
|------|------|------|--------------|
| **Fast** | Code changes | 30s | Push to main |
| **Full** | Dependencies changed | 3-5min | package.json changed |

**95% of your pushes = 30 seconds! 🚀**

---

## 🔧 Troubleshooting

### API Not Responding
```bash
# Check if containers are running
aws ssm start-session --target i-0eeb2f36b052f1228
docker ps

# Restart if needed
docker compose -f docker-compose.prod.yml restart
```

### Deployment Failed
```bash
# View workflow logs
https://github.com/Panosstylianou/multi-project-server/actions

# Force rebuild
./scripts/rebuild-instance.sh
```

### DNS Issues
```bash
# Check DNS resolution
dig db.oceannet.dev

# Should return: 13.135.181.201
```

### SSL Certificate Issues
```bash
# Check Traefik logs
docker logs traefik | grep -i certificate

# Restart Traefik
docker restart traefik
```

---

## 📚 Full Documentation

| Topic | File |
|-------|------|
| **Deployment Comparison** | docs/DEPLOYMENT_COMPARISON.md |
| **Auto-Deploy Setup** | docs/AUTO_DEPLOY_SETUP.md |
| **Rebuild Guide** | docs/REBUILD_GUIDE.md |
| **AWS Setup** | docs/AWS_SETUP.md |
| **DNS Setup** | docs/GODADDY_DNS_SETUP.md |
| **Current Status** | DEPLOYED.md |
| **Main README** | README.md |

---

## 🎯 Quick Wins

### Add New Feature
```bash
# 1. Write code
vim src/api/routes/myfeature.ts

# 2. Push (auto-deploys in 30s!)
git add .
git commit -m "Add new feature"
git push origin main

# 3. Done!
```

### Add New Dependency
```bash
# 1. Install package
npm install package-name

# 2. Push (full rebuild, 3-5 min)
git add package.json package-lock.json
git commit -m "Add package-name"
git push origin main

# 3. Done!
```

### Update Client Database
```bash
# 1. Get list of projects
curl -H "x-api-key: YOUR_KEY" \
  https://manager.db.oceannet.dev/api/projects

# 2. Update a project
curl -X PATCH \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  https://manager.db.oceannet.dev/api/projects/client-slug \
  -d '{"name": "New Name"}'
```

---

## 🔐 Security

### API Key Location
```bash
# On server
cat terraform/.api_key.txt

# Or in outputs
cd terraform
terraform output -raw api_key
```

### AWS Credentials
```bash
# View your credentials
cat ~/.aws/credentials

# Used by GitHub Actions for auto-deploy
```

### Update DNS
Only if IP changes (rare):
1. Go to GoDaddy → oceannet.dev → DNS
2. Update A records to new IP
3. Wait 5-10 minutes for propagation

---

## 💰 Cost Breakdown

| Resource | Monthly Cost |
|----------|--------------|
| EC2 t3.small | ~$15 |
| EBS 50GB | ~$4 |
| S3 backups | ~$0.50 |
| Data transfer | ~$0.50 |
| **Total** | **~$20-25** |

**Per client:** $0.50-2/month (for 10-50 clients)

---

## 🎉 What You Built

✅ **Production-Ready Platform**
- Multi-tenant PocketBase hosting
- Automatic SSL certificates
- Smart auto-deployment (30s!)
- Complete infrastructure as code
- Comprehensive monitoring

✅ **Developer Experience**
- Push code → Auto-deploys
- Fast iteration (30s turnaround)
- Easy rollbacks
- Full observability

✅ **Cost Effective**
- $20-25/month for server
- Host unlimited clients
- ~$0.50-2 per client
- Pay once, serve many

---

## 📞 Links

| Resource | URL |
|----------|-----|
| **GitHub Repo** | https://github.com/Panosstylianou/multi-project-server |
| **GitHub Actions** | https://github.com/Panosstylianou/multi-project-server/actions |
| **Manager UI** | https://manager.db.oceannet.dev |
| **API Docs** | https://manager.db.oceannet.dev/api |
| **AWS Console** | https://console.aws.amazon.com/ec2 |
| **GoDaddy DNS** | https://dcc.godaddy.com |

---

## ✨ Pro Tips

1. **Test Locally First**
   ```bash
   npm test
   npm run build
   # Then push
   ```

2. **Use Feature Branches**
   ```bash
   git checkout -b feature/my-feature
   # Work without triggering deploys
   git checkout main
   git merge feature/my-feature
   git push  # Now deploy
   ```

3. **Monitor After Deploy**
   - Watch GitHub Actions
   - Check health endpoint
   - View Docker logs

4. **Batch Changes**
   - Multiple commits → one push
   - Saves deployment time

5. **Tag Releases**
   ```bash
   git tag -a v1.0.0 -m "Release 1.0"
   git push origin v1.0.0
   ```

---

## 🆘 Emergency Rollback

```bash
# Option 1: Revert last commit
git revert HEAD
git push  # Auto-deploys fixed version

# Option 2: Rebuild from known good state
./scripts/rebuild-instance.sh

# Option 3: Manual rollback on server
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201
cd /opt/pocketbase-manager
git log  # Find good commit
git checkout COMMIT_HASH
docker build -t pocketbase-manager:latest .
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

---

**Need More Help?** Check the full docs in the `docs/` folder! 📖

