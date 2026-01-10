# Cloudflare DNS Setup Guide

## Overview

This guide shows you how to configure Cloudflare DNS for your PocketBase Multi-Project Server.

## DNS Records Required

After deployment, add these records to your Cloudflare DNS:

### Record 1: Base Domain

```
Type: A
Name: pocketbase
Content: <YOUR_EC2_IP>
TTL: Auto
Proxy status: DNS only (grey cloud) ⚠️ IMPORTANT
```

**Full domain:** `pocketbase.yourdomain.com`

### Record 2: Wildcard Subdomain

```
Type: A
Name: *.pocketbase
Content: <YOUR_EC2_IP>
TTL: Auto
Proxy status: DNS only (grey cloud) ⚠️ IMPORTANT
```

**Matches:** `manager.pocketbase.yourdomain.com`, `client1.pocketbase.yourdomain.com`, etc.

## ⚠️ CRITICAL: Proxy Status

**Must be "DNS only" (grey cloud icon), NOT proxied (orange cloud)**

Why?
- Let's Encrypt needs direct access to verify domain ownership
- SSL certificates are handled by Traefik on your server
- Cloudflare proxy would interfere with SSL verification

### How to Set DNS Only:

1. Click the orange cloud icon next to each record
2. It should turn grey
3. Shows "DNS only" when grey

## Visual Guide

```
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare DNS Records                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Type │ Name           │ Content        │ Proxy │ TTL       │
│──────┼────────────────┼────────────────┼───────┼───────────│
│ A    │ pocketbase     │ 3.84.123.456   │ ☁️     │ Auto      │
│ A    │ *.pocketbase   │ 3.84.123.456   │ ☁️     │ Auto      │
│                                                             │
│ ☁️ = Grey cloud (DNS only) - REQUIRED                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Step-by-Step in Cloudflare

1. **Log into Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com
   - Select your domain (e.g., `yourdomain.com`)

2. **Go to DNS Section**
   - Click "DNS" in the left sidebar
   - Click "Add record"

3. **Add Base Record**
   - Type: `A`
   - Name: `pocketbase`
   - IPv4 address: `<your EC2 IP from terraform output>`
   - Click the **orange cloud** to make it **grey** (DNS only)
   - Click "Save"

4. **Add Wildcard Record**
   - Click "Add record" again
   - Type: `A`
   - Name: `*.pocketbase` (include the asterisk and dot)
   - IPv4 address: `<same EC2 IP>`
   - Click the **orange cloud** to make it **grey** (DNS only)
   - Click "Save"

## Verification

After adding records:

### Check DNS Propagation (2-5 minutes)

```bash
# Check base domain
dig pocketbase.yourdomain.com

# Check wildcard
dig manager.pocketbase.yourdomain.com

# Check from external DNS
dig @8.8.8.8 pocketbase.yourdomain.com
```

Should return your EC2 IP address.

### Test HTTPS (after DNS propagates)

```bash
# Health check
curl https://manager.pocketbase.yourdomain.com/api/health

# Should return:
# {"success":true,"data":{"status":"healthy",...}}
```

## Troubleshooting

### "SSL Certificate Error"

**Cause:** DNS not propagated yet, or proxy enabled

**Fix:**
1. Wait 5-10 minutes for DNS propagation
2. Verify records show **grey cloud** (not orange)
3. Check Traefik logs: `ssh into server → docker logs traefik`
4. Let's Encrypt needs 60 seconds to verify domain

### "DNS Not Resolving"

**Cause:** Records not added or typo in name

**Fix:**
1. Verify records in Cloudflare dashboard
2. Name should be exactly: `pocketbase` (not `pocketbase.yourdomain.com`)
3. Wildcard should be: `*.pocketbase` (with asterisk and dot)

### "Connection Refused"

**Cause:** Server still setting up, or security group issue

**Fix:**
1. Wait 10 minutes for server setup to complete
2. Check server logs:
   ```bash
   aws ssm start-session --target <instance-id>
   tail -f /var/log/user-data.log
   ```

### "Cloudflare 525 Error"

**Cause:** Proxy is enabled (orange cloud)

**Fix:**
1. Go to DNS records
2. Click orange cloud to turn it grey
3. Wait 2 minutes for SSL to initialize

## Alternative: Cloudflare API (Advanced)

If you want to automate DNS updates:

```bash
# Get your Cloudflare Zone ID and API Token
ZONE_ID="your-zone-id"
API_TOKEN="your-api-token"
EC2_IP="your-ec2-ip"

# Add base record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "pocketbase",
    "content": "'$EC2_IP'",
    "ttl": 1,
    "proxied": false
  }'

# Add wildcard record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "*.pocketbase",
    "content": "'$EC2_IP'",
    "ttl": 1,
    "proxied": false
  }'
```

## Domain Structure Overview

```
yourdomain.com
└── pocketbase.yourdomain.com          (Base - points to EC2)
    ├── manager.pocketbase.yourdomain.com     (Management API)
    ├── traefik.pocketbase.yourdomain.com     (Traefik Dashboard)
    ├── client1.pocketbase.yourdomain.com     (Client 1's DB)
    ├── client2.pocketbase.yourdomain.com     (Client 2's DB)
    └── *.pocketbase.yourdomain.com           (All future clients)
```

## Security Notes

1. **Manager API** - Protected by API key
2. **Traefik Dashboard** - Should add basic auth (see production config)
3. **Client PocketBase** - Each has own admin authentication
4. **SSL Certificates** - Auto-renewed every 90 days by Let's Encrypt

## After DNS Setup

Once DNS is configured and propagated:

1. ✅ Wait 5-10 minutes for Let's Encrypt to get certificates
2. ✅ Test: `curl https://manager.pocketbase.yourdomain.com/api/health`
3. ✅ Create your first project via API
4. ✅ Access client projects at their subdomains

## Questions?

See main README.md or AWS_QUICKSTART.md for more details.

