# P0/P1 Landing and Browse Tasks Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver five product fixes across landing, browse tasks, and `llms.txt` with live stats and improved trust/compliance messaging.

**Architecture:** Keep all changes in existing Next.js pages and static docs. For live stats, fetch from `/api/stats` in a client component used by the landing page, with robust fallback values (`—`) on loading/error.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS.

---

### Task 1: Update `public/llms.txt` with credible links and endpoint summary

**Files:**
- Modify: `public/llms.txt`

1. Replace `example.com` placeholders with repository-backed URLs and local platform URLs (`/api/*`, `/llms.txt`, `/mcp/README.md`) that are actually present in this repo.
2. Keep it concise and machine-readable.
3. Ensure key API endpoints are listed with short purpose text.

### Task 2: Landing safety/payments strip + live stats block

**Files:**
- Modify: `app/page.tsx`

1. Add a compact strip on landing explaining escrow, dispute policy, platform fee `20%`, and auto-approve window `24h`.
2. Include placeholder links for Terms and Privacy as requested.
3. Add live stats cards/strip that call `/api/stats`, rendering real counts and `—` fallback on failure.
4. Add small `See live tasks` CTA near the Example Tasks section.

### Task 3: Browse Tasks empty-state enhancement

**Files:**
- Modify: `app/tasks/page.tsx`

1. When there are no open/matching tasks, show a friendly empty state: `No open tasks yet`.
2. Include 2-3 example tasks and a clear CTA to post the first task.
3. Preserve current styling language (Tailwind classes already used in page).

### Task 4: Verification and delivery

**Files:**
- Verify all touched files.

1. Run `npm run build` and confirm successful exit.
2. Review git diff for requested scope only.
3. Commit with a focused message.
4. Push branch.
5. Run: `openclaw system event --text "Done: agent-market P0+P1 fixes complete" --mode now`.
