#!/bin/sh
set -e

echo "🔄 Running Prisma DB push..."
node node_modules/prisma/build/index.js db push --skip-generate

echo "🌱 Running seed..."
node prisma/seed.js || echo "⚠️ Seed skipped (maybe already seeded)"

echo "🚀 Starting server..."
exec node server.js
