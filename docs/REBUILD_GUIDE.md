# 🔄 Rebuild Instance Guide

## Overview

When you need to redeploy your PocketBase server (for updates, fixes, or configuration changes), you want to **keep the same IP address** so you don't have to update DNS records.

---

## 🎯 The Elastic IP Solution

Your Terraform configuration is now set up with a **persistent Elastic IP** that survives instance replacements.

### What's Different:

✅ **Before:** Each `terraform destroy` + `terraform apply` created a new IP  
✅ **Now:** The Elastic IP persists, only the EC2 instance is replaced

---

## 🚀 How to Rebuild Your Instance

### Option 1: Use the Rebuild Script (Recommended)

```bash
./scripts/rebuild-instance.sh
```

This script will:
1. Mark the instance for replacement
2. Create a new instance
3. Attach the same Elastic IP
4. Keep DNS working without changes

### Option 2: Manual Terraform Commands

```bash
cd terraform

# Taint resources for replacement
terraform taint aws_instance.server
terraform taint aws_eip_association.server
terraform taint aws_volume_attachment.data

# Apply changes
terraform apply -auto-approve
```

---

## ⚠️ What NOT to Do

### ❌ DON'T: Full Destroy

```bash
# This will destroy EVERYTHING including the Elastic IP
terraform destroy  # ❌ Avoid this!
```

If you run `terraform destroy`, you'll get a NEW Elastic IP and need to update DNS.

### ✅ DO: Targeted Replacement

Use the rebuild script or `terraform taint` to replace only the instance.

---

## 🔒 Protecting the Elastic IP

The Elastic IP has a lifecycle policy that can prevent accidental deletion:

```hcl
resource "aws_eip" "server" {
  lifecycle {
    prevent_destroy = true  # Uncomment this line for extra protection
  }
}
```

To enable maximum protection:

1. Edit `terraform/main.tf`
2. Change `prevent_destroy = false` to `prevent_destroy = true`
3. Commit and push

This will prevent Terraform from destroying the EIP even if you run `terraform destroy`.

---

## 📋 Rebuild Scenarios

### Scenario 1: Update Application Code

**When:** You've pushed changes to your GitHub repo

```bash
./scripts/rebuild-instance.sh
```

The new instance will pull the latest code from GitHub and build it.

### Scenario 2: Change Terraform Configuration

**When:** You've modified `main.tf`, `variables.tf`, etc.

```bash
cd terraform
terraform plan   # Review changes
terraform apply  # Apply only necessary changes
```

Terraform will intelligently update only what changed.

### Scenario 3: Fix a Broken Instance

**When:** Something went wrong and the instance isn't working

```bash
./scripts/rebuild-instance.sh
```

Fresh instance, same IP address.

### Scenario 4: Complete Infrastructure Rebuild

**When:** You need to rebuild EVERYTHING (rare)

```bash
cd terraform

# Save the current Elastic IP allocation ID
terraform output -raw server_public_ip
# Note: 13.135.181.201 (allocation ID: eipalloc-04a3216ca51aa8c26)

# Destroy everything
terraform destroy

# Re-deploy
terraform apply

# Update DNS with new IP
```

⚠️ **Only do this if absolutely necessary!** You'll need to update DNS records.

---

## 🧪 Testing After Rebuild

Wait ~10 minutes after rebuild, then test:

```bash
# Check if server is responding
curl https://manager.db.oceannet.dev/api/health

# Expected response:
# {"success":true,"data":{"status":"healthy",...}}
```

### Monitor Build Progress

```bash
# Get new instance ID
cd terraform
NEW_INSTANCE=$(terraform output -raw server_instance_id)

# Connect via SSM
aws ssm start-session --target $NEW_INSTANCE

# Inside the session:
sudo tail -f /var/log/user-data.log
```

Look for:
- ✓ "Cloning into '/tmp/multi-project-server'..."
- ✓ "Successfully built [image-id]"
- ✓ "Container pocketbase-manager  Started"
- ✓ "Container traefik  Started"

---

## 🎯 Current Elastic IP

Your permanent Elastic IP: **`13.135.181.201`**

This IP is configured in GoDaddy DNS:
- `db.oceannet.dev` → `13.135.181.201`
- `*.db.oceannet.dev` → `13.135.181.201`

As long as you use the rebuild script or targeted replacement, this IP will never change.

---

## 💡 Pro Tips

### Tip 1: Always Commit Before Rebuilding

```bash
git status
git add .
git commit -m "Changes before rebuild"
git push
```

The instance pulls from GitHub, so uncommitted local changes won't be deployed.

### Tip 2: Tag Your Releases

```bash
git tag -a v1.0.0 -m "Initial production release"
git push origin v1.0.0
```

This helps track which version is deployed.

### Tip 3: Keep Terraform State Safe

Your `terraform.tfstate` is in the `terraform/` directory. **Never delete this file!**

Consider backing it up to S3:

```bash
# Add to .gitignore (already done)
echo "terraform/terraform.tfstate" >> .gitignore

# Backup to S3
aws s3 cp terraform/terraform.tfstate s3://your-backup-bucket/terraform-state/
```

---

## 🆘 Troubleshooting

### Problem: "Elastic IP already associated"

**Solution:** The EIP is already attached. Just run `terraform apply` to fix the state.

```bash
cd terraform
terraform refresh
terraform apply
```

### Problem: "Instance is still running after rebuild"

**Solution:** The old instance takes ~30 seconds to terminate.

```bash
# Check instance status
aws ec2 describe-instances --instance-ids OLD_INSTANCE_ID \
  --query 'Reservations[0].Instances[0].State.Name'
```

### Problem: "New instance but same IP, SSL not working"

**Solution:** SSL certificates take 2-3 minutes to generate. Wait and check Traefik logs.

```bash
docker logs traefik | grep -i certificate
```

---

## 📚 Related Documentation

- **Main README:** `README.md`
- **Deployment Details:** `DEPLOYED.md`
- **AWS Setup:** `docs/AWS_SETUP.md`
- **DNS Setup:** `docs/GODADDY_DNS_SETUP.md`

---

## ✅ Summary

| Task | Command | IP Changes? |
|------|---------|-------------|
| Rebuild instance | `./scripts/rebuild-instance.sh` | ❌ No |
| Update Terraform | `terraform apply` | ❌ No (usually) |
| Full destroy | `terraform destroy` + `apply` | ✅ Yes |

**Best Practice:** Always use `rebuild-instance.sh` when possible!

