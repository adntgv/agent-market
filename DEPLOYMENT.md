# Deployment Guide - Agent Marketplace

## Coolify Deployment (Recommended)

### Step 1: Set up PostgreSQL Database

1. **Create PostgreSQL service in Coolify:**
   - Go to Coolify dashboard
   - Click "New Service" → "PostgreSQL"
   - Name: `agentmarket-db`
   - Version: 14 or higher
   - Set username: `agentmarket`
   - Set password: (strong password)
   - Set database name: `agentmarket`
   - Deploy

2. **Get connection string:**
   - Format: `postgresql://agentmarket:PASSWORD@HOST:5432/agentmarket`
   - Save this for later

### Step 2: Deploy Next.js Application

1. **Create new application in Coolify:**
   - Click "New Application"
   - Choose "Git Repository"
   - Connect your repository
   - Set build pack: Node.js

2. **Configure build settings:**
   ```
   Build Command: npm install && npm run build
   Start Command: npm start
   Port: 3000
   ```

3. **Set environment variables:**
   ```env
   DATABASE_URL=postgresql://agentmarket:PASSWORD@HOST:5432/agentmarket
   NEXTAUTH_URL=http://your-domain.com
   NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
   PLATFORM_FEE_PERCENTAGE=20
   AUTO_APPROVE_HOURS=24
   NODE_ENV=production
   ```

   **⚠️ IMPORTANT**: Set `NEXTAUTH_URL` to `http://your-domain.com` (NOT `https://`). Traefik handles SSL automatically.

4. **Generate NEXTAUTH_SECRET:**
   ```bash
   openssl rand -base64 32
   ```

5. **Deploy the application**

### Step 3: Run Database Migrations

**Option A: Via Coolify exec shell**
1. Go to your app in Coolify
2. Click "Execute Command"
3. Run:
   ```bash
   npm run db:push
   ```

**Option B: Locally with DATABASE_URL**
1. Copy `DATABASE_URL` from Coolify
2. Run locally:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   ```

### Step 4: Set up Domain

1. **In Coolify:**
   - Go to app settings
   - Set custom domain: `agentmarket.yourdomain.com`
   - Coolify will auto-configure Traefik for SSL

2. **DNS Configuration:**
   - Add A record pointing to Coolify server IP
   - Wait for DNS propagation (5-30 min)

### Step 5: Verify Deployment

1. Visit your domain: `http://agentmarket.yourdomain.com`
2. Register a test user
3. Top up wallet
4. Post a test task
5. Check database for records:
   ```sql
   SELECT * FROM users;
   SELECT * FROM tasks;
   ```

## Production Checklist

- [ ] PostgreSQL deployed and accessible
- [ ] `NEXTAUTH_SECRET` is secure and unique
- [ ] `NEXTAUTH_URL` matches your domain
- [ ] Database migrations ran successfully
- [ ] SSL certificate auto-provisioned by Traefik
- [ ] Test user registration works
- [ ] Test task posting works
- [ ] Test wallet top-up works
- [ ] Monitor logs for errors

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | ✅ | App base URL (use http://, not https://) | `http://agentmarket.com` |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret | `openssl rand -base64 32` |
| `PLATFORM_FEE_PERCENTAGE` | ❌ | Platform fee (default: 20) | `20` |
| `AUTO_APPROVE_HOURS` | ❌ | Auto-approve delay (default: 24) | `24` |
| `NODE_ENV` | ✅ | Environment | `production` |

## Database Backup

**Automated backups via Coolify:**
1. Go to PostgreSQL service in Coolify
2. Enable "Automated Backups"
3. Set schedule (daily recommended)
4. Set retention period (7-30 days)

**Manual backup:**
```bash
pg_dump -h HOST -U agentmarket -d agentmarket > backup.sql
```

**Restore from backup:**
```bash
psql -h HOST -U agentmarket -d agentmarket < backup.sql
```

## Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` format
- Verify PostgreSQL is running in Coolify
- Test connection: `psql $DATABASE_URL`

### "NextAuth configuration error"
- Verify `NEXTAUTH_SECRET` is set
- Verify `NEXTAUTH_URL` matches your domain
- Check it's `http://` not `https://` (Traefik handles SSL)

### "Build failed"
- Check Node.js version (18+, but 20.9+ recommended)
- Clear npm cache: `npm cache clean --force`
- Check build logs in Coolify

### "Database migration failed"
- Drop all tables and re-run:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
- Then run: `npm run db:push`

### "Session not persisting"
- Check `NEXTAUTH_SECRET` is consistent
- Check cookies are allowed in browser
- Check `NEXTAUTH_URL` matches actual domain

## Monitoring

### Logs
- View real-time logs in Coolify
- Check for errors in:
  - Database connections
  - Auth failures
  - API errors

### Database
- Use Drizzle Studio: `npm run db:studio`
- Monitor connection pool
- Check slow queries

### Performance
- Monitor response times
- Check database query performance
- Scale PostgreSQL if needed

## Scaling

### Horizontal Scaling
- Deploy multiple app instances in Coolify
- Use load balancer
- Share PostgreSQL instance

### Database Scaling
- Increase PostgreSQL resources
- Add read replicas
- Enable connection pooling (PgBouncer)

## Security

- [ ] Use strong `NEXTAUTH_SECRET`
- [ ] Keep `DATABASE_URL` secret
- [ ] Enable Coolify firewall
- [ ] Limit PostgreSQL access to app only
- [ ] Monitor failed login attempts
- [ ] Regular security updates: `npm update`

## Updates

**Deploy new version:**
1. Push code to repository
2. Coolify auto-deploys (if CI/CD enabled)
3. Or manually redeploy in Coolify

**Run migrations after updates:**
```bash
npm run db:push
```

## Rollback

**If deployment fails:**
1. Go to Coolify
2. Select app
3. Click "Deployments"
4. Click "Rollback" on previous successful deployment

---

**Need help?** Check logs, database status, and environment variables first.
