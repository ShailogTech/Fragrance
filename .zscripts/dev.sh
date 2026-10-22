#!/bin/bash
cd /home/z/my-project

echo "[DEV] Installing dependencies..."
bun install 2>/dev/null || true

echo "[DEV] Setting up database..."
bun run db:push 2>/dev/null || true

echo "[DEV] Starting development server..."
npx next dev -p 3000 2>&1 | tee dev.log
