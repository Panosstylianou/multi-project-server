# 🚀 Auto-Deploy Setup Guide

This guide shows you how to set up automatic deployment when you push code to GitHub.

---

## 🎯 How It Works

When you push to the `main` branch:

1. **GitHub Actions** detects the push
2. Connects to your AWS EC2 instance via **SSM**
3. Pulls latest code from GitHub
4. Rebuilds the Docker image
5. Restarts containers with new code
6. Runs a health check
7. Reports success/failure

**Total time:** ~3-5 minutes

---

## ⚙️ Setup Steps

### Step 1: Add AWS Credentials to GitHub

1. Go to your GitHub repo: https://github.com/Panosstylianou/multi-project-server
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Add these 2 secrets:

**Secret 1:**
- Name: `AWS_ACCESS_KEY_ID`
- Value: Your AWS access key (from `~/.aws/credentials`)

**Secret 2:**
- Name: `AWS_SECRET_ACCESS_KEY`  
- Value: Your AWS secret key (from `~/.aws/credentials`)

---

### Step 2: Update Instance ID in Workflow

The workflow file has a hardcoded instance ID. Update it if needed:

**File:** `.github/workflows/auto-deploy.yml`

```yaml
- name: Get Instance ID from Terraform
  id: get-instance
  run: |
    INSTANCE_ID="i-0eeb2f36b052f1228"  # ← Update this if instance changes
    echo "instance_id=$INSTANCE_ID" >> $GITHUB_OUTPUT
```

**Current Instance ID:** `i-0eeb2f36b052f1228`

---

### Step 3: Push Changes

```bash
git add .github/workflows/auto-deploy.yml
git commit -m "Add auto-deploy workflow"
git push origin main
```

This first push will trigger the auto-deploy workflow!

---

## 🧪 Testing Auto-Deploy

### Test 1: Make a small change

```bash
# Edit any file (e.g., README)
echo "Testing auto-deploy" >> README.md

# Commit and push
git add README.md
git commit -m "Test: trigger auto-deploy"
git push origin main
```

### Test 2: Watch the deployment

1. Go to: https://github.com/Panosstylianou/multi-project-server/actions
2. Click on the latest "Auto Deploy on Push" workflow
3. Watch the live log as it deploys!

### Test 3: Verify deployment

Wait ~5 minutes after push, then:

```bash
curl https://manager.db.oceannet.dev/api/health
```

Should return the healthy status.

---

## 📊 Workflow Triggers

The auto-deploy workflow runs when:

### Automatic Triggers:
- ✅ Push to `main` branch
- ✅ Manual trigger from GitHub Actions UI

### Manual Trigger:
1. Go to: https://github.com/Panosstylianou/multi-project-server/actions
2. Click "Auto Deploy on Push"
3. Click "Run workflow" button
4. Select branch and click "Run workflow"

---

## 🔍 Monitoring Deployments

### View Deployment Logs

**In GitHub:**
1. Go to **Actions** tab
2. Click on the workflow run
3. Click on the "Deploy to AWS" job
4. Expand each step to see logs

**On Server (via SSM):**
```bash
# Connect to server
aws ssm start-session --target i-0eeb2f36b052f1228

# View Docker logs
docker logs pocketbase-manager --tail 100

# View deployment history
journalctl -u pocketbase-manager --since "1 hour ago"
```

---

## 🛠️ What Gets Deployed

The auto-deploy workflow updates:

✅ Application code (Node.js/TypeScript)  
✅ Docker configuration  
✅ API routes and logic  
✅ Environment variables (from server `.env`)  

❌ Does NOT update:
- Terraform infrastructure
- DNS settings
- AWS resources
- Database data

---

## ⚡ Deployment Timeline

| Step | Time | Description |
|------|------|-------------|
| Trigger | 0s | Push detected by GitHub |
| Start | 10s | Workflow starts |
| Connect | 20s | Connect to AWS |
| Pull code | 30s | Git pull latest changes |
| Build | 2-3min | Docker image rebuild |
| Deploy | 30s | Restart containers |
| Health check | 30s | Verify services |
| **Total** | **3-5min** | Push to live |

---

## 🔐 Security

### IAM Permissions Required

Your AWS user (`eb-user`) needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

### GitHub Secrets

- Stored encrypted in GitHub
- Only accessible during workflow runs
- Never exposed in logs
- Can be rotated anytime

---

## 🚨 Troubleshooting

### Deployment Fails with "Instance not connected"

**Problem:** SSM agent not running on instance

**Solution:**
```bash
# SSH into server
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201

# Check SSM agent
sudo systemctl status amazon-ssm-agent

# Restart if needed
sudo systemctl restart amazon-ssm-agent
```

### Deployment Succeeds but Changes Not Visible

**Problem:** Docker image not rebuilt or containers not restarted

**Solution:**
Check the workflow logs for errors in these steps:
- "Rebuilding Docker image"
- "Restarting containers"

Force a rebuild locally to test:
```bash
./scripts/rebuild-instance.sh
```

### Health Check Fails

**Problem:** Services taking longer to start

**Solution:** This is often just timing. Wait 2-3 more minutes and test manually:
```bash
curl https://manager.db.oceannet.dev/api/health
```

### AWS Credentials Invalid

**Problem:** GitHub secrets are wrong or expired

**Solution:**
1. Get fresh credentials from `~/.aws/credentials`
2. Update GitHub secrets
3. Re-run the workflow

---

## 🎨 Customizing the Workflow

### Deploy Only on Tagged Releases

Change the trigger in `.github/workflows/auto-deploy.yml`:

```yaml
on:
  push:
    tags:
      - 'v*'  # Only deploy when pushing v1.0.0, v1.1.0, etc.
```

### Add Slack Notifications

Add this step at the end:

```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Deployment ${{ job.status }}: ${{ github.sha }}"
      }
```

### Run Tests Before Deploy

Add this before the deploy step:

```yaml
- name: Run Tests
  run: |
    npm install
    npm test
```

---

## 📈 Best Practices

### 1. Use Branch Protection

Protect `main` branch to require:
- Pull request reviews
- CI tests passing
- No force pushes

### 2. Test in Staging First

Create a staging branch and instance:
- Push to `staging` → deploys to staging server
- Merge to `main` → deploys to production

### 3. Tag Releases

Use semantic versioning:
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 4. Monitor Deployments

Set up alerts for:
- Failed deployments
- Health check failures
- High error rates after deploy

---

## 🔄 Rollback Strategy

If a deployment breaks something:

### Option 1: Revert the Git Commit

```bash
git revert HEAD
git push origin main
```

Auto-deploy will deploy the reverted code.

### Option 2: Manual Rollback

```bash
# SSH into server
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201

# Go to previous git commit
cd /opt/pocketbase-manager
git log --oneline  # Find the previous working commit
git checkout <commit-hash>

# Rebuild and restart
docker build -t pocketbase-manager:latest .
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Option 3: Rebuild from Scratch

```bash
./scripts/rebuild-instance.sh
```

Uses the latest code from `main` branch.

---

## ✅ Quick Reference

| Action | Command |
|--------|---------|
| Push to deploy | `git push origin main` |
| View deployments | https://github.com/[repo]/actions |
| Manual trigger | Actions → "Auto Deploy" → "Run workflow" |
| Check logs on server | `aws ssm start-session --target i-0eeb2f36b052f1228` |
| Test endpoint | `curl https://manager.db.oceannet.dev/api/health` |
| Rollback | `git revert HEAD && git push` |

---

## 🎉 You're Done!

Now every time you push code to `main`, it automatically deploys to your AWS server!

Test it by making a small change and pushing to GitHub. Watch the magic happen in the Actions tab! 🚀

