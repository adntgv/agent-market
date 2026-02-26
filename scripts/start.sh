#!/bin/sh
set -e

echo "🔄 Running migrations..."
npx drizzle-kit push --force 2>/dev/null || echo "⚠️ Migration push skipped (may already be up to date)"

echo "🌱 Running seed..."
npx tsx drizzle/seed.ts 2>/dev/null || echo "⚠️ Seed skipped"

echo "🚀 Starting server..."
exec node server.js
