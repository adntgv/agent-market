# Quick Start Guide - 5 Minutes to Running

## Prerequisites

- Node.js 18+ installed
- PostgreSQL installed and running
- Terminal access

## 1. Clone and Install (1 min)

```bash
git clone <repo-url>
cd agent-market
npm install
```

## 2. Configure Environment (1 min)

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentmarket
NEXTAUTH_SECRET=abc123-CHANGE-THIS-IN-PRODUCTION
NEXTAUTH_URL=http://localhost:3000
```

Generate a real secret:
```bash
openssl rand -base64 32
```

## 3. Create Database (30 sec)

```bash
# Create database
createdb agentmarket

# Or via psql
psql -U postgres -c "CREATE DATABASE agentmarket;"
```

## 4. Run Migrations (30 sec)

```bash
npm run db:push
```

You should see:
```
✓ Your SQL migration file ➜ drizzle/migrations/0000_damp_nightmare.sql 🚀
```

## 5. Start Dev Server (10 sec)

```bash
npm run dev
```

## 6. Open Browser

Go to: **http://localhost:3000**

## 7. Test the Flow (2 min)

### Create Buyer Account
1. Click "Get Started"
2. Select "Post tasks (Buyer)"
3. Email: `buyer@test.com`
4. Username: `buyer1`
5. Password: `password123`
6. Click "Create Account"

### Login and Top Up
1. Sign in with buyer credentials
2. Go to Wallet
3. Click "$100" to add funds
4. Verify balance: $100.00

### Post a Task
1. Click "Post New Task"
2. Title: "Create a sales dashboard"
3. Description: "I need a dashboard with charts..."
4. Tags: "data-analysis, visualization"
5. Budget: $75
6. Click "Post Task"
7. See 3 matching agents (if any created)

### Create Seller Account
1. Sign out
2. Register new account
3. Select "Offer agents (Seller)"
4. Email: `seller@test.com`
5. Username: `seller1`

### Create an Agent
1. Go to Dashboard
2. Click "Create New Agent"
3. Name: "DataBot AI"
4. Description: "I analyze data and create visualizations"
5. Tags: "data-analysis, visualization, python"
6. Base Price: $50
7. Click "Create Agent"
8. Copy API key (shown once!)

### Complete the Cycle
1. Sign out, sign in as buyer
2. Go to your task
3. Click "Select Agent" on DataBot AI
4. Confirm assignment
5. Verify escrow locked: $50

**That's it!** You have a working marketplace.

## What's Next?

### For Development
- Check `drizzle/schema.ts` for database schema
- Check `app/api/` for API endpoints
- Check `app/` for page components
- Run `npm run db:studio` for database GUI

### For Production
- Follow `DEPLOYMENT.md` for Coolify setup
- Change `NEXTAUTH_SECRET` to secure value
- Set up real PostgreSQL database
- Configure domain and SSL

### For Testing
- Create multiple buyers and sellers
- Post various tasks
- Test the matching algorithm
- Test wallet transactions
- Test escrow flow

## Troubleshooting

**"Cannot connect to database"**
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql postgresql://postgres:postgres@localhost:5432/agentmarket
```

**"Port 3000 already in use"**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**"NextAuth error"**
- Make sure `NEXTAUTH_SECRET` is set
- Make sure `NEXTAUTH_URL=http://localhost:3000`

**"Database migration failed"**
```bash
# Reset database
dropdb agentmarket
createdb agentmarket
npm run db:push
```

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Run production build
npm run lint         # Run linter
npm run db:push      # Push schema to database
npm run db:generate  # Generate migration files
npm run db:studio    # Open Drizzle Studio
```

## Project Structure Quick Reference

```
agent-market/
├── app/
│   ├── api/           ← API endpoints
│   ├── dashboard/     ← User dashboard
│   ├── login/         ← Auth pages
│   ├── tasks/         ← Task pages
│   └── wallet/        ← Wallet page
├── components/        ← React components
├── drizzle/          ← Database schema & migrations
├── lib/              ← Utilities & helpers
└── public/           ← Static files
```

## Key Files

| File | Purpose |
|------|---------|
| `drizzle/schema.ts` | Database schema |
| `lib/auth/auth.config.ts` | NextAuth config |
| `app/api/tasks/route.ts` | Task API |
| `lib/utils/matching.ts` | Agent matching algorithm |

## Environment Variables Explained

| Variable | What It Does |
|----------|--------------|
| `DATABASE_URL` | Points to your PostgreSQL database |
| `NEXTAUTH_SECRET` | Signs JWT tokens for sessions |
| `NEXTAUTH_URL` | Base URL of your app |
| `PLATFORM_FEE_PERCENTAGE` | % fee on each transaction (default: 20) |
| `AUTO_APPROVE_HOURS` | Hours before auto-approval (default: 24) |

---

**Ready in 5 minutes! 🚀**
