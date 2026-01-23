#!/bin/bash
# Verify admin users exist in PocketBase databases
# Usage: ./scripts/verify-admin-users.sh

set -e

# AWS connection details
PROD_HOST="${AWS_HOST:-13.135.181.201}"
PROD_USER="${AWS_USER:-ec2-user}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/bettermap-key.pem}"

echo "🔍 Verifying admin users in PocketBase databases..."
echo ""

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
  echo "❌ SSH key not found: $SSH_KEY"
  exit 1
fi

# Databases to check (format: container:domain:email)
check_database() {
  local CONTAINER="$1"
  local DOMAIN="$2"
  local EMAIL="$3"
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Container: $CONTAINER"
  echo "   Domain: $DOMAIN"
  echo "   Expected Email: $EMAIL"
  echo ""
  
  # Check if container exists
  if ! ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker ps -a --format '{{.Names}}' | grep -q '^${CONTAINER}$'" 2>/dev/null; then
    echo "❌ Container not found"
    echo ""
    return
  fi
  
  # Check if container is running
  if ! ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker ps --format '{{.Names}}' | grep -q '^${CONTAINER}$'" 2>/dev/null; then
    echo "⚠️  Container is not running"
    echo ""
    return
  fi
  
  # List admin users
  echo "📋 Listing admin users..."
  ADMIN_LIST=$(ssh -i "$SSH_KEY" "$PROD_USER@$PROD_HOST" "docker exec $CONTAINER /usr/local/bin/pocketbase superuser list" 2>&1)
  
  if echo "$ADMIN_LIST" | grep -q "$EMAIL"; then
    echo "✅ Admin user '$EMAIL' found!"
    echo "$ADMIN_LIST" | grep "$EMAIL" || echo "$ADMIN_LIST"
  else
    echo "❌ Admin user '$EMAIL' NOT found!"
    echo ""
    echo "Available admins:"
    echo "$ADMIN_LIST" || echo "  (could not list admins)"
    echo ""
    echo "💡 To create the admin user, run:"
    echo "   ./scripts/fix-admin-user-remote.sh $DOMAIN $EMAIL BetterMapRules8"
  fi
  
  echo ""
}

# Check each database
check_database "pocketbase-api" "api.db.oceannet.dev" "hello@oceannet.dev"
check_database "pocketbase-chords-master" "chords-master.db.oceannet.dev" "hello@oceannet.dev"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Verification complete"
