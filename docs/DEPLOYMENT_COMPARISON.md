# ⚡ Deployment Methods Comparison

## Overview

There are two ways to deploy code changes:

1. **Fast Deploy** (30 seconds) - Code updates only
2. **Full Rebuild** (3-5 minutes) - Everything including dependencies

The smart workflow automatically chooses the right method based on what changed!

---

## 📊 Comparison Table

| Aspect | Fast Deploy | Full Rebuild |
|--------|-------------|--------------|
| **Speed** | ~30 seconds | ~3-5 minutes |
| **Use Case** | Code changes (99% of pushes) | Dependency/Docker changes |
| **What Happens** | Git pull + app restart | Docker image rebuild |
| **CPU Usage** | Low | High |
| **Risk** | Very low | Low |
| **Downtime** | ~5 seconds | ~15 seconds |

---

## ⚡ Fast Deploy (Recommended for Most Changes)

### When It Runs:
- ✅ You changed code in `src/`
- ✅ You updated config files
- ✅ You fixed bugs
- ✅ You added new features (no new dependencies)
- ✅ 99% of normal development

### What It Does:
```bash
1. git pull origin main       # Get latest code (1s)
2. npm ci --only=production   # Update deps if needed (5s)
3. npm run build              # Compile TypeScript (10s)
4. docker compose restart     # Restart app (5s)
5. Health check               # Verify (10s)
Total: ~30 seconds
```

### Example Changes That Use Fast Deploy:
```typescript
// Changed API logic
app.get('/api/projects', async (req, res) => {
  // Your updated code here
});

// Updated types
interface Project {
  newField: string;  // Added this
}

// Fixed bugs
const result = await fixedFunction();
```

---

## 🔨 Full Rebuild (Only When Needed)

### When It Runs:
- ✅ `package.json` changed (new/removed dependencies)
- ✅ `Dockerfile` changed
- ✅ `docker-compose.yml` changed
- ✅ Major version releases
- ✅ System-level changes

### What It Does:
```bash
1. git pull origin main               # Get latest code (1s)
2. docker build                       # Rebuild image (2-3min)
3. docker compose up -d --force-recreate  # Recreate (20s)
4. docker system prune -f             # Cleanup (10s)
5. Health check                       # Verify (20s)
Total: ~3-5 minutes
```

### Example Changes That Trigger Full Rebuild:
```json
// package.json changed
{
  "dependencies": {
    "express": "^4.18.0",
    "new-package": "^1.0.0"  // ← Added dependency
  }
}
```

```dockerfile
# Dockerfile changed
FROM node:20-alpine  # ← Changed base image
RUN apk add --no-cache git  # ← Added system package
```

---

## 🧠 Smart Workflow (Auto-Detect)

The **new workflow** (`auto-deploy-fast.yml`) automatically detects what changed:

```yaml
# Checks what files changed
if changed: Dockerfile, package.json, docker-compose.yml
  → Full Rebuild (3-5 min)
else
  → Fast Deploy (30 sec)
```

### Example Scenarios:

#### Scenario 1: Bug Fix
```bash
git add src/api/routes/projects.ts
git commit -m "Fix: Handle null values"
git push
```
**Result:** ⚡ Fast Deploy (30s)

#### Scenario 2: New Dependency
```bash
git add package.json package-lock.json
git commit -m "Add axios library"
git push
```
**Result:** 🔨 Full Rebuild (3-5min)

#### Scenario 3: Multiple Files
```bash
git add src/ README.md
git commit -m "Add feature + update docs"
git push
```
**Result:** ⚡ Fast Deploy (30s)

---

## 📈 Performance Impact

### Fast Deploy
- **Server Load:** Minimal
- **Network:** ~10MB (git pull)
- **Build Time:** 10 seconds (TypeScript compile)
- **User Impact:** Almost none (5s restart)
- **Frequency:** Use for 95% of pushes

### Full Rebuild  
- **Server Load:** High during build
- **Network:** ~500MB (image layers)
- **Build Time:** 2-3 minutes (full Docker build)
- **User Impact:** ~15s downtime
- **Frequency:** Use for 5% of pushes

---

## 🎯 Best Practices

### Do: Fast Deploy
```bash
# Feature development
git push  # ← Fast deploy automatically

# Bug fixes
git push  # ← Fast deploy automatically

# Code refactoring
git push  # ← Fast deploy automatically
```

### Do: Full Rebuild
```bash
# Adding dependencies
npm install axios
git add package.json package-lock.json
git commit -m "Add axios"
git push  # ← Full rebuild automatically

# Updating Dockerfile
git add Dockerfile
git commit -m "Update base image"
git push  # ← Full rebuild automatically
```

### Don't: Force Rebuild Unnecessarily
```bash
# ❌ Don't manually trigger full rebuild for code changes
# The workflow will choose the right method!
```

---

## 🔄 Manual Override

If you need to force a specific deployment method:

### Force Fast Deploy
```bash
# Trigger manually from GitHub Actions UI
# Select: "Fast Deploy (No Rebuild)" workflow
```

### Force Full Rebuild
```bash
# Option 1: Use rebuild script
./scripts/rebuild-instance.sh

# Option 2: Trigger from GitHub Actions
# Select: "Auto Deploy on Push" workflow (old one)

# Option 3: SSH and rebuild
ssh -i ~/.ssh/bettermap-key.pem ec2-user@13.135.181.201
cd /opt/pocketbase-manager
docker build -t pocketbase-manager:latest .
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

---

## 📊 Real-World Timeline

### Typical Development Day:

| Time | Action | Deploy Method | Duration |
|------|--------|---------------|----------|
| 9:00 AM | Fix bug in API | Fast | 30s |
| 10:30 AM | Add new route | Fast | 30s |
| 11:45 AM | Update types | Fast | 30s |
| 2:00 PM | Add `lodash` dependency | **Full** | 3min |
| 3:30 PM | Refactor logic | Fast | 30s |
| 4:15 PM | Update documentation | (Skipped) | 0s |
| 5:00 PM | Final bug fix | Fast | 30s |

**Total deploys:** 6  
**Fast deploys:** 5 (2.5 minutes)  
**Full rebuilds:** 1 (3 minutes)  
**Total time:** 5.5 minutes vs 18-30 minutes (if all full rebuilds)

---

## 🚨 Troubleshooting

### Fast Deploy Failed
**Symptom:** App doesn't start after fast deploy

**Common Causes:**
1. Dependency changed but not in `package.json`
2. Build errors in TypeScript
3. Environment variable missing

**Solution:**
```bash
# Force a full rebuild
./scripts/rebuild-instance.sh
```

### Full Rebuild Taking Too Long
**Symptom:** Rebuild takes >10 minutes

**Common Causes:**
1. Slow npm install (many dependencies)
2. Docker cache not working
3. Server low on resources

**Solution:**
```bash
# Check server resources
aws ssm start-session --target i-0eeb2f36b052f1228
top
df -h

# Clean up if needed
docker system prune -a -f
```

---

## 💡 Tips for Faster Deployments

### 1. Batch Your Changes
```bash
# Instead of 5 separate pushes (5 x 30s = 2.5 min)
git commit -m "Fix 1"
git push
# ... wait ...
git commit -m "Fix 2"
git push

# Do this (1 x 30s = 30s)
git commit -m "Fix 1"
git commit -m "Fix 2"
git push  # Both changes deploy together
```

### 2. Test Locally First
```bash
# Run tests before pushing
npm test

# Build locally to catch errors
npm run build

# Then push
git push
```

### 3. Use Feature Branches
```bash
# Develop in feature branch (no auto-deploy)
git checkout -b feature/new-feature
# ... make many commits ...

# When ready, merge to main (triggers deploy)
git checkout main
git merge feature/new-feature
git push
```

### 4. Skip CI for Docs
The workflow already skips these files:
- `docs/**`
- `*.md`
- `.gitignore`

So updating documentation won't trigger any deployment!

---

## 📖 Related Documentation

- **Setup Guide:** `docs/AUTO_DEPLOY_SETUP.md`
- **Rebuild Guide:** `docs/REBUILD_GUIDE.md`
- **Main README:** `README.md`

---

## ✅ Summary

| When | Use | Time |
|------|-----|------|
| Code changes | **Fast Deploy** | 30s |
| Dependency changes | **Full Rebuild** | 3-5min |
| Not sure? | **Let workflow decide** | Auto |

The smart workflow chooses the right method automatically - you just push! 🚀

