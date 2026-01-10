#!/bin/bash
set -e

# Script to rebuild EC2 instance while keeping the same Elastic IP
# This is useful when you need to redeploy with changes but don't want to update DNS

cat << 'EOF'

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     REBUILD EC2 INSTANCE (Keep Same IP)                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

This script will:
1. Taint the EC2 instance (mark for replacement)
2. Apply Terraform to recreate just the instance
3. Keep the same Elastic IP address (no DNS changes needed!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

# Change to terraform directory
cd "$(dirname "$0")/../terraform"

# Get current IP before rebuild
CURRENT_IP=$(terraform output -raw server_public_ip)
echo "Current Elastic IP: $CURRENT_IP"
echo ""
echo "⚠️  This IP will remain the same after rebuild!"
echo ""

# Confirm with user
read -p "Continue with instance rebuild? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Tainting instance for replacement..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
terraform taint aws_instance.server
terraform taint aws_eip_association.server
terraform taint aws_volume_attachment.data

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Applying changes (this will recreate the instance)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
terraform apply -auto-approve

# Verify IP didn't change
NEW_IP=$(terraform output -raw server_public_ip)
NEW_INSTANCE=$(terraform output -raw server_instance_id)

echo ""
cat << EOF

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          ✅ INSTANCE REBUILT SUCCESSFULLY!                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

📊 RESULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Previous IP:     $CURRENT_IP
Current IP:      $NEW_IP
New Instance:    $NEW_INSTANCE

✅ IP address unchanged - no DNS updates needed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏱️  SETUP TIMELINE:

The new instance is now:
• Installing Docker...       (2-3 min)
• Cloning GitHub repo...     (1-2 min)
• Building Docker image...   (3-5 min)
• Starting containers...     (1 min)
• Getting SSL certificates... (1-2 min)

TOTAL: ~10 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 MONITOR PROGRESS:

aws ssm start-session --target $NEW_INSTANCE

Then:
sudo tail -f /var/log/user-data.log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TEST AFTER ~10 MINUTES:

curl https://manager.db.oceannet.dev/api/health

EOF

