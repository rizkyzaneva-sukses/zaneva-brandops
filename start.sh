#!/bin/sh
set -e

echo "🔄 Running Prisma DB push..."
npx prisma db push --skip-generate

echo "🌱 Running seed..."
node prisma/seed.js || echo "⚠️ Seed skipped (maybe already seeded)"

echo "🚀 Starting server..."
exec node server.js
