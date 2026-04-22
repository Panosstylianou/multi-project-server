#!/usr/bin/env bash
# Sets up oceannet.dev DNS records in Cloudflare.
#
# Usage:
#   CF_API_TOKEN=<token> CF_ZONE_ID=<zone_id> bash scripts/setup-cloudflare-dns.sh
#
# Get your Zone ID: Cloudflare Dashboard → oceannet.dev → Overview (right sidebar)
# Create API token: Cloudflare Dashboard → My Profile → API Tokens → Create Token
#   → "Edit zone DNS" template → limit to oceannet.dev zone
set -euo pipefail

: "${CF_API_TOKEN:?Set CF_API_TOKEN}"
: "${CF_ZONE_ID:?Set CF_ZONE_ID}"

BASE="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records"

cf() {
  curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" \
       -H "Content-Type: application/json" "$@"
}

ok() { echo "  ✓ $*"; }
info() { echo "→ $*"; }

# ── Helpers ──────────────────────────────────────────────────────────────────

get_record_id() {
  local type="$1" name="$2"
  cf "${BASE}?type=${type}&name=${name}.oceannet.dev&per_page=1" \
    | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null
}

add_record() {
  local body="$1"
  local result
  result=$(cf -X POST "$BASE" -d "$body")
  if python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d['success'] else 1)" <<< "$result" 2>/dev/null; then
    local name
    name=$(python3 -c "import sys,json; print(json.load(sys.stdin)['result']['name'])" <<< "$result" 2>/dev/null)
    ok "Added $name"
  else
    local err
    err=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errors',d))" <<< "$result" 2>/dev/null)
    echo "  ✗ Failed: $err"
  fi
}

update_proxy() {
  local type="$1" name="$2" proxied="$3"
  local id
  id=$(get_record_id "$type" "$name")
  if [[ -z "$id" ]]; then
    echo "  ✗ Record not found: $type $name"
    return
  fi
  cf -X PATCH "${BASE}/${id}" -d "{\"proxied\":${proxied}}" > /dev/null
  ok "Set $type $name proxied=$proxied"
}

delete_record() {
  local type="$1" name="$2"
  local id
  id=$(get_record_id "$type" "$name")
  if [[ -z "$id" ]]; then
    ok "Not found (already gone): $type $name"
    return
  fi
  cf -X DELETE "${BASE}/${id}" > /dev/null
  ok "Deleted $type $name"
}

# ── 1. Fix proxy status on auto-imported records ──────────────────────────────
info "Fixing proxy status..."
update_proxy "A"     "db"         "false"
update_proxy "CNAME" "autoconfig" "false"

# ── 2. Delete GoDaddy-internal record ────────────────────────────────────────
info "Removing GoDaddy internal record..."
delete_record "CNAME" "_domainconnect"

# ── 3. Add missing records ────────────────────────────────────────────────────
info "Adding missing A records..."
add_record '{"type":"A","name":"*.db","content":"13.135.181.201","proxied":false,"ttl":3600}'
add_record '{"type":"A","name":"lavoro","content":"185.158.133.1","proxied":false,"ttl":600}'
add_record '{"type":"A","name":"lochias","content":"185.158.133.1","proxied":false,"ttl":3600}'

info "Adding missing Migadu DKIM records..."
add_record '{"type":"CNAME","name":"key1._domainkey","content":"key1.oceannet.dev._domainkey.migadu.com","proxied":false,"ttl":3600}'
add_record '{"type":"CNAME","name":"key2._domainkey","content":"key2.oceannet.dev._domainkey.migadu.com","proxied":false,"ttl":3600}'
add_record '{"type":"CNAME","name":"key3._domainkey","content":"key3.oceannet.dev._domainkey.migadu.com","proxied":false,"ttl":3600}'

info "Adding preview subdomain ACM validation..."
add_record '{"type":"CNAME","name":"_d74dba7b2b2007058a65ed3a2e433a77.preview","content":"_dd8966048655513ae030aecb28a942b1.jkddzztszm.acm-validations.aws","proxied":false,"ttl":3600}'

info "Adding preview NS delegation..."
add_record '{"type":"NS","name":"preview","content":"ns-1296.awsdns-34.org","ttl":3600}'
add_record '{"type":"NS","name":"preview","content":"ns-1549.awsdns-01.co.uk","ttl":3600}'
add_record '{"type":"NS","name":"preview","content":"ns-509.awsdns-63.com","ttl":3600}'
add_record '{"type":"NS","name":"preview","content":"ns-807.awsdns-36.net","ttl":3600}'

info "Adding missing Migadu SRV record..."
add_record '{"type":"SRV","name":"_submissions._tcp","data":{"priority":0,"weight":1,"port":465,"target":"smtp.migadu.com"},"ttl":3600}'

# ── 4. Add Amplify / ACM records ──────────────────────────────────────────────
info "Adding Amplify CloudFront records..."
add_record '{"type":"CNAME","name":"oceannet.dev","content":"d2w8xweclare78.cloudfront.net","proxied":false,"ttl":3600}'
add_record '{"type":"CNAME","name":"www","content":"d2w8xweclare78.cloudfront.net","proxied":false,"ttl":3600}'

info "Adding ACM cert validation record..."
add_record '{"type":"CNAME","name":"_50292f848668930f79a404e85155f39b","content":"_7e362a93a3ceaa6a92499327ec8c3fc3.jkddzztszm.acm-validations.aws","proxied":false,"ttl":3600}'

echo ""
echo "Done. Verify at: https://dash.cloudflare.com/?to=/:account/oceannet.dev/dns"
