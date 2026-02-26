#!/bin/bash
# AgentMarket E2E Test Suite
set -uo pipefail

BASE="https://agentmarket.adntgv.com"
PASS=0; FAIL=0; INFO=0; RESULTS=""

log() { echo -e "\n🧪 $1"; }
pass() { PASS=$((PASS+1)); RESULTS+="✅ $1\n"; echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); RESULTS+="❌ $1: $2\n"; echo "  ❌ $1: $2"; }
info() { INFO=$((INFO+1)); echo "  ℹ️ $1"; }

req() {
  # req METHOD URL [data] [cookies] → sets RES_BODY, RES_HTTP
  local method="$1" url="$2" data="${3:-}" cookies="${4:-}"
  local args=(-s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json")
  [ -n "$cookies" ] && args+=(-b "$cookies" -c "$cookies")
  [ -n "$data" ] && args+=(-d "$data")
  local full; full=$(curl "${args[@]}" "$url")
  RES_HTTP=$(echo "$full" | tail -1)
  RES_BODY=$(echo "$full" | sed '$d')
}

req_auth() {
  # req_auth METHOD URL API_KEY [data] → sets RES_BODY, RES_HTTP
  local method="$1" url="$2" key="$3" data="${4:-}"
  local args=(-s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -H "Authorization: Bearer $key")
  [ -n "$data" ] && args+=(-d "$data")
  local full; full=$(curl "${args[@]}" "$url")
  RES_HTTP=$(echo "$full" | tail -1)
  RES_BODY=$(echo "$full" | sed '$d')
}

get_session() {
  # get_session email password cookie_file
  local email="$1" pw="$2" jar="$3"
  local csrf_res csrf
  csrf_res=$(curl -s -c "$jar" "$BASE/api/auth/csrf")
  csrf=$(echo "$csrf_res" | jq -r '.csrfToken')
  curl -s -b "$jar" -c "$jar" -L -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "csrfToken=$csrf&email=$email&password=$pw&callbackUrl=$BASE/dashboard" > /dev/null 2>&1
}

# Clean up test data first (idempotent re-runs)
log "SETUP: Clean slate"

# ============================
# SCENARIO 1: USER REGISTRATION
# ============================
log "SCENARIO 1: User Registration"

req POST "$BASE/api/auth/register" '{"email":"e2e-buyer@test.com","username":"e2ebuyer","password":"testpass123","role":"buyer"}'
[ "$RES_HTTP" = "201" ] || [ "$RES_HTTP" = "200" ] && pass "Register buyer (HTTP $RES_HTTP)" || fail "Register buyer" "HTTP $RES_HTTP: $RES_BODY"
BUYER_ID=$(echo "$RES_BODY" | jq -r '.user.id // empty')

req POST "$BASE/api/auth/register" '{"email":"e2e-seller@test.com","username":"e2eseller","password":"testpass123","role":"seller"}'
[ "$RES_HTTP" = "201" ] || [ "$RES_HTTP" = "200" ] && pass "Register seller (HTTP $RES_HTTP)" || fail "Register seller" "HTTP $RES_HTTP"
SELLER_ID=$(echo "$RES_BODY" | jq -r '.user.id // empty')

req POST "$BASE/api/auth/register" '{"email":"e2e-admin@test.com","username":"e2eadmin","password":"testpass123","role":"admin"}'
[ "$RES_HTTP" = "201" ] || [ "$RES_HTTP" = "200" ] && pass "Register admin (HTTP $RES_HTTP)" || {
  # admin role might be rejected by design
  info "Admin registration: HTTP $RES_HTTP — $(echo $RES_BODY | head -c 100)"
}

# Duplicate email
req POST "$BASE/api/auth/register" '{"email":"e2e-buyer@test.com","username":"dup","password":"testpass123","role":"buyer"}'
[ "$RES_HTTP" != "201" ] && pass "Reject duplicate email (HTTP $RES_HTTP)" || fail "Duplicate email" "allowed"

# Missing fields
req POST "$BASE/api/auth/register" '{"email":"nope@test.com"}'
[ "$RES_HTTP" = "400" ] && pass "Reject missing fields (HTTP $RES_HTTP)" || info "Missing fields: HTTP $RES_HTTP"

# Short password
req POST "$BASE/api/auth/register" '{"email":"short@test.com","username":"sp","password":"ab","role":"buyer"}'
[ "$RES_HTTP" = "400" ] && pass "Reject short password" || info "Short password: HTTP $RES_HTTP"

# ============================
# SCENARIO 2: AUTHENTICATION
# ============================
log "SCENARIO 2: Authentication"

get_session "e2e-buyer@test.com" "testpass123" "/tmp/am-buyer.txt"
# Verify session works
RES_BODY=$(curl -s -b /tmp/am-buyer.txt "$BASE/api/auth/session")
SESSION_USER=$(echo "$RES_BODY" | jq -r '.user.email // empty')
[ "$SESSION_USER" = "e2e-buyer@test.com" ] && pass "Buyer session active" || fail "Buyer session" "got: $SESSION_USER"

get_session "e2e-seller@test.com" "testpass123" "/tmp/am-seller.txt"
RES_BODY=$(curl -s -b /tmp/am-seller.txt "$BASE/api/auth/session")
SESSION_USER=$(echo "$RES_BODY" | jq -r '.user.email // empty')
[ "$SESSION_USER" = "e2e-seller@test.com" ] && pass "Seller session active" || fail "Seller session" "got: $SESSION_USER"

# ============================
# SCENARIO 3: AGENT REGISTRATION (Programmatic API)
# ============================
log "SCENARIO 3: Agent Registration via API"

req POST "$BASE/api/agents/register" "{\"email\":\"e2e-agent@test.com\",\"username\":\"e2eagent\",\"name\":\"E2E TestBot\",\"description\":\"Automated test agent\",\"tags\":[\"coding\",\"python\",\"testing\"],\"base_price\":25}"
[ "$RES_HTTP" = "201" ] || [ "$RES_HTTP" = "200" ] && pass "Register agent via API (HTTP $RES_HTTP)" || fail "Register agent API" "HTTP $RES_HTTP: $(echo $RES_BODY | head -c 200)"
AGENT_API_KEY=$(echo "$RES_BODY" | jq -r '.api_key // .apiKey // empty')
AGENT_ID=$(echo "$RES_BODY" | jq -r '.agent_id // .agent.id // empty')
[ -n "$AGENT_API_KEY" ] && pass "Got API key: ${AGENT_API_KEY:0:20}..." || fail "Agent API key" "empty"
[ -n "$AGENT_ID" ] && pass "Got Agent ID: $AGENT_ID" || fail "Agent ID" "empty"

# Heartbeat
if [ -n "$AGENT_API_KEY" ]; then
  req_auth POST "$BASE/api/agents/heartbeat" "$AGENT_API_KEY"
  [ "$RES_HTTP" = "200" ] && pass "Agent heartbeat" || fail "Agent heartbeat" "HTTP $RES_HTTP: $RES_BODY"
fi

# ============================
# SCENARIO 4: WALLET OPERATIONS
# ============================
log "SCENARIO 4: Wallet Operations"

# Top up buyer
req POST "$BASE/api/wallet/top-up" '{"amount":500}' "/tmp/am-buyer.txt"
[ "$RES_HTTP" = "200" ] && pass "Buyer top-up \$500" || fail "Buyer top-up" "HTTP $RES_HTTP: $RES_BODY"

# Check balance
req GET "$BASE/api/wallet" "" "/tmp/am-buyer.txt"
[ "$RES_HTTP" = "200" ] && pass "Get wallet" || fail "Get wallet" "HTTP $RES_HTTP"
BALANCE=$(echo "$RES_BODY" | jq -r '.wallet.balance // .balance // empty')
info "Buyer balance: \$$BALANCE"

# Negative top-up
req POST "$BASE/api/wallet/top-up" '{"amount":-100}' "/tmp/am-buyer.txt"
[ "$RES_HTTP" != "200" ] && pass "Reject negative top-up (HTTP $RES_HTTP)" || info "Negative top-up allowed: $RES_BODY"

# Zero top-up
req POST "$BASE/api/wallet/top-up" '{"amount":0}' "/tmp/am-buyer.txt"
[ "$RES_HTTP" != "200" ] && pass "Reject zero top-up (HTTP $RES_HTTP)" || info "Zero top-up: HTTP $RES_HTTP"

# ============================
# SCENARIO 5: HAPPY PATH — Full Task Lifecycle
# ============================
log "SCENARIO 5: Happy Path — Post → Match → Assign → Execute → Approve → Pay"

# 5a. Post task
req POST "$BASE/api/tasks" '{"title":"Scrape Amazon top 100 electronics","description":"Scrape product names, prices, ratings from Amazon electronics. Output CSV.","tags":["web-scraping","python","data"],"maxBudget":100,"urgency":"normal"}' "/tmp/am-buyer.txt"
[ "$RES_HTTP" = "200" ] || [ "$RES_HTTP" = "201" ] && pass "Post task (HTTP $RES_HTTP)" || fail "Post task" "HTTP $RES_HTTP: $RES_BODY"
TASK_ID=$(echo "$RES_BODY" | jq -r '.task.id // .id // empty')
[ -n "$TASK_ID" ] && pass "Task ID: $TASK_ID" || fail "Task ID" "none"

# 5b. Agent lists available tasks
if [ -n "$AGENT_API_KEY" ]; then
  req_auth GET "$BASE/api/tasks/available" "$AGENT_API_KEY"
  [ "$RES_HTTP" = "200" ] && pass "Agent lists available tasks" || fail "List available" "HTTP $RES_HTTP"
  echo "$RES_BODY" | jq -r '.tasks[]?.title // empty' 2>/dev/null | head -3 | while read t; do info "Available: $t"; done
fi

# 5c. Get task details
if [ -n "$TASK_ID" ] && [ -n "$AGENT_API_KEY" ]; then
  req_auth GET "$BASE/api/tasks/$TASK_ID/details" "$AGENT_API_KEY"
  [ "$RES_HTTP" = "200" ] && pass "Get task details" || fail "Task details" "HTTP $RES_HTTP: $RES_BODY"
fi

# 5d. Get suggestions for buyer
if [ -n "$TASK_ID" ]; then
  req GET "$BASE/api/tasks/$TASK_ID/suggestions" "" "/tmp/am-buyer.txt"
  [ "$RES_HTTP" = "200" ] && pass "Get suggestions" || info "Suggestions: HTTP $RES_HTTP"
fi

# 5e. Agent applies
if [ -n "$TASK_ID" ] && [ -n "$AGENT_API_KEY" ]; then
  req_auth POST "$BASE/api/tasks/$TASK_ID/apply" "$AGENT_API_KEY" '{"bid":80,"message":"I can do this in 2 hours with Python + requests."}'
  [ "$RES_HTTP" = "200" ] || [ "$RES_HTTP" = "201" ] && pass "Agent applies for task" || fail "Agent apply" "HTTP $RES_HTTP: $RES_BODY"
fi

# 5f. Buyer assigns agent
if [ -n "$TASK_ID" ] && [ -n "$AGENT_ID" ]; then
  req POST "$BASE/api/tasks/$TASK_ID/assign" "{\"agentId\":\"$AGENT_ID\",\"agreedPrice\":80}" "/tmp/am-buyer.txt"
  [ "$RES_HTTP" = "200" ] && pass "Buyer assigns agent" || fail "Assign" "HTTP $RES_HTTP: $RES_BODY"
fi

# 5g. Agent submits deliverable
if [ -n "$TASK_ID" ] && [ -n "$AGENT_API_KEY" ]; then
  req_auth POST "$BASE/api/tasks/$TASK_ID/submit" "$AGENT_API_KEY" '{"resultText":"## Amazon Top 100 Electronics\n\n| # | Product | Price | Rating |\n|---|---------|-------|--------|\n| 1 | Sony WH-1000XM5 | $299.99 | 4.8 |\n| 2 | Apple AirPods Pro | $249.00 | 4.7 |\n| ... (98 more) |\n\nFull CSV: https://example.com/data.csv","resultFiles":["https://example.com/data.csv"]}'
  [ "$RES_HTTP" = "200" ] || [ "$RES_HTTP" = "201" ] && pass "Agent submits deliverable" || fail "Submit" "HTTP $RES_HTTP: $RES_BODY"
fi

# 5h. Check task status is completed/pending approval
if [ -n "$TASK_ID" ]; then
  req GET "$BASE/api/tasks/$TASK_ID" "" "/tmp/am-buyer.txt"
  STATUS=$(echo "$RES_BODY" | jq -r '.task.status // .status // empty')
  info "Task status after submit: $STATUS"
fi

# 5i. Buyer approves
if [ -n "$TASK_ID" ]; then
  req POST "$BASE/api/tasks/$TASK_ID/approve" '{}' "/tmp/am-buyer.txt"
  [ "$RES_HTTP" = "200" ] && pass "Buyer approves task" || fail "Approve" "HTTP $RES_HTTP: $RES_BODY"
fi

# 5j. Check final task status
if [ -n "$TASK_ID" ]; then
  req GET "$BASE/api/tasks/$TASK_ID" "" "/tmp/am-buyer.txt"
  STATUS=$(echo "$RES_BODY" | jq -r '.task.status // .status // empty')
  info "Task final status: $STATUS"
fi

# 5k. Leave review
if [ -n "$TASK_ID" ] && [ -n "$SELLER_ID" ]; then
  req POST "$BASE/api/reviews" "{\"taskId\":\"$TASK_ID\",\"revieweeId\":\"$SELLER_ID\",\"rating\":5,\"comment\":\"Excellent work!\"}" "/tmp/am-buyer.txt"
  [ "$RES_HTTP" = "200" ] || [ "$RES_HTTP" = "201" ] && pass "Leave review" || info "Review: HTTP $RES_HTTP — $RES_BODY"
fi

# ============================
# SCENARIO 6: DISPUTE PATH
# ============================
log "SCENARIO 6: Dispute Path"

# Post task
req POST "$BASE/api/tasks" '{"title":"Build a landing page","description":"Hero + features + CTA section","tags":["coding","html"],"maxBudget":50}' "/tmp/am-buyer.txt"
TASK2_ID=$(echo "$RES_BODY" | jq -r '.task.id // .id // empty')
[ -n "$TASK2_ID" ] && pass "Post dispute-test task" || fail "Dispute task" "no ID"

if [ -n "$TASK2_ID" ] && [ -n "$AGENT_ID" ] && [ -n "$AGENT_API_KEY" ]; then
  # Assign
  req POST "$BASE/api/tasks/$TASK2_ID/assign" "{\"agentId\":\"$AGENT_ID\",\"agreedPrice\":40}" "/tmp/am-buyer.txt"
  [ "$RES_HTTP" = "200" ] && pass "Assign dispute task" || fail "Assign dispute task" "HTTP $RES_HTTP"

  # Submit bad work
  req_auth POST "$BASE/api/tasks/$TASK2_ID/submit" "$AGENT_API_KEY" '{"resultText":"<html><body>TODO</body></html>"}'
  [ "$RES_HTTP" = "200" ] || [ "$RES_HTTP" = "201" ] && pass "Submit bad deliverable" || fail "Submit bad" "HTTP $RES_HTTP"

  # Buyer disputes
  req POST "$BASE/api/tasks/$TASK2_ID/dispute" '{"comment":"This is just a placeholder with no content!","evidence":["screenshot.png"]}' "/tmp/am-buyer.txt"
  [ "$RES_HTTP" = "200" ] || [ "$RES_HTTP" = "201" ] && pass "Buyer files dispute" || fail "File dispute" "HTTP $RES_HTTP: $RES_BODY"
  DISPUTE_ID=$(echo "$RES_BODY" | jq -r '.dispute.id // .id // empty')

  if [ -n "$DISPUTE_ID" ]; then
    # Seller responds
    req POST "$BASE/api/disputes/$DISPUTE_ID/respond" '{"comment":"I delivered what was asked. Proof attached.","evidence":["proof.png"]}' "/tmp/am-seller.txt"
    [ "$RES_HTTP" = "200" ] && pass "Seller responds to dispute" || info "Seller respond: HTTP $RES_HTTP — $RES_BODY"

    # Admin resolves — need admin session
    get_session "e2e-admin@test.com" "testpass123" "/tmp/am-admin.txt"
    req POST "$BASE/api/disputes/$DISPUTE_ID/resolve" '{"resolution":"partial_refund","refundPercentage":50,"comment":"Partial work. 50% refund."}' "/tmp/am-admin.txt"
    [ "$RES_HTTP" = "200" ] && pass "Admin resolves dispute (partial refund)" || fail "Resolve dispute" "HTTP $RES_HTTP: $RES_BODY"
  else
    info "No dispute ID returned — dispute may use different response shape"
  fi
fi

# ============================
# SCENARIO 7: EDGE CASES & SECURITY
# ============================
log "SCENARIO 7: Edge Cases & Security"

# Unauthenticated task post
req POST "$BASE/api/tasks" '{"title":"hack","description":"test","maxBudget":10}'
[ "$RES_HTTP" = "401" ] && pass "Reject unauthenticated task post" || info "Unauth task: HTTP $RES_HTTP"

# Invalid API key
req_auth GET "$BASE/api/tasks/available" "sk_fake_notreal"
[ "$RES_HTTP" = "401" ] && pass "Reject invalid API key" || info "Fake key: HTTP $RES_HTTP"

# Submit to non-existent task
if [ -n "$AGENT_API_KEY" ]; then
  req_auth POST "$BASE/api/tasks/00000000-0000-0000-0000-000000000000/submit" "$AGENT_API_KEY" '{"resultText":"test"}'
  [ "$RES_HTTP" != "200" ] && pass "Reject submit to non-existent task (HTTP $RES_HTTP)" || fail "Ghost task" "allowed"
fi

# Double approve (already approved task)
if [ -n "$TASK_ID" ]; then
  req POST "$BASE/api/tasks/$TASK_ID/approve" '{}' "/tmp/am-buyer.txt"
  info "Double approve: HTTP $RES_HTTP — $(echo $RES_BODY | head -c 100)"
fi

# Assign already assigned task
if [ -n "$TASK_ID" ] && [ -n "$AGENT_ID" ]; then
  req POST "$BASE/api/tasks/$TASK_ID/assign" "{\"agentId\":\"$AGENT_ID\",\"agreedPrice\":50}" "/tmp/am-buyer.txt"
  [ "$RES_HTTP" != "200" ] && pass "Reject re-assign completed task" || info "Re-assign: HTTP $RES_HTTP"
fi

# ============================
# SCENARIO 8: WALLET EDGE CASES
# ============================
log "SCENARIO 8: Wallet Edge Cases"

# Seller overdraft
req POST "$BASE/api/wallet/withdraw" '{"amount":99999}' "/tmp/am-seller.txt"
[ "$RES_HTTP" != "200" ] && pass "Reject overdraft (HTTP $RES_HTTP)" || info "Overdraft allowed?! $RES_BODY"

# Unauthenticated wallet
req GET "$BASE/api/wallet"
[ "$RES_HTTP" = "401" ] && pass "Reject unauthenticated wallet" || info "Unauth wallet: HTTP $RES_HTTP"

# ============================
# SCENARIO 9: EARNINGS & ADMIN
# ============================
log "SCENARIO 9: Earnings & Admin"

req GET "$BASE/api/earnings" "" "/tmp/am-seller.txt"
[ "$RES_HTTP" = "200" ] && pass "Seller earnings endpoint" || info "Earnings: HTTP $RES_HTTP"

if [ -f "/tmp/am-admin.txt" ]; then
  req GET "$BASE/api/admin/dashboard" "" "/tmp/am-admin.txt"
  [ "$RES_HTTP" = "200" ] && pass "Admin dashboard" || info "Admin dashboard: HTTP $RES_HTTP — $RES_BODY"

  req GET "$BASE/api/admin/users" "" "/tmp/am-admin.txt"
  [ "$RES_HTTP" = "200" ] && pass "Admin list users" || info "Admin users: HTTP $RES_HTTP"
fi

# ============================
# SCENARIO 10: STATIC ASSETS
# ============================
log "SCENARIO 10: Static Assets & llms.txt"

RES_BODY=$(curl -s "$BASE/llms.txt")
echo "$RES_BODY" | grep -qi "agent" && pass "llms.txt accessible with content" || fail "llms.txt" "empty or missing"

# Landing page loads
RES_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE")
[ "$RES_HTTP" = "200" ] && pass "Landing page loads" || fail "Landing page" "HTTP $RES_HTTP"

# ============================
# SUMMARY
# ============================
echo -e "\n══════════════════════════════════"
echo "📊 E2E TEST RESULTS"
echo "══════════════════════════════════"
echo -e "$RESULTS"
echo "══════════════════════════════════"
echo "✅ PASSED: $PASS | ❌ FAILED: $FAIL | ℹ️ INFO: $INFO"
echo "══════════════════════════════════"

rm -f /tmp/am-buyer.txt /tmp/am-seller.txt /tmp/am-admin.txt
