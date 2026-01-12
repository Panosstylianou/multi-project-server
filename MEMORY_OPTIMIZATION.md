# Memory Optimization Guide

## 🚨 Issue: High Memory Usage Alert (98%)

**Root Cause:** The monitoring service was using `os.freemem()` which doesn't account for Linux's disk cache/buffers. Linux caches disk data in RAM (which is **reclaimable**), making it appear as "used" memory when it's actually available.

**Status:** ✅ **FIXED** - Monitoring now reads `/proc/meminfo` for accurate memory calculation.

---

## 📊 Memory Usage Breakdown

### **Typical Memory Usage (2GB EC2 Instance):**

```
Total Memory: 2GB
├─ System (OS + kernel): ~300-400 MB
├─ Docker Daemon: ~50-100 MB
├─ PocketBase Manager: ~50 MB
├─ Traefik: ~20-30 MB
├─ PocketBase Databases: ~50-100 MB each
└─ Available for cache/buffers: ~800 MB - 1.2 GB
```

### **After Fix:**
- **Before:** 98% reported (incorrectly counting cache as "used")
- **After:** ~30-50% actual usage (accurate calculation)

---

## 🔧 Fixes Applied

### 1. **Accurate Memory Monitoring** ✅
- Now reads `/proc/meminfo` for Linux systems
- Uses `MemAvailable` instead of just `MemFree`
- Accounts for reclaimable cache/buffers

### 2. **Container Memory Limits** ⚙️
All new containers get default limits:
- **PocketBase databases:** 256 MB (configurable)
- **Manager:** 512 MB
- **Traefik:** 256 MB

### 3. **Alert Thresholds** ✅
- **Warning:** 80% memory usage
- **Critical:** 95% memory usage
- Now accurate with proper memory calculation

---

## 🛠️ Apply Memory Limits to Existing Containers

Run this script to add limits to containers created before this fix:

```bash
chmod +x scripts/add-memory-limits.sh
./scripts/add-memory-limits.sh

# For remote Docker (production):
export DOCKER_HOST=tcp://localhost:2375
./scripts/add-memory-limits.sh
```

---

## 📈 EC2 Instance Sizing Recommendations

### **Current Setup: t2.micro (1GB RAM) or t2.small (2GB RAM)**

| **# of Databases** | **Recommended Instance** | **Memory** | **Monthly Cost** |
|-------------------|------------------------|-----------|-----------------|
| 1-3 databases | t2.small | 2 GB | ~$17/month |
| 4-8 databases | t3.small | 2 GB | ~$15/month (better perf) |
| 8-15 databases | t3.medium | 4 GB | ~$30/month |
| 15-30 databases | t3.large | 8 GB | ~$60/month |

### **Memory Planning:**
```
Base System: ~500 MB
+ PocketBase Manager: ~50 MB
+ Traefik: ~30 MB
+ Each Database: ~100-150 MB (average)
+ Overhead (cache, buffers): ~500 MB minimum
```

**Formula:** `Required RAM = 580 MB + (# of databases × 125 MB) + 500 MB buffer`

**Example:**
- 5 databases: 580 + (5 × 125) + 500 = **1,705 MB** → t2.small (2GB) ✅
- 10 databases: 580 + (10 × 125) + 500 = **2,330 MB** → t3.medium (4GB) ✅

---

## 🎯 Memory Optimization Tips

### **1. Adjust Per-Database Memory Limits**

For light-usage databases:
```bash
# Create database with lower memory limit
POST /api/projects
{
  "name": "Light Database",
  "config": {
    "memoryLimit": "128m"  # Lower limit for low-traffic databases
  }
}
```

For high-traffic databases:
```bash
# Create database with higher memory limit
POST /api/projects
{
  "name": "Heavy Database",
  "config": {
    "memoryLimit": "512m"  # Higher limit for busy databases
  }
}
```

### **2. Monitor Container Memory**

```bash
# Check real-time memory usage
docker stats

# Check specific container
docker stats pocketbase-chords-master

# Check memory limits
docker inspect <container> --format '{{.HostConfig.Memory}}'
```

### **3. Set System-Wide Defaults**

Edit `.env`:
```bash
# Default memory limit for new databases
DEFAULT_MEMORY_LIMIT=256m

# For lighter usage:
DEFAULT_MEMORY_LIMIT=128m

# For heavier usage:
DEFAULT_MEMORY_LIMIT=512m
```

### **4. Enable Swap (Production)**

Add swap space to handle temporary spikes:
```bash
# On EC2 instance (via SSH)
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 🚀 Best Practices

### **For Development:**
- No memory limits needed (unlimited resources)
- Monitor for memory leaks during testing

### **For Production:**
1. **Set memory limits** on all containers
2. **Monitor regularly** via dashboard
3. **Size instance** based on # of databases
4. **Add swap** for spike protection
5. **Scale up** before hitting 70% sustained usage

### **Signs You Need More Memory:**
- ⚠️ Sustained >70% memory usage
- ⚠️ Frequent memory warnings
- ⚠️ OOM (Out of Memory) kills in logs
- ⚠️ Slow container performance

### **How to Scale:**
```bash
# Option 1: Upgrade EC2 instance type
# - Stop instance
# - Change instance type via AWS Console
# - Start instance (keeps Elastic IP)

# Option 2: Optimize current usage
# - Lower memory limits for light databases
# - Move databases to separate instances
# - Enable swap space
```

---

## 📝 Monitoring Commands

### **Check System Memory:**
```bash
# Accurate memory (Linux)
cat /proc/meminfo | grep -E 'MemTotal|MemAvailable'

# Docker host memory
docker run --rm alpine free -h

# Via API
curl http://localhost:3002/api/monitoring
```

### **Check Container Memory:**
```bash
# All containers
docker stats --no-stream

# Specific container with limits
docker inspect pocketbase-chords-master --format '{{.HostConfig.Memory}}'
```

### **Check for Memory Issues:**
```bash
# OOM (Out of Memory) kills in logs
docker logs pocketbase-manager | grep -i "killed\|oom"

# System logs (on EC2 via SSH)
dmesg | grep -i "out of memory\|oom"
```

---

## ✅ Verification

After applying fixes, verify:

1. **Memory calculation is accurate:**
   ```bash
   curl http://localhost:3002/api/monitoring | jq '.data.system.memory'
   ```
   
2. **No false alerts:**
   ```bash
   curl http://localhost:3002/api/monitoring | jq '.data.alerts'
   ```

3. **Containers have limits:**
   ```bash
   ./scripts/add-memory-limits.sh
   ```

---

## 🎉 Summary

**What was wrong:**
- ❌ Monitoring counted Linux disk cache as "used"
- ❌ Reported 98% when actual usage was ~30%
- ❌ False critical alerts

**What's fixed:**
- ✅ Accurate memory calculation via `/proc/meminfo`
- ✅ Container memory limits enforced
- ✅ Proper alert thresholds
- ✅ Monitoring dashboard shows real usage

**Result:** No more false memory alerts! 🎊

