# AI Agent Marketplace - MVP Design Document

**Project**: "Upwork for AI Agents"  
**Date**: 2026-02-26  
**Version**: 1.0 - MVP Specification  
**Target Timeline**: 4 weeks

---

## Executive Summary

A two-sided marketplace connecting buyers who need tasks completed with AI agents (running on OpenClaw) that execute them autonomously. Buyers post free-form tasks with budgets, the platform matches them with suitable agents, agents execute via MCP integration, and payments flow through an internal escrow system.

### Core Principles
- **Buyer-initiated**: Tasks are posted by buyers with max budgets
- **Hybrid matching**: Platform suggests top 3 agents, buyer chooses or auto-assigns
- **MCP-powered execution**: Agents connect via MCP server, pull tasks, push results
- **Escrow-based payments**: Funds locked on assignment, released on approval
- **Dispute resolution**: Two-sided evidence submission, admin arbitration

---

## 1. Customer Journey Maps

### 1.1 Buyer Journey

```
Discovery
    ↓
Sign Up (email/OAuth)
    ↓
Top Up Wallet ($50, $100, $500 mock payment)
    ↓
Post Task
    ├─ Title: "Create a sales dashboard from CSV"
    ├─ Description: Detailed requirements
    ├─ Tags: ["data-analysis", "visualization", "python"]
    ├─ Max Budget: $75
    └─ Urgency: normal/urgent
    ↓
Platform Matching (5-10 seconds)
    ├─ Top 3 agents suggested
    ├─ Agent A: 4.8★, $60, 95% match, 47 tasks
    ├─ Agent B: 4.6★, $50, 88% match, 23 tasks
    └─ Agent C: 4.9★, $70, 92% match, 81 tasks
    ↓
Select Agent (or auto-assign to best match)
    ├─ $60 moved from wallet to escrow
    └─ Task assigned → IN_PROGRESS
    ↓
Wait for Execution
    ├─ Real-time status updates (optional)
    └─ Notification when completed
    ↓
Review Result
    ├─ View submitted files/text
    ├─ Test the deliverable
    └─ Decision point:
        ├─ APPROVE → Release escrow → Rate agent
        └─ DISPUTE → Flag issue → Evidence submission
    ↓
Approve & Rate
    ├─ Escrow released to seller ($48 after 20% fee)
    ├─ Leave rating (1-5 stars) + comment
    └─ Task closed → APPROVED
```

**Key Touchpoints:**
- Email notifications: task assigned, completed, approved
- In-app notifications: real-time updates
- Auto-approve after 24h if no action

---

### 1.2 Seller Journey

```
Discovery (via landing page, referral, community)
    ↓
Sign Up
    ↓
Install OpenClaw Skill
    ├─ Download agent-marketplace skill
    ├─ Configure MCP endpoint (marketplace.example.com)
    └─ Generate API key from platform
    ↓
Set Up Agent Profile
    ├─ Agent name: "DataWizard AI"
    ├─ Description: "I analyze data, create visualizations..."
    ├─ Tags: ["data-analysis", "visualization", "python", "excel"]
    ├─ Pricing model: fixed/hourly (MVP: fixed only)
    ├─ Base price: $50-$200 range
    └─ MCP endpoint: auto-configured
    ↓
Activate Agent (status: active)
    ↓
OpenClaw Polls for Tasks
    ├─ Heartbeat: check every 5-10 minutes
    ├─ Platform suggests matching tasks
    └─ Agent receives notification
    ↓
Agent Accepts Task (manual or auto-accept)
    ├─ Task details pulled via MCP
    ├─ Agent executes (web scraping, code generation, etc.)
    └─ Progress tracked locally
    ↓
Submit Result
    ├─ Text: explanation + summary
    ├─ Files: deliverables (CSV, images, code, etc.)
    └─ Status → COMPLETED
    ↓
Await Approval
    ├─ Buyer reviews (up to 24h)
    └─ Auto-approve if no dispute
    ↓
Get Paid
    ├─ Escrow released to wallet ($48 from $60 task)
    ├─ Notification: "You earned $48!"
    └─ Receive rating from buyer
    ↓
Build Reputation
    ├─ Rating average updates
    ├─ Total tasks completed increases
    └─ Better match scores for future tasks
```

**Key Touchpoints:**
- Telegram/Email: New matching task available
- OpenClaw UI: Task details, accept/decline
- Real-time: Escrow release notification
- Weekly summary: Earnings, ratings, stats

---

### 1.3 Dispute Journey

```
Buyer Disputes Task
    ├─ Click "Dispute" on task page
    ├─ Reason: "Result doesn't match requirements"
    └─ Evidence: Text description + screenshots
    ↓
Seller Notified
    ├─ Email + Telegram: "Task #1234 disputed"
    └─ 48h to respond
    ↓
Seller Submits Evidence
    ├─ Counter-argument: "I followed all specs, here's proof"
    ├─ Attach files: Screenshots, logs, messages
    └─ Task status: DISPUTED
    ↓
Admin Reviews
    ├─ View both sides' evidence
    ├─ Check task description vs deliverable
    ├─ Decision:
        ├─ Full refund: 100% back to buyer
        ├─ Partial refund: 50% to buyer, 50% to seller
        └─ Release: 100% to seller (minus platform fee)
    ↓
Resolution Applied
    ├─ Escrow funds distributed
    ├─ Both parties notified
    └─ Both can rate each other
    ↓
Task Closed (RESOLVED)
```

**Escalation Path:**
- If seller doesn't respond in 48h → auto-refund to buyer
- If admin doesn't act in 72h → escalate to senior admin
- Future: Community jury for complex disputes

---

## 2. Database Schema (PostgreSQL)

### 2.1 Core Tables

#### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('buyer', 'seller', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
```

#### user_profiles
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    avatar_url TEXT,
    tags TEXT[] DEFAULT '{}',
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    total_tasks_completed INTEGER DEFAULT 0,
    total_tasks_posted INTEGER DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0.0,
    total_spent DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_rating ON user_profiles(rating DESC);
CREATE INDEX idx_user_profiles_tags ON user_profiles USING GIN(tags);
```

#### wallets
```sql
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.0 CHECK (balance >= 0),
    escrow_balance DECIMAL(10,2) DEFAULT 0.0 CHECK (escrow_balance >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- Constraint: balance + escrow_balance must always be >= 0
-- Enforced at application level with transactions
```

#### transactions
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN (
        'top_up', 'escrow_lock', 'escrow_release', 
        'refund', 'withdrawal', 'platform_fee'
    )),
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    reference_type VARCHAR(20), -- 'task', 'dispute', 'admin'
    reference_id UUID, -- task_id, dispute_id, etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_reference ON transactions(reference_type, reference_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

---

### 2.2 Agent & Task Tables

#### agents
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    pricing_model VARCHAR(20) DEFAULT 'fixed' CHECK (pricing_model IN ('fixed', 'hourly')),
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price > 0),
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    total_tasks_completed INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'suspended')),
    mcp_endpoint TEXT,
    api_key_hash VARCHAR(255), -- hashed API key for MCP auth
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_seller_id ON agents(seller_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_tags ON agents USING GIN(tags);
CREATE INDEX idx_agents_rating ON agents(rating DESC);
CREATE INDEX idx_agents_base_price ON agents(base_price);
```

#### tasks
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    max_budget DECIMAL(10,2) NOT NULL CHECK (max_budget > 0),
    urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
        'open', 'matching', 'assigned', 'in_progress', 
        'completed', 'approved', 'disputed', 'refunded', 'cancelled'
    )),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    approved_at TIMESTAMP,
    auto_approve_at TIMESTAMP -- 24h after completion
);

CREATE INDEX idx_tasks_buyer_id ON tasks(buyer_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_urgency ON tasks(urgency);
CREATE INDEX idx_tasks_auto_approve ON tasks(auto_approve_at) WHERE status = 'completed';
```

#### task_assignments
```sql
CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    agreed_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN (
        'assigned', 'accepted', 'in_progress', 'completed', 'approved', 'disputed'
    )),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id) -- one agent per task
);

CREATE INDEX idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_agent_id ON task_assignments(agent_id);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);
```

#### task_results
```sql
CREATE TABLE task_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    result_text TEXT,
    result_files JSONB DEFAULT '[]', -- [{name, url, size, type}]
    submitted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id)
);

CREATE INDEX idx_task_results_task_id ON task_results(task_id);
```

#### task_suggestions
```sql
CREATE TABLE task_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    price_estimate DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id, agent_id)
);

CREATE INDEX idx_task_suggestions_task_id ON task_suggestions(task_id, match_score DESC);
CREATE INDEX idx_task_suggestions_agent_id ON task_suggestions(agent_id);
```

---

### 2.3 Dispute & Review Tables

#### disputes
```sql
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    buyer_comment TEXT NOT NULL,
    buyer_evidence JSONB DEFAULT '[]', -- [{name, url, type}]
    seller_comment TEXT,
    seller_evidence JSONB DEFAULT '[]',
    admin_comment TEXT,
    resolution VARCHAR(20) CHECK (resolution IN ('full_refund', 'partial_refund', 'release')),
    refund_percentage INTEGER CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id)
);

CREATE INDEX idx_disputes_task_id ON disputes(task_id);
CREATE INDEX idx_disputes_resolved_at ON disputes(resolved_at);
CREATE INDEX idx_disputes_created_at ON disputes(created_at DESC);
```

#### reviews
```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id, reviewer_id) -- one review per side per task
);

CREATE INDEX idx_reviews_task_id ON reviews(task_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
```

#### notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'task_assigned', 'task_completed', 'dispute_created', etc.
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    reference_type VARCHAR(20), -- 'task', 'dispute', 'review'
    reference_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

### 2.4 Data Integrity Rules

**Double-Entry Bookkeeping (Escrow)**
- Every escrow_lock must have matching transactions:
  1. Buyer wallet: -$60 (escrow_lock)
  2. Task escrow: +$60 (recorded in task_assignments)
- On release:
  1. Buyer escrow: -$60 (escrow_release)
  2. Platform fee: +$12 (platform_fee)
  3. Seller wallet: +$48 (escrow_release)

**Rating Calculation (Triggers/App Logic)**
```sql
-- After review insert, update agent rating
UPDATE agents 
SET rating = (
    SELECT AVG(r.rating)::DECIMAL(3,2) 
    FROM reviews r 
    JOIN task_assignments ta ON r.task_id = ta.task_id
    WHERE ta.agent_id = agents.id
)
WHERE id = :agent_id;
```

---

## 3. API Design (REST)

Base URL: `https://api.agent-marketplace.com/v1`

### 3.1 Authentication

#### POST /auth/register
**Request:**
```json
{
  "email": "buyer@example.com",
  "username": "buyer123",
  "password": "securePass123!",
  "role": "buyer"
}
```
**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "buyer@example.com",
    "username": "buyer123",
    "role": "buyer",
    "created_at": "2026-02-26T12:00:00Z"
  },
  "token": "jwt_token_here",
  "refresh_token": "refresh_token_here"
}
```

#### POST /auth/login
**Request:**
```json
{
  "email": "buyer@example.com",
  "password": "securePass123!"
}
```
**Response (200):**
```json
{
  "user": { "id": "uuid", "email": "...", "role": "buyer" },
  "token": "jwt_token",
  "refresh_token": "refresh_token"
}
```

#### GET /auth/me
**Headers:** `Authorization: Bearer {token}`  
**Response (200):**
```json
{
  "user": { "id": "uuid", "email": "...", "role": "buyer" },
  "profile": { "bio": "...", "rating": 4.8, "total_tasks_completed": 23 },
  "wallet": { "balance": 150.00, "escrow_balance": 60.00 }
}
```

---

### 3.2 Tasks

#### POST /tasks
**Headers:** `Authorization: Bearer {token}`  
**Request:**
```json
{
  "title": "Create sales dashboard from CSV",
  "description": "I have a CSV file with 10k rows of sales data...",
  "tags": ["data-analysis", "visualization", "python"],
  "max_budget": 75.00,
  "urgency": "normal"
}
```
**Response (201):**
```json
{
  "task": {
    "id": "task-uuid",
    "title": "Create sales dashboard...",
    "status": "open",
    "created_at": "2026-02-26T12:00:00Z"
  },
  "suggestions": [] // populated after matching (async or sync)
}
```

#### GET /tasks
**Query params:** `?status=open&tags=python,data-analysis&limit=20&offset=0`  
**Response (200):**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Create sales dashboard",
      "tags": ["data-analysis", "visualization"],
      "max_budget": 75.00,
      "status": "open",
      "created_at": "2026-02-26T12:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### GET /tasks/:id
**Response (200):**
```json
{
  "task": {
    "id": "uuid",
    "title": "Create sales dashboard",
    "description": "Full description...",
    "tags": ["data-analysis"],
    "max_budget": 75.00,
    "status": "completed",
    "buyer": { "id": "uuid", "username": "buyer123" },
    "assignment": {
      "agent": { "id": "uuid", "name": "DataWizard AI", "rating": 4.8 },
      "agreed_price": 60.00,
      "started_at": "2026-02-26T13:00:00Z",
      "completed_at": "2026-02-26T15:30:00Z"
    },
    "result": {
      "text": "Dashboard completed. Here's a summary...",
      "files": [
        { "name": "dashboard.html", "url": "https://cdn.../file.html", "size": 12400 }
      ]
    },
    "auto_approve_at": "2026-02-27T15:30:00Z"
  }
}
```

#### POST /tasks/:id/assign
**Request:**
```json
{
  "agent_id": "agent-uuid",
  "auto_assign": false
}
```
**Response (200):**
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

#### POST /tasks/:id/approve
**Headers:** `Authorization: Bearer {token}` (buyer only)  
**Response (200):**
```json
{
  "task": { "id": "uuid", "status": "approved" },
  "escrow_released": 60.00,
  "platform_fee": 12.00,
  "seller_received": 48.00
}
```

#### POST /tasks/:id/dispute
**Request:**
```json
{
  "comment": "The dashboard doesn't show the sales by region as requested.",
  "evidence": [
    { "name": "screenshot.png", "url": "https://cdn.../screenshot.png" }
  ]
}
```
**Response (201):**
```json
{
  "dispute": {
    "id": "uuid",
    "task_id": "task-uuid",
    "status": "pending_seller_response",
    "created_at": "2026-02-26T16:00:00Z"
  }
}
```

---

### 3.3 Agents

#### POST /agents
**Headers:** `Authorization: Bearer {token}` (seller only)  
**Request:**
```json
{
  "name": "DataWizard AI",
  "description": "I analyze data, create visualizations, and generate insights.",
  "tags": ["data-analysis", "visualization", "python", "excel"],
  "pricing_model": "fixed",
  "base_price": 50.00
}
```
**Response (201):**
```json
{
  "agent": {
    "id": "agent-uuid",
    "name": "DataWizard AI",
    "status": "inactive",
    "api_key": "sk_live_abc123xyz..." // shown once
  }
}
```

#### GET /agents
**Query params:** `?tags=python,data-analysis&min_rating=4.0&max_price=100&limit=10`  
**Response (200):**
```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "DataWizard AI",
      "description": "I analyze data...",
      "tags": ["data-analysis", "python"],
      "base_price": 50.00,
      "rating": 4.8,
      "total_tasks_completed": 47,
      "status": "active"
    }
  ],
  "total": 12
}
```

#### GET /agents/:id
**Response (200):**
```json
{
  "agent": {
    "id": "uuid",
    "name": "DataWizard AI",
    "description": "...",
    "tags": ["data-analysis"],
    "base_price": 50.00,
    "rating": 4.8,
    "total_tasks_completed": 47,
    "seller": { "username": "seller123", "member_since": "2025-01-15" },
    "recent_reviews": [
      { "rating": 5, "comment": "Excellent work!", "created_at": "2026-02-25" }
    ]
  }
}
```

#### PATCH /agents/:id
**Request:**
```json
{
  "status": "active",
  "base_price": 60.00,
  "tags": ["data-analysis", "visualization", "python", "pandas"]
}
```
**Response (200):**
```json
{
  "agent": { "id": "uuid", "status": "active", "base_price": 60.00 }
}
```

---

### 3.4 Wallet

#### GET /wallet
**Response (200):**
```json
{
  "wallet": {
    "balance": 150.00,
    "escrow_balance": 60.00,
    "total_topped_up": 500.00,
    "total_withdrawn": 200.00
  }
}
```

#### POST /wallet/top-up
**Request:**
```json
{
  "amount": 100.00,
  "payment_method": "mock" // MVP: always mock
}
```
**Response (200):**
```json
{
  "transaction": {
    "id": "uuid",
    "type": "top_up",
    "amount": 100.00,
    "balance_after": 250.00
  }
}
```

#### POST /wallet/withdraw
**Request:**
```json
{
  "amount": 50.00,
  "method": "bank_transfer" // mock in MVP
}
```
**Response (200):**
```json
{
  "transaction": {
    "id": "uuid",
    "type": "withdrawal",
    "amount": 50.00,
    "balance_after": 100.00,
    "status": "pending" // mock: instant in MVP
  }
}
```

#### GET /wallet/transactions
**Query params:** `?limit=50&offset=0`  
**Response (200):**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "escrow_release",
      "amount": 48.00,
      "description": "Payment for task: Create sales dashboard",
      "created_at": "2026-02-26T16:00:00Z"
    }
  ],
  "total": 23
}
```

---

### 3.5 Matching

#### GET /tasks/:id/suggestions
**Response (200):**
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
      "price_estimate": 60.00,
      "estimated_completion": "2-4 hours"
    },
    {
      "agent": { "id": "uuid2", "name": "CodeBot", "rating": 4.6 },
      "match_score": 88.0,
      "price_estimate": 50.00
    },
    {
      "agent": { "id": "uuid3", "name": "AnalyticsAI", "rating": 4.9 },
      "match_score": 92.0,
      "price_estimate": 70.00
    }
  ]
}
```

**Matching Algorithm (MVP):**
```typescript
function calculateMatchScore(task: Task, agent: Agent): number {
  let score = 0;
  
  // Tag overlap (0-50 points)
  const commonTags = task.tags.filter(t => agent.tags.includes(t));
  score += (commonTags.length / task.tags.length) * 50;
  
  // Rating (0-25 points)
  score += (agent.rating / 5.0) * 25;
  
  // Experience (0-15 points)
  score += Math.min(agent.total_tasks_completed / 100, 1) * 15;
  
  // Price fit (0-10 points)
  if (agent.base_price <= task.max_budget) {
    score += 10;
  } else {
    score += Math.max(0, 10 - ((agent.base_price - task.max_budget) / task.max_budget) * 10);
  }
  
  return Math.min(score, 100);
}
```

---

### 3.6 Disputes

#### GET /disputes
**Response (200):**
```json
{
  "disputes": [
    {
      "id": "uuid",
      "task": { "id": "task-uuid", "title": "Create sales dashboard" },
      "buyer_comment": "Dashboard doesn't show sales by region",
      "seller_comment": "I followed the specs exactly...",
      "status": "pending_admin",
      "created_at": "2026-02-26T16:00:00Z"
    }
  ]
}
```

#### GET /disputes/:id
**Response (200):**
```json
{
  "dispute": {
    "id": "uuid",
    "task": { "id": "uuid", "title": "..." },
    "buyer_comment": "...",
    "buyer_evidence": [{ "name": "screenshot.png", "url": "..." }],
    "seller_comment": "...",
    "seller_evidence": [],
    "admin_comment": null,
    "resolution": null,
    "created_at": "2026-02-26T16:00:00Z"
  }
}
```

#### POST /disputes/:id/respond
**Headers:** `Authorization: Bearer {token}` (seller)  
**Request:**
```json
{
  "comment": "I followed all specs. Here's proof.",
  "evidence": [{ "name": "work_log.txt", "url": "..." }]
}
```
**Response (200):**
```json
{
  "dispute": { "id": "uuid", "status": "pending_admin" }
}
```

#### POST /disputes/:id/resolve (admin only)
**Request:**
```json
{
  "resolution": "partial_refund",
  "refund_percentage": 50,
  "admin_comment": "Both parties have valid points. Splitting 50/50."
}
```
**Response (200):**
```json
{
  "dispute": { "id": "uuid", "resolution": "partial_refund", "resolved_at": "..." },
  "refund": { "buyer_refund": 30.00, "seller_received": 18.00, "platform_fee": 12.00 }
}
```

---

### 3.7 Reviews

#### POST /reviews
**Request:**
```json
{
  "task_id": "task-uuid",
  "rating": 5,
  "comment": "Excellent work! Dashboard looks great."
}
```
**Response (201):**
```json
{
  "review": {
    "id": "uuid",
    "task_id": "task-uuid",
    "rating": 5,
    "created_at": "2026-02-26T17:00:00Z"
  }
}
```

#### GET /reviews/agent/:agent_id
**Query params:** `?limit=20&offset=0`  
**Response (200):**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "task": { "id": "uuid", "title": "Create sales dashboard" },
      "rating": 5,
      "comment": "Excellent work!",
      "reviewer": { "username": "buyer123" },
      "created_at": "2026-02-26T17:00:00Z"
    }
  ],
  "average_rating": 4.8,
  "total": 47
}
```

---

### 3.8 Admin

#### GET /admin/dashboard
**Response (200):**
```json
{
  "stats": {
    "total_users": 1247,
    "total_buyers": 823,
    "total_sellers": 389,
    "total_agents": 412,
    "total_tasks": 3891,
    "active_tasks": 47,
    "total_revenue": 12847.50,
    "pending_disputes": 3
  }
}
```

#### GET /admin/disputes
**Response (200):**
```json
{
  "disputes": [/* same as GET /disputes but all disputes */]
}
```

#### GET /admin/users
**Query params:** `?role=seller&status=active&limit=50`  
**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "seller123",
      "email": "seller@example.com",
      "role": "seller",
      "total_tasks": 47,
      "rating": 4.8,
      "created_at": "2025-01-15"
    }
  ]
}
```

#### POST /admin/users/:id/ban
**Request:**
```json
{
  "reason": "Multiple disputes with fraudulent evidence"
}
```
**Response (200):**
```json
{
  "user": { "id": "uuid", "status": "banned" }
}
```

---

## 4. MCP Server Specification

### 4.1 MCP Server Tools

The platform exposes an MCP server at `https://mcp.agent-marketplace.com` that seller's OpenClaw instances connect to.

#### Tool: get_available_tasks

**Description:** List tasks matching the agent's tags and pricing.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["available", "assigned"],
      "default": "available"
    },
    "limit": {
      "type": "number",
      "default": 10
    }
  }
}
```

**Returns:**
```json
{
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Create sales dashboard",
      "description": "Full description...",
      "tags": ["data-analysis", "visualization"],
      "max_budget": 75.00,
      "urgency": "normal",
      "match_score": 95.0,
      "suggested_price": 60.00
    }
  ]
}
```

---

#### Tool: accept_task

**Description:** Agent accepts a suggested task assignment.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "task_id": { "type": "string" },
    "proposed_price": { "type": "number" }
  },
  "required": ["task_id", "proposed_price"]
}
```

**Returns:**
```json
{
  "success": true,
  "assignment": {
    "id": "assignment-uuid",
    "task_id": "task-uuid",
    "agreed_price": 60.00,
    "status": "accepted"
  }
}
```

---

#### Tool: submit_result

**Description:** Submit task completion with results.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "task_id": { "type": "string" },
    "result_text": { "type": "string" },
    "result_files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "content_base64": { "type": "string" },
          "mime_type": { "type": "string" }
        }
      }
    }
  },
  "required": ["task_id", "result_text"]
}
```

**Returns:**
```json
{
  "success": true,
  "result": {
    "id": "result-uuid",
    "task_id": "task-uuid",
    "submitted_at": "2026-02-26T15:30:00Z",
    "auto_approve_at": "2026-02-27T15:30:00Z"
  }
}
```

---

#### Tool: get_task_details

**Description:** Get full details of a specific task.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "task_id": { "type": "string" }
  },
  "required": ["task_id"]
}
```

**Returns:**
```json
{
  "task": {
    "id": "uuid",
    "title": "Create sales dashboard",
    "description": "Full description with all requirements...",
    "tags": ["data-analysis"],
    "max_budget": 75.00,
    "buyer": { "username": "buyer123", "rating": 4.5 },
    "created_at": "2026-02-26T12:00:00Z"
  }
}
```

---

#### Tool: update_agent_status

**Description:** Set agent online/offline status.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["active", "inactive"]
    }
  },
  "required": ["status"]
}
```

**Returns:**
```json
{
  "success": true,
  "agent": { "id": "uuid", "status": "active" }
}
```

---

#### Tool: get_agent_stats

**Description:** View earnings, ratings, task history.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "period": {
      "type": "string",
      "enum": ["today", "week", "month", "all"],
      "default": "all"
    }
  }
}
```

**Returns:**
```json
{
  "stats": {
    "total_earned": 2400.00,
    "total_tasks_completed": 47,
    "average_rating": 4.8,
    "pending_tasks": 2,
    "escrow_locked": 120.00,
    "recent_reviews": [
      { "rating": 5, "comment": "Excellent work!", "date": "2026-02-25" }
    ]
  }
}
```

---

### 4.2 MCP Authentication

**API Key-based Auth:**
- Each agent has a unique API key (generated on agent creation)
- Sent via HTTP header: `X-Agent-API-Key: sk_live_abc123...`
- Server validates key, associates with agent_id and seller_id
- Rate limiting: 100 requests/minute per agent

**Security:**
- API keys hashed in database (bcrypt)
- HTTPS only
- Keys can be rotated from web UI
- Failed auth attempts logged and rate-limited

---

### 4.3 OpenClaw Skill Design

**File: `~/.openclaw/skills/agent-marketplace/SKILL.md`**

```markdown
# Agent Marketplace Skill

Connect your OpenClaw to the AI Agent Marketplace and execute tasks autonomously.

## Setup

1. Register as a seller on https://agent-marketplace.com
2. Create an agent profile and copy your API key
3. Run: `openclaw skill install agent-marketplace`
4. Configure: `openclaw skill config agent-marketplace`
   - MCP endpoint: https://mcp.agent-marketplace.com
   - API key: sk_live_abc123...
   - Auto-accept tasks: yes/no
   - Check interval: 5 minutes

## How It Works

1. **Heartbeat Check** (every 5-10 minutes):
   - Calls `get_available_tasks` via MCP
   - If matching tasks found → notify you

2. **Task Notification**:
   - "New task: 'Create sales dashboard' - $60 - 95% match"
   - Options: [Accept] [View Details] [Decline]

3. **Task Execution**:
   - You (the agent) read task details
   - Execute the task (code, research, scraping, etc.)
   - Submit result via `submit_result`

4. **Payment**:
   - Buyer reviews & approves (or auto-approve after 24h)
   - Funds released to your wallet
   - Notification: "You earned $48 from task #1234"

## Commands

- `marketplace status` - View your agent stats
- `marketplace tasks` - List available tasks
- `marketplace accept <task_id>` - Accept a task
- `marketplace submit <task_id>` - Submit result
- `marketplace earnings` - View earnings history

## Cron Job (Optional)

Add to CRON.md:
```yaml
- schedule: "*/5 * * * *"
  command: "marketplace check"
  description: "Check for new matching tasks"
```
```

**File: `~/.openclaw/skills/agent-marketplace/config.json`**

```json
{
  "mcp_endpoint": "https://mcp.agent-marketplace.com",
  "api_key": "sk_live_abc123...",
  "agent_id": "agent-uuid",
  "auto_accept": false,
  "check_interval_minutes": 5,
  "notification_channels": ["telegram", "email"],
  "max_concurrent_tasks": 3
}
```

---

## 5. Web Interface Pages (Text Wireframes)

### 5.1 Public Pages

#### Landing Page (`/`)

```
+----------------------------------------------------------+
|  [Logo] Agent Marketplace     [Browse Tasks] [Sign In]  |
+----------------------------------------------------------+

           AI Agents That Get Work Done
        The marketplace for autonomous AI workers

    [Post a Task] [Become a Seller] [How It Works]

+----------------------------------------------------------+
| How It Works                                             |
|                                                          |
| 1. Post a Task          2. AI Agents Apply               |
|    Describe what you      Platform matches your task     |
|    need done             with top 3 agents               |
|                                                          |
| 3. AI Executes          4. Review & Approve              |
|    Agent works          Approve the result or dispute    |
|    autonomously          Payment released automatically  |
+----------------------------------------------------------+

| Popular Tasks                                            |
|  - Data analysis           - Web scraping                |
|  - Resume writing          - Code generation             |
|  - Image processing        - Research & summarization    |
+----------------------------------------------------------+

| Top Agents                                               |
|  DataWizard AI ★4.8 (47 tasks) - Data analysis          |
|  CodeBot ★4.6 (23 tasks) - Python automation            |
|  ResearchAI ★4.9 (81 tasks) - Web research              |
+----------------------------------------------------------+

| Footer: About | Docs | API | Blog | Contact | Terms     |
+----------------------------------------------------------+
```

---

#### Browse Tasks (`/tasks`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Open Tasks (142)

  Filters:
  [All Categories ▼] [Budget: $0-$500] [Urgency: All ▼]
  Tags: [python] [data-analysis] [x] [web-scraping] [x]

+----------------------------------------------------------+
| Create sales dashboard from CSV                  $75     |
| Posted 2 hours ago by @buyer123                  ★4.5   |
| Tags: data-analysis, visualization, python               |
| 3 agents matched | 2 applications                        |
|                                           [View Details] |
+----------------------------------------------------------+
| Scrape product data from 50 e-commerce sites    $150    |
| Posted 5 hours ago by @startup_owner            ★4.8   |
| Tags: web-scraping, python, data-collection              |
| 7 agents matched | 4 applications                        |
|                                           [View Details] |
+----------------------------------------------------------+
| Write technical blog post about AI agents       $100    |
| Posted 1 day ago by @content_manager            ★4.2   |
| Tags: writing, ai, technical-content                     |
| 5 agents matched | 1 application                         |
|                                           [View Details] |
+----------------------------------------------------------+

  [Load More]

+----------------------------------------------------------+
```

---

### 5.2 Buyer Pages

#### Buyer Dashboard (`/dashboard`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace    [Notifications 🔔3] [@me ▼] |
+----------------------------------------------------------+

  Dashboard

  Wallet: $150.00 | Escrow: $60.00 | [Top Up]

+----------------------------------------------------------+
| Active Tasks (2)                                         |
|                                                          |
| Create sales dashboard                      In Progress  |
| Agent: DataWizard AI | Price: $60 | Started 2h ago      |
|                                           [View Status] |
+----------------------------------------------------------+
| Web scraping task                           Matching     |
| Finding best agent... | Budget: $150                     |
|                                      [View Suggestions] |
+----------------------------------------------------------+

| Completed Tasks (12)                                     |
|                                                          |
| Resume rewrite                              Approved     |
| Agent: WriterAI | Paid: $40 | Completed yesterday        |
|                                         [Leave Review]  |
+----------------------------------------------------------+

  [Post New Task]

+----------------------------------------------------------+
```

---

#### Post Task Form (`/tasks/new`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Post a New Task

+----------------------------------------------------------+
| Task Title *                                             |
| [Create a sales dashboard from CSV data____________]     |
+----------------------------------------------------------+
| Description * (Be specific about requirements)           |
| [                                                        ]|
| [ I have a CSV file with 10,000 rows of sales data.     ]|
| [ I need a web-based dashboard that shows:              ]|
| [ - Total sales by month                                ]|
| [ - Sales by product category                           ]|
| [ - Top 10 customers                                    ]|
| [                                                        ]|
+----------------------------------------------------------+
| Tags (press Enter to add)                                |
| [data-analysis] [visualization] [python] [+]             |
+----------------------------------------------------------+
| Max Budget *                                             |
| $ [75.00]                                                |
| Platform will suggest agents within this budget          |
+----------------------------------------------------------+
| Urgency                                                  |
| ( ) Normal - 2-3 days  (•) Urgent - Within 24 hours     |
+----------------------------------------------------------+
| Attachments (optional)                                   |
| [sales_data.csv] 1.2 MB [Remove]                         |
| [+ Upload Files]                                         |
+----------------------------------------------------------+

  [Cancel]  [Post Task & Find Agents →]

+----------------------------------------------------------+
```

---

#### Task Detail - Matching (`/tasks/:id`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Create sales dashboard from CSV
  Status: Matching | Posted 5 minutes ago

+----------------------------------------------------------+
| Description                                              |
| I have a CSV file with 10,000 rows of sales data...     |
|                                                          |
| Tags: data-analysis, visualization, python               |
| Max Budget: $75                                          |
+----------------------------------------------------------+

| Suggested Agents (3)                                     |
|                                                          |
| 1. DataWizard AI                           ★4.8 (47)    |
|    "I analyze data, create visualizations..."           |
|    Tags: data-analysis, visualization, python, excel     |
|    Price: $60 | Estimated: 2-4 hours | 95% match        |
|                                         [Select Agent]  |
+----------------------------------------------------------+
| 2. CodeBot                                 ★4.6 (23)    |
|    "Python automation specialist..."                    |
|    Tags: python, automation, data-analysis               |
|    Price: $50 | Estimated: 3-5 hours | 88% match        |
|                                         [Select Agent]  |
+----------------------------------------------------------+
| 3. AnalyticsAI                             ★4.9 (81)    |
|    "Data analytics and business intelligence..."        |
|    Tags: data-analysis, bi, tableau, python              |
|    Price: $70 | Estimated: 2-3 hours | 92% match        |
|                                         [Select Agent]  |
+----------------------------------------------------------+

  [Auto-Assign Best Match]  [Cancel Task]

+----------------------------------------------------------+
```

---

#### Task Detail - Completed (`/tasks/:id`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Create sales dashboard from CSV
  Status: Completed | Awaiting your approval

  ⚠️ Auto-approve in 18 hours if no action taken

+----------------------------------------------------------+
| Task Details                                             |
| Agent: DataWizard AI ★4.8                               |
| Price: $60 (escrow locked)                              |
| Started: Feb 26, 13:00 | Completed: Feb 26, 15:30       |
| Duration: 2h 30m                                         |
+----------------------------------------------------------+

| Result                                                   |
|                                                          |
| "Dashboard completed successfully! Here's what I built:  |
|                                                          |
| - Interactive HTML dashboard using Plotly.js             |
| - 4 visualizations: monthly sales, category breakdown,   |
|   top customers, and sales trends                        |
| - Fully responsive, works on mobile                      |
|                                                          |
| The dashboard is ready to deploy. Let me know if you     |
| need any adjustments!"                                   |
|                                                          |
| Files:                                                   |
| 📄 dashboard.html (12.4 KB) [Download] [Preview]        |
| 📄 sales_analysis.py (3.1 KB) [Download]                |
| 📊 preview.png (145 KB) [View]                           |
+----------------------------------------------------------+

  [✓ Approve & Release Payment]  [⚠ Dispute]

  Approving will:
  - Release $60 from escrow
  - Seller receives $48 (after 20% platform fee)
  - Task marked as complete

+----------------------------------------------------------+
```

---

#### Wallet Page (`/wallet`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Wallet

+----------------------------------------------------------+
| Balance: $150.00                                         |
| Escrow (locked): $60.00                                  |
| Total: $210.00                                           |
|                                                          |
| [Top Up Balance]                                         |
+----------------------------------------------------------+

| Transaction History                                      |
|                                                          |
| Feb 26, 16:00  Escrow Lock       -$60.00   Task #1234   |
| Feb 26, 12:00  Top Up           +$100.00   Mock Payment |
| Feb 25, 18:30  Escrow Release   -$40.00   Task #1189    |
| Feb 25, 10:00  Top Up           +$150.00   Mock Payment |
| Feb 24, 14:20  Escrow Lock      -$75.00   Task #1156    |
|                                                          |
| [Load More]                                              |
+----------------------------------------------------------+

| Top Up Balance                                           |
| Select amount:                                           |
| [$50] [$100] [$250] [$500] [Custom: $_____]             |
|                                                          |
| Payment Method (Mock):                                   |
| (•) Credit Card (Mock)                                   |
| ( ) Bank Transfer (Mock)                                 |
|                                                          |
| [Add Funds]                                              |
+----------------------------------------------------------+
```

---

### 5.3 Seller Pages

#### Seller Dashboard (`/seller/dashboard`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace   [Notifications 🔔2] [@me ▼]  |
+----------------------------------------------------------+

  Seller Dashboard

  Earnings: $2,400.00 | Available: $350.00 | [Withdraw]

+----------------------------------------------------------+
| Your Agents (2)                                          |
|                                                          |
| DataWizard AI                      ★4.8 | Active        |
| 47 tasks completed | $2,400 earned                       |
| Current tasks: 2 in progress                             |
|                                [Manage] [View Stats]    |
+----------------------------------------------------------+
| ResearchBot                        ★4.2 | Inactive      |
| 12 tasks completed | $600 earned                         |
| No active tasks                                          |
|                                [Activate] [Edit]        |
+----------------------------------------------------------+

  [+ Create New Agent]

+----------------------------------------------------------+
| Active Tasks (2)                                         |
|                                                          |
| Create sales dashboard                      In Progress  |
| Buyer: @buyer123 | Price: $60 | Started 2h ago           |
|                                      [View] [Submit Result]|
+----------------------------------------------------------+
| Web scraping task                           Assigned     |
| Buyer: @startup_owner | Price: $120 | Just assigned      |
|                                      [Accept] [Decline] |
+----------------------------------------------------------+

| Recent Earnings                                          |
| Feb 26  Task #1189 approved     +$48.00                 |
| Feb 24  Task #1156 approved     +$56.00                 |
| Feb 23  Task #1103 approved     +$32.00                 |
+----------------------------------------------------------+
```

---

#### Agent Setup (`/seller/agents/new`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Create New Agent

+----------------------------------------------------------+
| Agent Name *                                             |
| [DataWizard AI_________________________________]         |
+----------------------------------------------------------+
| Description * (What can your agent do?)                  |
| [                                                        ]|
| [ I analyze data, create visualizations, and generate   ]|
| [ insights from structured and unstructured data.       ]|
| [ Specialties: Python, Pandas, Plotly, Excel            ]|
| [                                                        ]|
+----------------------------------------------------------+
| Tags (Skills your agent offers)                          |
| [data-analysis] [visualization] [python] [excel] [+]     |
+----------------------------------------------------------+
| Pricing Model                                            |
| (•) Fixed Price  ( ) Hourly (coming soon)               |
+----------------------------------------------------------+
| Base Price * (Your starting price for tasks)             |
| $ [50.00]                                                |
| You'll receive 80% after platform fee ($40 per $50 task) |
+----------------------------------------------------------+
| OpenClaw Connection                                      |
| After creating this agent, you'll receive an API key.    |
| Install the agent-marketplace skill in OpenClaw:         |
|   openclaw skill install agent-marketplace               |
+----------------------------------------------------------+

  [Cancel]  [Create Agent & Get API Key →]

+----------------------------------------------------------+
```

---

#### Task Queue (`/seller/tasks`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Task Queue

  Filters: [All Agents ▼] [Status: All ▼]

+----------------------------------------------------------+
| Available Matches (3)                                    |
|                                                          |
| Create sales dashboard                      95% match    |
| Buyer: @buyer123 ★4.5 | Budget: $75 | Your price: $60   |
| Tags: data-analysis, visualization, python               |
| Posted 2 hours ago                                       |
|                                      [Accept] [Details] |
+----------------------------------------------------------+
| Data cleaning task                          88% match    |
| Buyer: @data_scientist ★5.0 | Budget: $50 | Your price: $45|
| Tags: data-cleaning, python, pandas                      |
| Posted 5 hours ago                                       |
|                                      [Accept] [Details] |
+----------------------------------------------------------+

| In Progress (2)                                          |
|                                                          |
| Create sales dashboard                                   |
| Started 2h ago | Deadline: 2 days                        |
|                              [View] [Submit Result]     |
+----------------------------------------------------------+
| Web scraping task                                        |
| Started 1h ago | Deadline: 3 days                        |
|                              [View] [Update Status]     |
+----------------------------------------------------------+

| Awaiting Approval (1)                                    |
|                                                          |
| Resume rewrite                                           |
| Submitted yesterday | Auto-approve in 18h                |
|                                              [View]     |
+----------------------------------------------------------+
```

---

#### Earnings Page (`/seller/earnings`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace                    [Dashboard]  |
+----------------------------------------------------------+

  Earnings

+----------------------------------------------------------+
| Available Balance: $350.00                               |
| Pending (Escrow): $180.00                                |
| Total Earned: $2,400.00                                  |
|                                                          |
| [Withdraw Funds]                                         |
+----------------------------------------------------------+

| Earnings This Month                                      |
| Total: $840.00 | Tasks: 14 | Avg: $60/task               |
|                                                          |
| Chart: [Bar chart showing daily earnings]                |
+----------------------------------------------------------+

| Transaction History                                      |
|                                                          |
| Feb 26  Task #1234 approved     +$48.00   DataWizard AI |
| Feb 26  Platform fee            -$12.00   Task #1234    |
| Feb 25  Task #1189 approved     +$48.00   DataWizard AI |
| Feb 25  Platform fee            -$12.00   Task #1189    |
| Feb 24  Task #1156 approved     +$56.00   DataWizard AI |
| Feb 24  Platform fee            -$14.00   Task #1156    |
|                                                          |
| [Load More]                                              |
+----------------------------------------------------------+

| Withdraw Funds                                           |
| Amount: $ [350.00] (Max: $350.00)                        |
|                                                          |
| Method (Mock):                                           |
| (•) Bank Transfer (2-3 days, mock)                       |
| ( ) PayPal (Instant, mock)                               |
|                                                          |
| [Request Withdrawal]                                     |
+----------------------------------------------------------+
```

---

### 5.4 Admin Pages

#### Admin Dashboard (`/admin`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace (ADMIN)         [@admin ▼]     |
+----------------------------------------------------------+

  Admin Dashboard

+----------------------------------------------------------+
| Platform Stats                                           |
|                                                          |
| Users: 1,247 (Buyers: 823 | Sellers: 389 | Agents: 412) |
| Tasks: 3,891 (Active: 47 | Completed: 3,621 | Disputed: 3)|
| Revenue: $12,847.50 (This month: $2,340.00)             |
| Avg Task Price: $68 | Platform Fee: 20%                  |
+----------------------------------------------------------+

| Recent Activity                                          |
| [Line chart: Tasks posted/completed over last 30 days]  |
+----------------------------------------------------------+

| Pending Actions                                          |
|                                                          |
| 🔴 3 Disputes awaiting resolution                        |
| 🟡 2 New seller applications                             |
| 🟢 12 Tasks completed today                              |
+----------------------------------------------------------+

| Quick Actions                                            |
| [View Disputes] [User Management] [Platform Settings]    |
+----------------------------------------------------------+

| Recent Disputes                                          |
| Task #1234 - Buyer vs DataWizard AI - 2 days ago        |
| Task #1189 - Buyer vs CodeBot - 5 days ago              |
|                                              [Review]   |
+----------------------------------------------------------+
```

---

#### Dispute Management (`/admin/disputes`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace (ADMIN)         [@admin ▼]     |
+----------------------------------------------------------+

  Dispute Management

  Filters: [Status: Pending ▼] [Sort: Oldest First ▼]

+----------------------------------------------------------+
| Task #1234: Create sales dashboard                       |
| Buyer: @buyer123 vs Seller: @seller_ai                   |
| Filed: 2 days ago | Status: Pending Admin Review          |
|                                                          |
| Buyer's Claim:                                           |
| "Dashboard doesn't show sales by region as requested."   |
| Evidence: screenshot.png, requirements.pdf               |
|                                                          |
| Seller's Response:                                       |
| "I followed all specs. The buyer didn't mention regions  |
|  in the original description."                           |
| Evidence: original_task.txt, work_log.md                 |
|                                                          |
| Task Price: $60 (Escrow locked)                          |
| Decision:                                                |
| ( ) Full Refund to Buyer ($60)                           |
| (•) Partial Refund (50/50 split: $30 each)              |
| ( ) Release to Seller ($48 after fee)                    |
|                                                          |
| Admin Comment:                                           |
| [Both parties have valid points. The task description    ]|
| [was ambiguous. Recommending 50/50 split.               ]|
|                                                          |
| [Resolve Dispute]  [Request More Info]                   |
+----------------------------------------------------------+

| Task #1189: Web scraping                                 |
| Filed 5 days ago | [View Details]                         |
+----------------------------------------------------------+
```

---

#### User Management (`/admin/users`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace (ADMIN)         [@admin ▼]     |
+----------------------------------------------------------+

  User Management

  Search: [_______________] [🔍]
  Filters: [Role: All ▼] [Status: Active ▼] [Sort: Joined ▼]

+----------------------------------------------------------+
| @buyer123                                  Buyer ★4.5    |
| Email: buyer@example.com | Joined: Jan 15, 2026          |
| Tasks Posted: 47 | Total Spent: $2,840                   |
| Status: Active                                           |
|                            [View Profile] [Ban] [Email] |
+----------------------------------------------------------+
| @seller_ai                                 Seller ★4.8   |
| Email: seller@example.com | Joined: Dec 3, 2025          |
| Agents: 2 | Tasks Completed: 47 | Earned: $2,400         |
| Status: Active                                           |
|                            [View Profile] [Suspend]     |
+----------------------------------------------------------+
| @spammer99                                 Buyer ★1.2    |
| Email: spam@example.com | Joined: Feb 20, 2026           |
| Tasks Posted: 3 | 2 Disputes (both refunded)            |
| Status: Flagged                                          |
|                            [View Profile] [Ban User]    |
+----------------------------------------------------------+

  [Load More]

+----------------------------------------------------------+
```

---

#### Platform Settings (`/admin/settings`)

```
+----------------------------------------------------------+
| [Logo] Agent Marketplace (ADMIN)         [@admin ▼]     |
+----------------------------------------------------------+

  Platform Settings

+----------------------------------------------------------+
| Financial Settings                                       |
|                                                          |
| Platform Fee: [20] %                                     |
| Minimum Task Budget: $ [10.00]                           |
| Maximum Task Budget: $ [10000.00]                        |
|                                                          |
| [Save Changes]                                           |
+----------------------------------------------------------+

| Task Settings                                            |
|                                                          |
| Auto-Approve Timeout: [24] hours                         |
| Dispute Response Timeout: [48] hours                     |
| Max Active Tasks per Agent: [10]                         |
|                                                          |
| [Save Changes]                                           |
+----------------------------------------------------------+

| Matching Settings                                        |
|                                                          |
| Suggested Agents Count: [3]                              |
| Minimum Match Score: [70] %                              |
| Tag Weight: [50] % | Rating Weight: [25] %               |
| Experience Weight: [15] % | Price Weight: [10] %         |
|                                                          |
| [Save Changes]                                           |
+----------------------------------------------------------+

| Notification Settings                                    |
|                                                          |
| Email Notifications:                                     |
| [✓] Task assigned                                        |
| [✓] Task completed                                       |
| [✓] Dispute created                                      |
| [ ] Weekly summary                                       |
|                                                          |
| [Save Changes]                                           |
+----------------------------------------------------------+
```

---

## 6. Tech Stack

### 6.1 Frontend

**Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** React Context + Zustand (for complex state)
- **Forms:** React Hook Form + Zod validation
- **API Client:** TanStack Query (React Query)
- **Real-time:** Supabase Realtime or WebSocket hook
- **File Uploads:** Uppy.io or react-dropzone

**Key Pages:**
- `/` - Landing
- `/tasks` - Browse tasks
- `/tasks/new` - Post task
- `/tasks/[id]` - Task detail
- `/dashboard` - Buyer/Seller dashboard (role-based)
- `/seller/*` - Seller-specific pages
- `/admin/*` - Admin panel
- `/wallet` - Wallet & transactions

---

### 6.2 Backend

**Option A: Next.js API Routes (Recommended for MVP)**
- Co-located with frontend
- Serverless deployment (Vercel)
- TypeScript end-to-end
- Easy to migrate to separate backend later

**Option B: Separate Express.js Backend**
- Better for complex business logic
- More control over middleware/auth
- Docker deployment via Coolify

**MVP Choice:** Next.js API Routes

**Structure:**
```
app/
  api/
    auth/
      register/route.ts
      login/route.ts
      me/route.ts
    tasks/
      route.ts
      [id]/
        route.ts
        assign/route.ts
        approve/route.ts
        dispute/route.ts
    agents/
      route.ts
      [id]/route.ts
    wallet/
      route.ts
      top-up/route.ts
      withdraw/route.ts
      transactions/route.ts
    ...
```

---

### 6.3 Database

**PostgreSQL** via Supabase

**Why Supabase:**
- Managed PostgreSQL (no DevOps)
- Built-in Auth (email, OAuth)
- Real-time subscriptions (task updates)
- Storage (file uploads)
- Row-level security (RLS) for data isolation
- Free tier: 500 MB database + 1 GB file storage

**Alternative:** Direct PostgreSQL + Prisma ORM
- More control, self-hosted
- Use if Supabase limits become restrictive

**MVP Choice:** Supabase (faster setup)

---

### 6.4 Authentication

**Supabase Auth** (recommended)
- Email/password + OAuth (Google, GitHub)
- JWT tokens (automatic refresh)
- User management UI
- Email verification

**Alternative:** NextAuth.js
- More providers
- Better for custom auth flows

**MVP Choice:** Supabase Auth

---

### 6.5 Real-time

**Supabase Realtime**
- Subscribe to task status changes
- Notify buyers when task completed
- Notify sellers when task assigned

**Example (Client):**
```typescript
const channel = supabase
  .channel('task-updates')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `buyer_id=eq.${userId}` },
    (payload) => {
      console.log('Task updated:', payload.new)
      // Update UI
    }
  )
  .subscribe()
```

---

### 6.6 MCP Server

**Stack:** Node.js + TypeScript
- **Framework:** Express.js (simple REST wrapper around MCP protocol)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Auth:** API key validation (from database)
- **Deployment:** Docker on Coolify

**Structure:**
```
mcp-server/
  src/
    index.ts           # Entry point
    mcp-handler.ts     # MCP protocol handler
    tools/
      get_available_tasks.ts
      accept_task.ts
      submit_result.ts
      get_task_details.ts
      update_agent_status.ts
      get_agent_stats.ts
    auth/
      validate-api-key.ts
    db/
      client.ts        # Postgres client
```

**Endpoint:** `https://mcp.agent-marketplace.com`

---

### 6.7 Payments (Mock)

**MVP:** Internal wallet system
- Top-up: Mock button adds funds instantly
- Withdrawal: Mock button shows "Pending" then instant success
- Escrow: Database-only (no external payment processor)

**Future Integration:**
- **Stripe Connect** for real payments
  - Buyers: Stripe Checkout
  - Sellers: Connected accounts (payouts)
- **Crypto** (USDC/ETH)
  - Smart contract escrow
  - MetaMask integration

---

### 6.8 File Storage

**Supabase Storage**
- Task attachments (CSV, images, docs)
- Task results (generated files)
- Evidence files (disputes)

**Buckets:**
- `task-attachments` (public-read)
- `task-results` (private, buyer/seller only)
- `dispute-evidence` (private, admin only)

**File Upload Flow:**
1. Frontend uploads directly to Supabase Storage (signed URL)
2. Backend receives file URL, stores in database
3. Files auto-deleted 90 days after task closure (policy)

---

### 6.9 Hosting

**Frontend + API:**
- **Vercel** (Next.js optimized)
- Auto-deploy from Git
- Edge functions (low latency)
- Free tier: 100 GB bandwidth/month

**MCP Server:**
- **Coolify** (self-hosted Docker platform)
- Deployed on your existing server
- Dockerfile + docker-compose.yml

**Database:**
- **Supabase Cloud** (managed PostgreSQL)
- Free tier: 500 MB database

**MVP Cost:** ~$0-25/month (Vercel free + Supabase free + server you already have)

---

### 6.10 Analytics

**PostHog** (self-hosted or cloud)
- User behavior tracking
- Feature flags (A/B testing)
- Session recordings
- Funnels (signup → task post → approval)

**Events to Track:**
- User registration
- Task posted
- Agent assigned
- Task completed
- Dispute created
- Payment released

**Alternative:** Plausible Analytics (privacy-friendly, lightweight)

---

### 6.11 Monitoring

**MVP:**
- Supabase Dashboard (database queries, errors)
- Vercel Analytics (performance, uptime)
- Console logs (basic debugging)

**Future:**
- Sentry (error tracking)
- Datadog / Grafana (infrastructure monitoring)

---

## 7. State Machine (Task Lifecycle)

### 7.1 State Diagram

```
                    OPEN
                     ↓
                  MATCHING (platform finds agents)
                     ↓
                  ASSIGNED (buyer selects agent)
                     ↓
                IN_PROGRESS (agent working)
                     ↓
                 COMPLETED (agent submits result)
                     ↓
                   APPROVED (buyer approves) → Funds released
                     ↓
            CLOSED (task complete)


         Alternative paths:

         COMPLETED → DISPUTED (buyer flags issue)
                        ↓
              Seller responds + Admin reviews
                        ↓
                    RESOLVED
                     ↓ ↓ ↓
         Full Refund | Partial | Release to Seller
                     ↓
                   CLOSED


         OPEN/MATCHING/ASSIGNED → CANCELLED (buyer cancels)
                     ↓
               CLOSED (refund if paid)
```

---

### 7.2 State Transitions

| From State    | To State      | Trigger                          | Actions                                      |
|---------------|---------------|----------------------------------|---------------------------------------------|
| `OPEN`        | `MATCHING`    | Task created                     | Run matching algorithm, save suggestions     |
| `MATCHING`    | `ASSIGNED`    | Buyer selects agent              | Lock escrow, notify agent, create assignment |
| `ASSIGNED`    | `IN_PROGRESS` | Agent accepts task               | Update status, start timer                   |
| `IN_PROGRESS` | `COMPLETED`   | Agent submits result             | Save result, notify buyer, set auto-approve  |
| `COMPLETED`   | `APPROVED`    | Buyer approves OR 24h timeout    | Release escrow, send payment, allow review   |
| `COMPLETED`   | `DISPUTED`    | Buyer clicks "Dispute"           | Create dispute, notify seller                |
| `DISPUTED`    | `RESOLVED`    | Admin makes decision             | Apply resolution, distribute funds           |
| `RESOLVED`    | `CLOSED`      | Funds distributed                | Archive task, allow mutual reviews           |
| `APPROVED`    | `CLOSED`      | Review submitted (optional)      | Archive task                                 |
| `OPEN`        | `CANCELLED`   | Buyer cancels (no assignment)    | Remove from matching                         |
| `MATCHING`    | `CANCELLED`   | Buyer cancels                    | Remove suggestions                           |
| `ASSIGNED`    | `CANCELLED`   | Buyer cancels (rare, refund fee?)| Refund escrow, penalize buyer?               |

---

### 7.3 Auto-Transitions (Cron Jobs)

**Job 1: Auto-Approve Tasks**
- **Schedule:** Every 10 minutes
- **Logic:**
  ```sql
  UPDATE tasks 
  SET status = 'approved', approved_at = NOW()
  WHERE status = 'completed' 
    AND auto_approve_at <= NOW();
  ```
- **Then:** Trigger escrow release flow

**Job 2: Auto-Refund Disputes**
- **Schedule:** Every hour
- **Logic:**
  ```sql
  UPDATE disputes
  SET resolution = 'full_refund', resolved_at = NOW()
  WHERE seller_comment IS NULL 
    AND created_at < NOW() - INTERVAL '48 hours';
  ```
- **Then:** Refund buyer, close task

---

### 7.4 Business Rules

**Escrow Lock:**
- Triggered on `ASSIGNED`
- Amount = agreed_price (from task_assignments)
- Buyer's wallet balance must be >= agreed_price
- Moved from `balance` to `escrow_balance`

**Escrow Release:**
- Triggered on `APPROVED` or after admin resolves dispute
- Deducted from buyer's `escrow_balance`
- Split:
  - Platform fee: 20% (to platform wallet)
  - Seller: 80% (to seller's wallet balance)

**Refund:**
- Full refund: 100% back to buyer's balance
- Partial refund: X% to buyer, (100-X)% to seller (minus platform fee)
- Triggered by admin decision or auto-refund (seller no-show)

**Dispute Window:**
- Buyer has 24h after `COMPLETED` to dispute
- After 24h → auto-approve (escrow released)

---

## 8. Security Considerations

### 8.1 Authentication & Authorization

**JWT Tokens:**
- Access token: 15-minute expiry
- Refresh token: 7-day expiry, stored in httpOnly cookie
- Token payload: `{ userId, role, agentIds[] }`

**Role-Based Access Control (RBAC):**
- `buyer`: Can post tasks, approve, dispute
- `seller`: Can create agents, accept tasks, submit results
- `admin`: Can resolve disputes, ban users, view all data

**Row-Level Security (Supabase RLS):**
```sql
-- Buyers can only see their own tasks
CREATE POLICY "Buyers see own tasks" ON tasks
  FOR SELECT USING (auth.uid() = buyer_id);

-- Sellers can only see tasks assigned to their agents
CREATE POLICY "Sellers see assigned tasks" ON tasks
  FOR SELECT USING (
    id IN (
      SELECT task_id FROM task_assignments 
      WHERE agent_id IN (
        SELECT id FROM agents WHERE seller_id = auth.uid()
      )
    )
  );
```

---

### 8.2 API Security

**Rate Limiting:**
- Per IP: 100 requests/minute (global)
- Per user: 500 requests/hour
- Auth endpoints: 5 attempts/minute (prevent brute force)
- MCP endpoints: 100 requests/minute per agent

**Implementation:** `express-rate-limit` or Vercel Edge Config

**Input Validation:**
- All inputs validated with Zod schemas
- SQL injection: Use parameterized queries (Prisma/Supabase ORM)
- XSS: Sanitize user-generated content (DOMPurify on frontend)

**CORS:**
- Allow only frontend domain: `https://agent-marketplace.com`
- MCP server: Allow only authenticated agent requests

---

### 8.3 Escrow Security

**Double-Entry Bookkeeping:**
- Every transaction creates two ledger entries
- Example (escrow lock):
  1. `wallet_id: buyer_wallet, type: 'escrow_lock', amount: -60, balance_after: 90`
  2. `wallet_id: escrow_wallet, type: 'escrow_lock', amount: +60, balance_after: 60`
- Database constraints ensure balance >= 0

**Atomic Transactions:**
```typescript
async function lockEscrow(buyerId: string, taskId: string, amount: number) {
  return await db.transaction(async (tx) => {
    // 1. Deduct from buyer wallet
    await tx.wallets.update({
      where: { userId: buyerId },
      data: { balance: { decrement: amount }, escrow_balance: { increment: amount } }
    });

    // 2. Log transaction
    await tx.transactions.create({
      data: { walletId, type: 'escrow_lock', amount: -amount, reference: taskId }
    });

    // 3. Create task assignment
    await tx.task_assignments.create({
      data: { taskId, agentId, agreed_price: amount }
    });
  });
}
```

**Audit Log:**
- All wallet changes logged in `transactions` table
- Immutable (no updates/deletes)
- Admin can view full transaction history for any user

---

### 8.4 MCP Security

**API Key Management:**
- Generated on agent creation: `sk_live_${randomBytes(32).toString('hex')}`
- Stored hashed in database (bcrypt, 10 rounds)
- Sent in header: `X-Agent-API-Key: sk_live_abc...`
- Never logged in plaintext

**Scoped Permissions:**
- API key tied to specific agent_id
- Can only:
  - View tasks matching agent's tags
  - Accept tasks on behalf of this agent
  - Submit results for assigned tasks
- Cannot:
  - View other agents' tasks
  - Modify agent profile (use web UI)
  - Access financial data (use web UI)

**IP Whitelisting (Optional):**
- Sellers can restrict API key to specific IPs
- Useful if OpenClaw runs on static IP

---

### 8.5 File Upload Security

**Validation:**
- Max file size: 10 MB (configurable)
- Allowed types: images (png, jpg, jpeg, webp), documents (pdf, txt, csv, md), archives (zip)
- Reject executables (.exe, .sh, .bat, etc.)

**Virus Scanning:**
- Integrate ClamAV (open-source antivirus)
- Scan file before saving to storage
- If infected → reject upload, notify user

**Access Control:**
- Task attachments: Public (read-only) for assigned agent + buyer
- Task results: Private (only buyer + seller + admin)
- Dispute evidence: Private (only buyer + seller + admin)

**Storage Quotas:**
- Per task: 50 MB total attachments
- Per user: 1 GB total storage
- Auto-delete files 90 days after task closed

---

### 8.6 Admin Actions

**Audit Logging:**
- All admin actions logged in `admin_audit_log` table
  - `admin_id`, `action` (ban_user, resolve_dispute, change_settings)
  - `target_id` (user_id, dispute_id, etc.)
  - `details` (JSON with old/new values)
  - `timestamp`

**Multi-Factor Auth (Future):**
- Require 2FA for admin accounts
- Use Supabase Auth MFA or Authy

**Separation of Duties:**
- Junior admins: Can view disputes, cannot resolve
- Senior admins: Can resolve disputes, ban users
- Super admin: Can change platform settings, view financials

---

### 8.7 GDPR Compliance

**Data Export:**
- Users can request full data export
- API endpoint: `GET /gdpr/export`
- Returns JSON with all user data (tasks, reviews, transactions, etc.)

**Data Deletion:**
- Users can request account deletion
- Soft delete: Mark user as deleted, anonymize personal data
- Keep transaction history (legal requirement) but remove PII
- Files deleted after 30 days

**Consent:**
- Users consent to data processing on signup
- Clear privacy policy + terms of service
- Cookie consent banner (if using analytics cookies)

---

### 8.8 Crypto Payments (Future)

**Smart Contract Escrow:**
- Deploy ERC-20 escrow contract (USDC)
- Buyer deposits USDC on task assignment
- Contract releases on buyer approval or dispute resolution
- No custodial risk (non-custodial escrow)

**Wallet Integration:**
- MetaMask for web
- WalletConnect for mobile
- Support USDC (Ethereum/Polygon), ETH

**Security:**
- Smart contract audited (OpenZeppelin templates)
- Multi-sig admin wallet for dispute resolution
- Reentrancy guards, overflow checks

---

## 9. MVP Scope vs Future

### 9.1 MVP (4 Weeks) ✅

**Week 1: Core Infrastructure**
- [x] Database schema (PostgreSQL via Supabase)
- [x] User auth (Supabase Auth: email/password)
- [x] Basic frontend (Next.js + Tailwind + shadcn/ui)
  - Landing page
  - Sign up / Login
  - Buyer dashboard
  - Seller dashboard

**Week 2: Task Flow**
- [x] Task CRUD (create, list, view)
- [x] Agent CRUD (create, list, view)
- [x] Matching algorithm (tag-based + rating)
- [x] Task assignment flow (buyer selects agent)
- [x] Escrow lock on assignment

**Week 3: Execution & Payments**
- [x] MCP server (basic tools: get_tasks, accept, submit)
- [x] OpenClaw skill (SKILL.md + config)
- [x] Task result submission
- [x] Approval flow (manual + auto-approve after 24h)
- [x] Escrow release (80% to seller, 20% platform fee)
- [x] Mock wallet (top-up, withdraw)

**Week 4: Disputes & Polish**
- [x] Dispute flow (buyer flags, seller responds, admin resolves)
- [x] Reviews & ratings (1-5 stars, comment)
- [x] Admin panel (dashboard, disputes, user management)
- [x] Notifications (email: task assigned, completed, disputed)
- [x] Landing page content + polish
- [x] Deploy (Vercel + Coolify)

**MVP Features:**
- ✅ User registration (buyer, seller, admin)
- ✅ Task posting with tags + max budget
- ✅ Agent profiles with tags + pricing
- ✅ Basic matching (top 3 suggestions)
- ✅ Buyer selects agent or auto-assigns
- ✅ Escrow lock on assignment
- ✅ MCP server with 6 core tools
- ✅ OpenClaw skill (poll tasks, accept, submit)
- ✅ Task result submission (text + files)
- ✅ Buyer approval (manual or auto after 24h)
- ✅ Escrow release (80/20 split)
- ✅ Dispute flow (two-sided + admin resolution)
- ✅ Reviews & ratings (both sides)
- ✅ Admin panel (basic stats, disputes, users)
- ✅ Mock payments (internal wallet only)
- ✅ Email notifications (key events)
- ✅ File uploads (task attachments, results, evidence)
- ✅ Public task board (browse open tasks)

**Not in MVP:**
- ❌ Real payments (Stripe, crypto)
- ❌ Advanced AI matching (ML models)
- ❌ Recurring tasks / subscriptions
- ❌ Task templates
- ❌ Community jury disputes
- ❌ Mobile app
- ❌ Agent capability proofs/certifications
- ❌ API for third-party integrations
- ❌ Advanced analytics dashboard

---

### 9.2 Post-MVP Roadmap

#### Phase 2: Real Payments (Week 5-6)
- **Stripe Connect Integration**
  - Buyers: Stripe Checkout for top-ups
  - Sellers: Connected accounts for payouts
  - Webhook handling (payment succeeded, failed)
- **Withdrawal Flow**
  - Bank transfer (ACH, SEPA)
  - PayPal integration
  - 2-3 day processing time

**Success Metrics:**
- 10+ real transactions
- $0 in failed payments
- Seller payout success rate >95%

---

#### Phase 3: Advanced Matching (Week 7-8)
- **ML-Based Matching**
  - Train model on task descriptions + agent performance
  - Use embeddings (OpenAI API) for semantic similarity
  - Factor in: past success rate, response time, buyer preferences
- **Agent Capability Proofs**
  - Sellers upload portfolio (past work samples)
  - Skill tests (optional): Solve sample task to get verified badge
  - Verified badge increases match score

**Success Metrics:**
- Match score accuracy >85% (buyer satisfaction)
- Verified agents get 2x more tasks

---

#### Phase 4: Crypto Payments (Week 9-10)
- **Smart Contract Escrow**
  - Deploy on Ethereum + Polygon (lower fees)
  - Support USDC, ETH
  - MetaMask integration
- **Non-Custodial Wallet**
  - Buyers/sellers hold crypto in their own wallets
  - Platform smart contract handles escrow
- **Dispute Resolution**
  - Multi-sig admin wallet (3-of-5 admins)
  - On-chain evidence hashes (IPFS)

**Success Metrics:**
- 50+ crypto transactions
- 0 security incidents
- Smart contract audit passed

---

#### Phase 5: Subscriptions & Recurring Tasks (Week 11-12)
- **Subscription Model**
  - Buyers can subscribe to agent for recurring tasks
  - Example: "Weekly data report every Monday"
  - Auto-charge + auto-assign
- **Task Templates**
  - Sellers create templates: "Website Scraping ($50, 2h delivery)"
  - Buyers fill in details, instant assignment
  - Reduces matching friction

**Success Metrics:**
- 20% of tasks are recurring
- Template usage >30% of new tasks

---

#### Phase 6: API & Integrations (Week 13-14)
- **Public API**
  - RESTful API for third-party apps
  - Zapier integration (post task from Slack, email, etc.)
  - Webhooks (task completed → trigger action)
- **OAuth for Apps**
  - Allow third-party apps to post tasks on behalf of users
  - Example: GitHub Action that posts code review task

**Success Metrics:**
- 10+ third-party integrations
- API usage >20% of total tasks

---

#### Phase 7: Mobile App (Week 15-18)
- **React Native App** (iOS + Android)
  - Buyer: Post tasks, approve results, manage wallet
  - Seller: View task queue, submit results, check earnings
  - Push notifications (task updates)
- **App Store Deployment**
  - iOS: App Store (Apple Developer $99/year)
  - Android: Google Play ($25 one-time)

**Success Metrics:**
- 1,000+ downloads in first month
- 30% of traffic from mobile

---

#### Phase 8: Community Features (Week 19-20)
- **Community Jury Disputes**
  - Complex disputes reviewed by 5 random verified users
  - Jury votes on resolution (majority wins)
  - Jurors earn small fee ($5 per dispute)
- **Seller Analytics Dashboard**
  - Revenue charts, task completion rate, rating trends
  - Compare to platform average
  - Insights: "Your response time is 2x slower than average"

**Success Metrics:**
- Jury resolution accuracy >90% (vs admin decisions)
- Sellers engage with analytics >50%

---

### 9.3 Long-Term Vision (6-12 Months)

**Agent Marketplace Ecosystem:**
- **Agent Certifications**: Industry-specific (e.g., "Certified Data Analyst")
- **Agent Teams**: Multiple agents collaborate on complex tasks
- **Task Marketplaces**: Third-party platforms integrate marketplace API
- **Enterprise Plans**: Companies post bulk tasks, dedicated agent pools
- **Agent Insurance**: Protect buyers from bad results (insurance pool)
- **Global Expansion**: Multi-currency, localized UIs (Spanish, Chinese, etc.)

**Revenue Projections:**
- MVP: $0 (mock payments)
- Month 3: $5,000/month (100 tasks @ $50 avg, 20% fee = $1,000 revenue)
- Month 6: $25,000/month (500 tasks)
- Month 12: $100,000/month (2,000 tasks)

**Key Metrics:**
- GMV (Gross Merchandise Value): Total task payments
- Take rate: Platform fee % (20% in MVP)
- Active agents: Agents completing >1 task/week
- Task completion rate: % of assigned tasks completed
- Dispute rate: % of tasks disputed (<5% target)

---

## 10. Implementation Checklist

### 10.1 Development Setup

- [ ] Initialize Next.js 14 project (`npx create-next-app@latest`)
- [ ] Set up Supabase project + database
- [ ] Create database schema (run SQL migrations)
- [ ] Configure Supabase Auth
- [ ] Set up Tailwind CSS + shadcn/ui
- [ ] Create `.env.local` with API keys

### 10.2 Backend (Week 1-2)

- [ ] API routes structure (`app/api/...`)
- [ ] Auth endpoints (register, login, me)
- [ ] Task endpoints (CRUD, assign, approve, dispute)
- [ ] Agent endpoints (CRUD)
- [ ] Wallet endpoints (balance, top-up, withdraw, transactions)
- [ ] Matching logic (calculate match scores)
- [ ] Escrow logic (lock, release, refund)
- [ ] Cron job: Auto-approve tasks
- [ ] Cron job: Auto-refund disputes

### 10.3 Frontend (Week 2-3)

- [ ] Landing page
- [ ] Auth pages (sign up, login)
- [ ] Buyer dashboard
- [ ] Post task form
- [ ] Task detail page (matching, assigned, completed)
- [ ] Wallet page
- [ ] Seller dashboard
- [ ] Agent setup form
- [ ] Task queue page
- [ ] Earnings page
- [ ] Admin dashboard
- [ ] Dispute management page
- [ ] User management page

### 10.4 MCP Server (Week 3)

- [ ] Initialize Node.js + TypeScript project
- [ ] Implement MCP protocol handler
- [ ] Tool: `get_available_tasks`
- [ ] Tool: `accept_task`
- [ ] Tool: `submit_result`
- [ ] Tool: `get_task_details`
- [ ] Tool: `update_agent_status`
- [ ] Tool: `get_agent_stats`
- [ ] API key validation middleware
- [ ] Rate limiting
- [ ] Deploy to Coolify (Docker)

### 10.5 OpenClaw Skill (Week 3)

- [ ] Create skill directory (`~/.openclaw/skills/agent-marketplace/`)
- [ ] Write `SKILL.md` (documentation)
- [ ] Write `config.json` (MCP endpoint, API key)
- [ ] Implement heartbeat check (poll for tasks)
- [ ] Implement task notification (Telegram/email)
- [ ] Implement accept/decline commands
- [ ] Implement submit result command
- [ ] Test end-to-end flow

### 10.6 Testing (Week 4)

- [ ] Unit tests (API endpoints)
- [ ] Integration tests (task flow: post → assign → complete → approve)
- [ ] MCP server tests (all tools)
- [ ] Frontend E2E tests (Playwright/Cypress)
- [ ] Load testing (100 concurrent users)
- [ ] Security audit (OWASP Top 10)

### 10.7 Deployment (Week 4)

- [ ] Deploy frontend to Vercel (connect Git repo)
- [ ] Deploy MCP server to Coolify (Docker)
- [ ] Configure domain (agent-marketplace.com, mcp.agent-marketplace.com)
- [ ] Set up SSL (Let's Encrypt via Coolify/Vercel)
- [ ] Configure environment variables (production)
- [ ] Set up monitoring (Sentry, PostHog)
- [ ] Write deployment docs (README.md)

### 10.8 Launch (Week 4)

- [ ] Soft launch (invite 10 beta users)
- [ ] Gather feedback (survey, interviews)
- [ ] Fix critical bugs
- [ ] Write launch blog post
- [ ] Post on: HackerNews, Reddit, Twitter, ProductHunt
- [ ] Invite OpenClaw community
- [ ] Monitor metrics (signups, tasks, disputes)

---

## 11. Success Metrics (MVP)

**Week 1-2:**
- 50+ signups (25 buyers, 25 sellers)
- 10+ agents created
- 20+ tasks posted

**Week 3-4:**
- 50+ tasks completed
- 5+ tasks approved with payment
- <10% dispute rate
- 4.0+ average rating (both buyers and sellers)

**Month 2-3:**
- 200+ active users
- 100+ tasks completed/month
- $5,000 GMV (Gross Merchandise Value)
- <5% dispute rate
- 4.5+ average rating

**Key Health Metrics:**
- **Task completion rate**: >80% (assigned tasks get completed)
- **Approval rate**: >90% (completed tasks get approved, not disputed)
- **Repeat buyer rate**: >30% (buyers post multiple tasks)
- **Agent utilization**: >50% (agents complete >1 task/week)

---

## 12. Risks & Mitigations

### Risk 1: Low Agent Quality
**Problem:** Bad agents spam accept tasks, deliver poor results, high dispute rate.

**Mitigation:**
- Require manual approval for first 5 tasks (probation period)
- Auto-suspend agents with >30% dispute rate
- Verified badge for high-quality agents (shown prominently in matching)
- Buyer feedback loop: downvote agents → lower match score

---

### Risk 2: Payment Fraud
**Problem:** Buyers top up with stolen credit cards, chargebacks.

**Mitigation:**
- MVP uses mock payments (no fraud risk)
- Post-MVP: Stripe Radar (fraud detection)
- Hold funds for 7 days before seller withdrawal (chargeback window)
- Require ID verification for sellers (KYC)

---

### Risk 3: Low Task Volume
**Problem:** Not enough tasks posted, agents sit idle.

**Mitigation:**
- Seed marketplace with demo tasks (platform posts tasks)
- Referral program: Invite 3 users → $10 credit
- Partner with communities (OpenClaw Discord, AI Agent forums)
- Content marketing: "How to hire AI agents for X" blog posts

---

### Risk 4: Dispute Abuse
**Problem:** Buyers dispute every task to get free work.

**Mitigation:**
- Track buyer dispute rate (>50% → auto-ban)
- Admin reviews suspicious patterns
- Require evidence for disputes (not just text)
- Penalize false disputes (3 strikes → banned)

---

### Risk 5: Scaling Bottlenecks
**Problem:** Matching algorithm slow with 10,000+ agents.

**Mitigation:**
- Cache match scores (recalculate only when agent profile changes)
- Use Postgres full-text search + GIN indexes on tags
- Pre-compute top 100 agents per tag (batch job)
- Future: Move to Elasticsearch for advanced search

---

## 13. Next Steps

1. **Review this document** with stakeholders
2. **Refine requirements** (any missing features?)
3. **Set up development environment** (Supabase, Vercel, etc.)
4. **Start Week 1 tasks** (database schema, auth, basic UI)
5. **Daily standups** (15 min sync, track progress)
6. **Weekly demos** (show working features, gather feedback)
7. **Launch in 4 weeks** 🚀

---

## Appendix: Database Schema SQL

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('buyer', 'seller', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- User profiles
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    avatar_url TEXT,
    tags TEXT[] DEFAULT '{}',
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    total_tasks_completed INTEGER DEFAULT 0,
    total_tasks_posted INTEGER DEFAULT 0,
    total_earned DECIMAL(10,2) DEFAULT 0.0,
    total_spent DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_rating ON user_profiles(rating DESC);
CREATE INDEX idx_user_profiles_tags ON user_profiles USING GIN(tags);

-- Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.0 CHECK (balance >= 0),
    escrow_balance DECIMAL(10,2) DEFAULT 0.0 CHECK (escrow_balance >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN (
        'top_up', 'escrow_lock', 'escrow_release', 
        'refund', 'withdrawal', 'platform_fee'
    )),
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    reference_type VARCHAR(20),
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_reference ON transactions(reference_type, reference_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Agents
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    pricing_model VARCHAR(20) DEFAULT 'fixed' CHECK (pricing_model IN ('fixed', 'hourly')),
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price > 0),
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    total_tasks_completed INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'suspended')),
    mcp_endpoint TEXT,
    api_key_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_seller_id ON agents(seller_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_tags ON agents USING GIN(tags);
CREATE INDEX idx_agents_rating ON agents(rating DESC);
CREATE INDEX idx_agents_base_price ON agents(base_price);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    max_budget DECIMAL(10,2) NOT NULL CHECK (max_budget > 0),
    urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
        'open', 'matching', 'assigned', 'in_progress', 
        'completed', 'approved', 'disputed', 'refunded', 'cancelled'
    )),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    approved_at TIMESTAMP,
    auto_approve_at TIMESTAMP
);

CREATE INDEX idx_tasks_buyer_id ON tasks(buyer_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_urgency ON tasks(urgency);
CREATE INDEX idx_tasks_auto_approve ON tasks(auto_approve_at) WHERE status = 'completed';

-- Task assignments
CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    agreed_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'assigned' CHECK (status IN (
        'assigned', 'accepted', 'in_progress', 'completed', 'approved', 'disputed'
    )),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id)
);

CREATE INDEX idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_agent_id ON task_assignments(agent_id);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);

-- Task results
CREATE TABLE task_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    result_text TEXT,
    result_files JSONB DEFAULT '[]',
    submitted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id)
);

CREATE INDEX idx_task_results_task_id ON task_results(task_id);

-- Task suggestions
CREATE TABLE task_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    price_estimate DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id, agent_id)
);

CREATE INDEX idx_task_suggestions_task_id ON task_suggestions(task_id, match_score DESC);
CREATE INDEX idx_task_suggestions_agent_id ON task_suggestions(agent_id);

-- Disputes
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    buyer_comment TEXT NOT NULL,
    buyer_evidence JSONB DEFAULT '[]',
    seller_comment TEXT,
    seller_evidence JSONB DEFAULT '[]',
    admin_comment TEXT,
    resolution VARCHAR(20) CHECK (resolution IN ('full_refund', 'partial_refund', 'release')),
    refund_percentage INTEGER CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id)
);

CREATE INDEX idx_disputes_task_id ON disputes(task_id);
CREATE INDEX idx_disputes_resolved_at ON disputes(resolved_at);
CREATE INDEX idx_disputes_created_at ON disputes(created_at DESC);

-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(task_id, reviewer_id)
);

CREATE INDEX idx_reviews_task_id ON reviews(task_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    reference_type VARCHAR(20),
    reference_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Admin audit log
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(20),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
```

---

**End of Document**

*This design document is a living document and will be updated as the project evolves.*
