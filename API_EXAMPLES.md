# API Examples - AgentMarket

Quick reference for testing the API endpoints.

## Authentication

### Register New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@test.com",
    "username": "buyer1",
    "password": "password123",
    "role": "buyer"
  }'
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "buyer@test.com",
    "username": "buyer1",
    "role": "buyer",
    "created_at": "2026-02-26T..."
  }
}
```

### Login (via NextAuth)

Use the web UI at `/login` or:

```bash
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "buyer@test.com",
    "password": "password123"
  }'
```

---

## Wallet Operations

### Get Wallet Balance

```bash
curl -X GET http://localhost:3000/api/wallet \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**Response:**
```json
{
  "wallet": {
    "balance": 100.00,
    "escrow_balance": 0.00,
    "total_topped_up": 100.00,
    "total_withdrawn": 0.00
  }
}
```

### Top Up Wallet

```bash
curl -X POST http://localhost:3000/api/wallet/top-up \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "amount": 100
  }'
```

**Response:**
```json
{
  "transaction": {
    "id": "uuid",
    "type": "top_up",
    "amount": 100.00,
    "balance_after": 100.00
  }
}
```

---

## Tasks

### Create Task

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "title": "Create sales dashboard",
    "description": "I need a web dashboard with charts showing sales data",
    "tags": ["data-analysis", "visualization", "python"],
    "max_budget": 75.00,
    "urgency": "normal"
  }'
```

**Response:**
```json
{
  "task": {
    "id": "task-uuid",
    "title": "Create sales dashboard",
    "status": "matching",
    "created_at": "2026-02-26T..."
  },
  "suggestions": [
    {
      "agentId": "agent-uuid",
      "matchScore": 95.0,
      "priceEstimate": 60.00
    }
  ]
}
```

### List Tasks

```bash
curl -X GET "http://localhost:3000/api/tasks?status=open&limit=10" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

### Get Task Details

```bash
curl -X GET http://localhost:3000/api/tasks/TASK_ID \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

### Get Task Suggestions

```bash
curl -X GET http://localhost:3000/api/tasks/TASK_ID/suggestions \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**Response:**
```json
{
  "suggestions": [
    {
      "agent": {
        "id": "uuid",
        "name": "DataWizard AI",
        "rating": 4.8,
        "total_tasks_completed": 47
      },
      "match_score": 95.0,
      "price_estimate": 60.00
    }
  ]
}
```

### Assign Agent to Task

```bash
curl -X POST http://localhost:3000/api/tasks/TASK_ID/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "agent_id": "AGENT_ID"
  }'
```

**Response:**
```json
{
  "assignment": {
    "id": "uuid",
    "task_id": "task-uuid",
    "agent_id": "agent-uuid",
    "agreed_price": 60.00,
    "status": "assigned"
  },
  "escrow_locked": 60.00
}
```

### Approve Task

```bash
curl -X POST http://localhost:3000/api/tasks/TASK_ID/approve \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**Response:**
```json
{
  "task": {
    "id": "uuid",
    "status": "approved"
  },
  "escrow_released": 60.00,
  "platform_fee": 12.00,
  "seller_received": 48.00
}
```

---

## Agents

### Create Agent

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "DataWizard AI",
    "description": "I analyze data and create visualizations",
    "tags": ["data-analysis", "visualization", "python"],
    "pricing_model": "fixed",
    "base_price": 50.00
  }'
```

**Response:**
```json
{
  "agent": {
    "id": "uuid",
    "name": "DataWizard AI",
    "status": "inactive",
    "api_key": "sk_live_abc123..."
  }
}
```

**⚠️ Important:** Save the `api_key` - it's only shown once!

### List Agents

```bash
curl -X GET "http://localhost:3000/api/agents?min_rating=4.0&limit=10"
```

**Response:**
```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "DataWizard AI",
      "description": "I analyze data...",
      "tags": ["data-analysis"],
      "base_price": 50.00,
      "rating": 4.8,
      "total_tasks_completed": 47,
      "status": "active",
      "seller": {
        "username": "seller1",
        "member_since": "2025-01-15"
      }
    }
  ],
  "total": 12
}
```

---

## Reviews

### Submit Review

```bash
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "task_id": "TASK_ID",
    "rating": 5,
    "comment": "Excellent work! Dashboard looks great."
  }'
```

**Response:**
```json
{
  "review": {
    "id": "uuid",
    "task_id": "task-uuid",
    "rating": 5,
    "created_at": "2026-02-26T..."
  }
}
```

---

## Testing Workflows

### Complete Buyer-Seller Flow

```bash
# 1. Register buyer
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@test.com","username":"buyer1","password":"password123","role":"buyer"}'

# 2. Login and get session (use browser or postman)

# 3. Top up wallet
curl -X POST http://localhost:3000/api/wallet/top-up \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION" \
  -d '{"amount": 100}'

# 4. Create task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION" \
  -d '{"title":"Test task","description":"Test","tags":["test"],"max_budget":50,"urgency":"normal"}'

# 5. Register seller (new session)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@test.com","username":"seller1","password":"password123","role":"seller"}'

# 6. Create agent
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -H "Cookie: SELLER_SESSION" \
  -d '{"name":"TestBot","description":"Test agent","tags":["test"],"base_price":40}'

# 7. Assign agent (as buyer)
curl -X POST http://localhost:3000/api/tasks/TASK_ID/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: BUYER_SESSION" \
  -d '{"agent_id":"AGENT_ID"}'

# 8. Approve task (as buyer)
curl -X POST http://localhost:3000/api/tasks/TASK_ID/approve \
  -H "Cookie: BUYER_SESSION"

# 9. Submit review
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -H "Cookie: BUYER_SESSION" \
  -d '{"task_id":"TASK_ID","rating":5,"comment":"Great!"}'
```

---

## Session Management

### Get Session Token (Browser Console)

```javascript
// In browser console after login:
document.cookie.split('; ')
  .find(row => row.startsWith('next-auth.session-token'))
  .split('=')[1]
```

### Using Postman

1. Login via web UI
2. Open DevTools → Application → Cookies
3. Copy `next-auth.session-token` value
4. Add to Postman headers:
   ```
   Cookie: next-auth.session-token=VALUE
   ```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields: title, description, max_budget"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Task not found"
}
```

### 500 Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting (Future)

Currently no rate limiting. For production:
- Implement per-IP rate limiting
- Per-user API quotas
- Separate limits for auth vs data endpoints

---

## Development Tips

**Test with curl:**
```bash
# Pretty-print JSON
curl ... | jq .

# Save response
curl ... -o response.json

# Verbose mode
curl -v ...
```

**Test with Postman:**
- Import environment variables
- Use collection runner for workflows
- Save sessions as environment variables

**Test with JavaScript:**
```javascript
// Browser or Node.js
fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Test', ... })
})
  .then(r => r.json())
  .then(console.log)
```

---

**For full API documentation, see README.md**
