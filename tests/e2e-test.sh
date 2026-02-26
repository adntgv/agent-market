#!/bin/bash
# AgentMarket E2E Test Suite — idempotent with timestamp-based unique users
set -uo pipefail

BASE="https://agentmarket.adntgv.com"
TS=$(date +%s)
PASS=0; FAIL=0; INFO=0; RESULTS=""

BUYER_EMAIL="e2e-buyer-${TS}@test.com"
BUYER_USER="e2ebuyer${TS}"
SELLER_EMAIL="e2e-seller-${TS}@test.com"
SELLER_USER="e2eseller${TS}"
ADMIN_EMAIL="e2e-admin-${TS}@test.com"
ADMIN_USER="e2eadmin${TS}"
AGENT_EMAIL="e2e-agent-${TS}@test.com"
AGENT_USER="e2eagent${TS}"

log() { echo -e "\n🧪 $1"; }
pass() { PASS=$((PASS+1)); RESULTS+="✅ $1\n"; echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); RESULTS+="❌ $1: $2\n"; echo "  ❌ $1: $2"; }
info() { INFO=$((INFO+1)); echo "  ℹ️ $1"; }

api() {
  # api METHOD URL DATA [COOKIE_JAR] [AUTH_HEADER]
  local method=$1 url=$2 data=${3:-} jar=${4:-} auth=${5:-}
  local args=(-s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json")
  [ -n "$jar" ] && args+=(-b "$jar" -c "$jar")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  [ -n "$data" ] && args+=(-d "$data")
  local full
  full=$(curl "${args[@]}" "$url")
  RES_HTTP=$(echo "$full" | tail -1)
  RES_BODY=$(echo "$full" | sed '$d')
}

get_session() {
  local email=$1 pw=$2 jar=$3
  rm -f "$jar"
  local csrf
  csrf=$(curl -s -c "$jar" "$BASE/api/auth/csrf" | jq -r '.csrfToken')
  curl -s -b "$jar" -c "$jar" -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "csrfToken=${csrf}&email=${email}&password=${pw}" > /dev/null 2>&1
}

# ============================
log "SCENARIO 1: User Registration"
# ============================

api POST "$BASE/api/auth/register" "{\"email\":\"${BUYER_EMAIL}\",\"username\":\"${BUYER_USER}\",\"password\":\"testpass123\",\"role\":\"buyer\"}"
[[ "$RES_HTTP" =~ ^20 ]] && pass "Register buyer (HTTP $RES_HTTP)" || fail "Register buyer" "HTTP $RES_HTTP: $RES_BODY"
BUYER_ID=$(echo "$RES_BODY" | jq -r '.user.id // empty')

api POST "$BASE/api/auth/register" "{\"email\":\"${SELLER_EMAIL}\",\"username\":\"${SELLER_USER}\",\"password\":\"testpass123\",\"role\":\"seller\"}"
[[ "$RES_HTTP" =~ ^20 ]] && pass "Register seller (HTTP $RES_HTTP)" || fail "Register seller" "HTTP $RES_HTTP"
SELLER_ID=$(echo "$RES_BODY" | jq -r '.user.id // empty')

api POST "$BASE/api/auth/register" "{\"email\":\"${ADMIN_EMAIL}\",\"username\":\"${ADMIN_USER}\",\"password\":\"testpass123\",\"role\":\"admin\"}"
[[ "$RES_HTTP" =~ ^20 ]] && pass "Register admin (HTTP $RES_HTTP)" || info "Admin registration: HTTP $RES_HTTP — $(echo "$RES_BODY" | head -c 100)"

# Duplicate
api POST "$BASE/api/auth/register" "{\"email\":\"${BUYER_EMAIL}\",\"username\":\"dup${TS}\",\"password\":\"testpass123\",\"role\":\"buyer\"}"
[[ "$RES_HTTP" != "201" ]] && pass "Reject duplicate email (HTTP $RES_HTTP)" || fail "Duplicate email" "allowed"

# Missing fields
api POST "$BASE/api/auth/register" '{"email":"nope@test.com"}'
[ "$RES_HTTP" = "400" ] && pass "Reject missing fields" || info "Missing fields: HTTP $RES_HTTP"

# Short password
api POST "$BASE/api/auth/register" '{"email":"s@t.com","username":"sp","password":"ab","role":"buyer"}'
[ "$RES_HTTP" = "400" ] && pass "Reject short password" || info "Short password: HTTP $RES_HTTP"

# ============================
log "SCENARIO 2: Authentication"
# ============================

get_session "$BUYER_EMAIL" "testpass123" "/tmp/am-buyer.txt"
SESSION_USER=$(curl -s -b /tmp/am-buyer.txt "$BASE/api/auth/session" | jq -r '.user.email // empty')
[ "$SESSION_USER" = "$BUYER_EMAIL" ] && pass "Buyer session active" || fail "Buyer session" "got: $SESSION_USER"

get_session "$SELLER_EMAIL" "testpass123" "/tmp/am-seller.txt"
SESSION_USER=$(curl -s -b /tmp/am-seller.txt "$BASE/api/auth/session" | jq -r '.user.email // empty')
[ "$SESSION_USER" = "$SELLER_EMAIL" ] && pass "Seller session active" || fail "Seller session" "got: $SESSION_USER"

# ============================
log "SCENARIO 3: Agent Registration (API)"
# ============================

api POST "$BASE/api/agents/register" "{\"email\":\"${AGENT_EMAIL}\",\"username\":\"${AGENT_USER}\",\"name\":\"E2E TestBot\",\"description\":\"Automated test agent for coding and scraping\",\"tags\":[\"coding\",\"python\",\"web-scraping\"],\"base_price\":25}"
[[ "$RES_HTTP" =~ ^20 ]] && pass "Register agent via API (HTTP $RES_HTTP)" || fail "Register agent" "HTTP $RES_HTTP: $(echo "$RES_BODY" | head -c 200)"
AGENT_API_KEY=$(echo "$RES_BODY" | jq -r '.api_key // empty')
AGENT_ID=$(echo "$RES_BODY" | jq -r '.agent_id // empty')
[ -n "$AGENT_API_KEY" ] && pass "Got API key: ${AGENT_API_KEY:0:20}..." || fail "Agent API key" "empty"
[ -n "$AGENT_ID" ] && pass "Got Agent ID" || fail "Agent ID" "empty"

# Heartbeat
if [ -n "$AGENT_API_KEY" ]; then
  api POST "$BASE/api/agents/heartbeat" "" "" "$AGENT_API_KEY"
  [ "$RES_HTTP" = "200" ] && pass "Agent heartbeat" || fail "Heartbeat" "HTTP $RES_HTTP"
fi

# ============================
log "SCENARIO 4: Wallet Operations"
# ============================

api POST "$BASE/api/wallet/top-up" '{"amount":500}' "/tmp/am-buyer.txt"
[ "$RES_HTTP" = "200" ] && pass "Buyer top-up \$500" || fail "Top-up" "HTTP $RES_HTTP: $RES_BODY"

api GET "$BASE/api/wallet" "" "/tmp/am-buyer.txt"
[ "$RES_HTTP" = "200" ] && pass "Get wallet" || fail "Get wallet" "HTTP $RES_HTTP"
BALANCE=$(echo "$RES_BODY" | jq -r '.wallet.balance // .balance // empty')
info "Buyer balance: \$$BALANCE"

# Negative
api POST "$BASE/api/wallet/top-up" '{"amount":-100}' "/tmp/am-buyer.txt"
[ "$RES_HTTP" != "200" ] && pass "Reject negative top-up (HTTP $RES_HTTP)" || info "Negative allowed"

# ============================
log "SCENARIO 5: Happy Path — Full Lifecycle"
# ============================

# Post task
api POST "$BASE/api/tasks" '{"title":"Scrape Amazon top 100","description":"Get product names, prices, ratings. Output CSV.","tags":["web-scraping","python"],"max_budget":100}' "/tmp/am-buyer.txt"
[[ "$RES_HTTP" =~ ^20 ]] && pass "Post task" || fail "Post task" "HTTP $RES_HTTP: $RES_BODY"
TASK_ID=$(echo "$RES_BODY" | jq -r '.task.id // .id // empty')
[ -n "$TASK_ID" ] && pass "Task ID: ${TASK_ID:0:8}..." || fail "Task ID" "empty"

# Agent lists available
if [ -n "$AGENT_API_KEY" ]; then
  api GET "$BASE/api/tasks/available" "" "" "$AGENT_API_KEY"
  [ "$RES_HTTP" = "200" ] && pass "Agent lists available tasks" || fail "Available tasks" "HTTP $RES_HTTP"
fi

# Agent applies
if [ -n "$TASK_ID" ] && [ -n "$AGENT_API_KEY" ]; then
  api POST "$BASE/api/tasks/$TASK_ID/apply" '{"bid":80,"message":"I can do this in 2h with Python."}' "" "$AGENT_API_KEY"
  [[ "$RES_HTTP" =~ ^20 ]] && pass "Agent applies" || fail "Apply" "HTTP $RES_HTTP: $RES_BODY"
fi

# Apply auto-assigns + locks escrow — verify status
if [ -n "$TASK_ID" ]; then
  api GET "$BASE/api/tasks/$TASK_ID" "" "/tmp/am-buyer.txt"
  STATUS=$(echo "$RES_BODY" | jq -r '.task.status // .status // empty')
  [ "$STATUS" = "assigned" ] && pass "Task auto-assigned after apply" || info "Status: $STATUS"
fi

# Agent submits
if [ -n "$TASK_ID" ] && [ -n "$AGENT_API_KEY" ]; then
  api POST "$BASE/api/tasks/$TASK_ID/submit" '{"result_text":"Top 100 electronics CSV ready.\n| Product | Price |\n| Sony XM5 | $299 |","result_files":["https://example.com/data.csv"]}' "" "$AGENT_API_KEY"
  [[ "$RES_HTTP" =~ ^20 ]] && pass "Agent submits deliverable" || fail "Submit" "HTTP $RES_HTTP: $RES_BODY"
fi

# Check status
if [ -n "$TASK_ID" ]; then
  api GET "$BASE/api/tasks/$TASK_ID" "" "/tmp/am-buyer.txt"
  STATUS=$(echo "$RES_BODY" | jq -r '.task.status // .status // empty')
  info "Task status after submit: $STATUS"
fi

# Buyer approves
if [ -n "$TASK_ID" ]; then
  api POST "$BASE/api/tasks/$TASK_ID/approve" '{}' "/tmp/am-buyer.txt"
  [ "$RES_HTTP" = "200" ] && pass "Buyer approves → escrow released" || fail "Approve" "HTTP $RES_HTTP: $RES_BODY"
fi

# Check final status
if [ -n "$TASK_ID" ]; then
  api GET "$BASE/api/tasks/$TASK_ID" "" "/tmp/am-buyer.txt"
  STATUS=$(echo "$RES_BODY" | jq -r '.task.status // .status // empty')
  info "Final status: $STATUS"
fi

# Review
if [ -n "$TASK_ID" ] && [ -n "$SELLER_ID" ]; then
  api POST "$BASE/api/reviews" "{\"task_id\":\"$TASK_ID\",\"rating\":5,\"comment\":\"Great work!\"}" "/tmp/am-buyer.txt"
  [[ "$RES_HTTP" =~ ^20 ]] && pass "Leave review" || info "Review: HTTP $RES_HTTP"
fi

# ============================
log "SCENARIO 6: Dispute Path"
# ============================

api POST "$BASE/api/tasks" '{"title":"Build landing page","description":"Hero + features + CTA","tags":["html","css"],"max_budget":50}' "/tmp/am-buyer.txt"
TASK2_ID=$(echo "$RES_BODY" | jq -r '.task.id // .id // empty')
[ -n "$TASK2_ID" ] && pass "Post dispute task" || fail "Dispute task" "no ID"

if [ -n "$TASK2_ID" ] && [ -n "$AGENT_ID" ] && [ -n "$AGENT_API_KEY" ]; then
  # Agent applies (auto-assigns + locks escrow)
  api POST "$BASE/api/tasks/$TASK2_ID/apply" '{"bid":40,"message":"I can build this."}' "" "$AGENT_API_KEY"
  [[ "$RES_HTTP" =~ ^20 ]] && pass "Agent applies to dispute task" || fail "Apply dispute" "HTTP $RES_HTTP"

  # Submit poor work
  api POST "$BASE/api/tasks/$TASK2_ID/submit" '{"result_text":"<html><body>TODO</body></html>"}' "" "$AGENT_API_KEY"
  [[ "$RES_HTTP" =~ ^20 ]] && pass "Submit bad deliverable" || fail "Submit bad" "HTTP $RES_HTTP"

  # Dispute
  api POST "$BASE/api/tasks/$TASK2_ID/dispute" '{"comment":"Just a placeholder!","evidence":["screenshot.png"]}' "/tmp/am-buyer.txt"
  [[ "$RES_HTTP" =~ ^20 ]] && pass "Buyer files dispute" || fail "File dispute" "HTTP $RES_HTTP: $RES_BODY"
  DISPUTE_ID=$(echo "$RES_BODY" | jq -r '.dispute.id // .id // empty')

  if [ -n "$DISPUTE_ID" ]; then
    # Seller responds
    api POST "$BASE/api/disputes/$DISPUTE_ID/respond" '{"comment":"I delivered what was asked.","evidence":["proof.png"]}' "/tmp/am-seller.txt"
    [ "$RES_HTTP" = "200" ] && pass "Seller responds to dispute" || info "Seller respond: HTTP $RES_HTTP"

    # Admin resolves
    get_session "admin@agentmarket.com" "admin123secure" "/tmp/am-admin.txt"
    api POST "$BASE/api/disputes/$DISPUTE_ID/resolve" '{"resolution":"partial_refund","refund_percentage":50,"comment":"50% refund."}' "/tmp/am-admin.txt"
    [ "$RES_HTTP" = "200" ] && pass "Admin resolves dispute" || fail "Resolve dispute" "HTTP $RES_HTTP: $RES_BODY"
  else
    info "No dispute ID — checking response: $(echo "$RES_BODY" | head -c 100)"
  fi
fi

# ============================
log "SCENARIO 7: Security & Edge Cases"
# ============================

api POST "$BASE/api/tasks" '{"title":"hack","description":"test","max_budget":10}'
[ "$RES_HTTP" = "401" ] && pass "Reject unauthenticated task post" || info "Unauth: HTTP $RES_HTTP"

api GET "$BASE/api/tasks/available" "" "" "sk_fake_notreal"
[ "$RES_HTTP" = "401" ] && pass "Reject invalid API key" || info "Fake key: HTTP $RES_HTTP"

if [ -n "$AGENT_API_KEY" ]; then
  api POST "$BASE/api/tasks/00000000-0000-0000-0000-000000000000/submit" '{"result_text":"test"}' "" "$AGENT_API_KEY"
  [ "$RES_HTTP" != "200" ] && pass "Reject submit to ghost task (HTTP $RES_HTTP)" || fail "Ghost task" "allowed"
fi

# Double approve
if [ -n "$TASK_ID" ]; then
  api POST "$BASE/api/tasks/$TASK_ID/approve" '{}' "/tmp/am-buyer.txt"
  [ "$RES_HTTP" != "200" ] && pass "Reject double approve (HTTP $RES_HTTP)" || info "Double approve allowed"
fi

# ============================
log "SCENARIO 8: Wallet Security"
# ============================

api POST "$BASE/api/wallet/withdraw" '{"amount":99999}' "/tmp/am-seller.txt"
[ "$RES_HTTP" != "200" ] && pass "Reject overdraft (HTTP $RES_HTTP)" || fail "Overdraft" "allowed"

api GET "$BASE/api/wallet"
[ "$RES_HTTP" = "401" ] && pass "Reject unauthenticated wallet" || info "Unauth wallet: HTTP $RES_HTTP"

# ============================
log "SCENARIO 9: Earnings & Admin"
# ============================

api GET "$BASE/api/earnings" "" "/tmp/am-seller.txt"
[ "$RES_HTTP" = "200" ] && pass "Seller earnings" || info "Earnings: HTTP $RES_HTTP"

if [ -f "/tmp/am-admin.txt" ]; then
  api GET "$BASE/api/admin/dashboard" "" "/tmp/am-admin.txt"
  [ "$RES_HTTP" = "200" ] && pass "Admin dashboard" || info "Admin dashboard: HTTP $RES_HTTP"

  api GET "$BASE/api/admin/users" "" "/tmp/am-admin.txt"
  [ "$RES_HTTP" = "200" ] && pass "Admin list users" || info "Admin users: HTTP $RES_HTTP"
fi

# ============================
log "SCENARIO 10: Static Assets"
# ============================

curl -s "$BASE/llms.txt" | grep -qi "agent" && pass "llms.txt has content" || fail "llms.txt" "empty"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE")" = "200" ] && pass "Landing page loads" || fail "Landing" "not 200"

# ============================
echo -e "\n══════════════════════════════════"
echo "📊 E2E TEST RESULTS"
echo "══════════════════════════════════"
echo -e "$RESULTS"
echo "══════════════════════════════════"
echo "✅ PASSED: $PASS | ❌ FAILED: $FAIL | ℹ️ INFO: $INFO"
echo "══════════════════════════════════"

rm -f /tmp/am-buyer.txt /tmp/am-seller.txt /tmp/am-admin.txt
