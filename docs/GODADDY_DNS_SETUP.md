# GoDaddy DNS Setup Guide

## Your Server IP: `18.133.25.225`

---

## 🌐 GoDaddy DNS Configuration

### Go to GoDaddy DNS Management

1. Log in to: https://dcc.godaddy.com/
2. Find your domain: **oceannet.dev**
3. Click **DNS** or **Manage DNS**

---

## 📝 Add These 2 Records

### Record 1: Base Subdomain

```
Type:     A
Name:     db
Value:    18.133.25.225
TTL:      1 Hour (or Default/600 seconds)
```

**What it creates:** `db.oceannet.dev`

---

### Record 2: Wildcard Subdomain

```
Type:     A
Name:     *.db
Value:    18.133.25.225
TTL:      1 Hour (or Default/600 seconds)
```

**What it creates:** `*.db.oceannet.dev` (matches all subdomains)

---

## 📸 Visual Guide

### In GoDaddy Interface:

```
┌─────────────────────────────────────────────────────────────┐
│ DNS Management for oceannet.dev                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Add] button                                                │
│                                                             │
│ Record 1:                                                   │
│ ┌──────┬──────┬─────────────────┬──────────────────────┐   │
│ │ Type │ Name │ Value           │ TTL                  │   │
│ ├──────┼──────┼─────────────────┼──────────────────────┤   │
│ │ A    │ db   │ 18.133.25.225   │ 1 Hour               │   │
│ └──────┴──────┴─────────────────┴──────────────────────┘   │
│                                                             │
│ Record 2:                                                   │
│ ┌──────┬──────┬─────────────────┬──────────────────────┐   │
│ │ Type │ Name │ Value           │ TTL                  │   │
│ ├──────┼──────┼─────────────────┼──────────────────────┤   │
│ │ A    │ *.db │ 18.133.25.225   │ 1 Hour               │   │
│ └──────┴──────┴─────────────────┴──────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Step-by-Step Instructions

### Adding Record 1 (Base Domain)

1. Click **"Add"** button in DNS Management
2. Select **Type:** `A`
3. Enter **Name:** `db`
4. Enter **Value:** `18.133.25.225`
5. Set **TTL:** `1 Hour` (or leave default)
6. Click **"Save"**

### Adding Record 2 (Wildcard)

1. Click **"Add"** button again
2. Select **Type:** `A`
3. Enter **Name:** `*.db` (yes, include the asterisk and dot)
4. Enter **Value:** `18.133.25.225`
5. Set **TTL:** `1 Hour` (or leave default)
6. Click **"Save"**

---

## ✅ What These Records Do

### Record 1: `db.oceannet.dev`
Creates the base subdomain for your manager

**Results in:**
- `db.oceannet.dev` → 18.133.25.225

### Record 2: `*.db.oceannet.dev`
Creates wildcard for all client subdomains

**Results in:**
- `manager.db.oceannet.dev` → 18.133.25.225
- `traefik.db.oceannet.dev` → 18.133.25.225
- `acme-corp.db.oceannet.dev` → 18.133.25.225
- `client2.db.oceannet.dev` → 18.133.25.225
- Any subdomain under `db.oceannet.dev` → 18.133.25.225

---

## ⏱️ DNS Propagation Time

**GoDaddy typically takes:**
- **Immediate:** Changes visible in GoDaddy interface
- **5-10 minutes:** Changes propagate to most DNS servers
- **Up to 1 hour:** Full global propagation (TTL dependent)

---

## 🔍 Verify DNS Setup

### After adding records, test propagation:

```bash
# Check if DNS is working
dig db.oceannet.dev

# Should show:
# db.oceannet.dev.    600    IN    A    18.133.25.225

# Check wildcard
dig manager.db.oceannet.dev

# Should also show:
# manager.db.oceannet.dev.    600    IN    A    18.133.25.225
```

### Or use online tools:
- https://www.whatsmydns.net/#A/db.oceannet.dev
- https://dnschecker.org/#A/db.oceannet.dev

---

## 🚫 Common Mistakes to Avoid

### ❌ WRONG - Don't include full domain in Name field
```
Name: db.oceannet.dev     ← WRONG!
```

### ✅ CORRECT - Just the subdomain prefix
```
Name: db                  ← CORRECT!
```

### ❌ WRONG - Wildcard without subdomain
```
Name: *                   ← WRONG! (catches all subdomains)
```

### ✅ CORRECT - Wildcard under your subdomain
```
Name: *.db                ← CORRECT!
```

---

## 🎯 After DNS is Configured

### 1. Wait 10 minutes for:
- DNS propagation
- Server to finish auto-setup
- SSL certificates to activate

### 2. Test your deployment:

```bash
# Test health endpoint
curl https://manager.db.oceannet.dev/api/health

# Should return:
# {"success":true,"data":{"status":"healthy",...}}
```

### 3. Create your first project:

```bash
curl -X POST https://manager.db.oceannet.dev/api/projects \
  -H "Content-Type: application/json" \
  -H "x-api-key: 6362ddb984e89b2049877f7e8c3e8c483348f0c10b9890f29de83018d37bbded" \
  -d '{
    "name": "Test Client",
    "clientName": "Acme Corp"
  }'
```

---

## 🆘 Troubleshooting

### "DNS not resolving"

**Check:**
1. Records saved correctly in GoDaddy
2. Name field has just `db` and `*.db` (not full domain)
3. Wait 5-10 minutes for propagation

**Test:**
```bash
dig db.oceannet.dev @8.8.8.8
```

### "SSL Certificate Error"

**Cause:** DNS not propagated yet, or records incorrect

**Fix:**
1. Verify DNS resolves: `dig db.oceannet.dev`
2. Wait for propagation (up to 1 hour)
3. Check server logs:
   ```bash
   aws ssm start-session --target i-097bba5dd06c81383
   docker logs traefik | grep -i cert
   ```

### "Can't access manager.db.oceannet.dev"

**Check:**
1. DNS for base domain: `dig db.oceannet.dev`
2. DNS for subdomain: `dig manager.db.oceannet.dev`
3. Server finished setup:
   ```bash
   aws ssm start-session --target i-097bba5dd06c81383
   tail -100 /var/log/user-data.log
   ```

---

## 📋 Quick Reference

| Purpose | Type | Name | Value |
|---------|------|------|-------|
| Base domain | A | db | 18.133.25.225 |
| All subdomains | A | *.db | 18.133.25.225 |

**TTL:** 1 Hour (600 seconds) or Default

---

## 🎉 Success Indicators

✅ DNS records saved in GoDaddy  
✅ `dig db.oceannet.dev` returns `18.133.25.225`  
✅ `dig manager.db.oceannet.dev` returns `18.133.25.225`  
✅ `curl https://manager.db.oceannet.dev/api/health` works  
✅ SSL certificates active (https works)  

---

## 🔄 Need to Change IP Later?

If you ever need to update the IP address:

1. Go to GoDaddy DNS Management
2. Find the two A records (`db` and `*.db`)
3. Click **Edit** (pencil icon)
4. Update **Value** to new IP
5. Click **Save**
6. Wait 10-60 minutes for propagation (based on TTL)

---

## 📞 Support

- **GoDaddy DNS Help:** https://www.godaddy.com/help/manage-dns-680
- **Your deployment details:** See `DEPLOYED.md` in project root

