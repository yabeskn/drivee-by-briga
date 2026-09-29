#!/bin/bash
# bulk-env.sh — Bulk update environment variables for Drifee by Briga
# Usage: bash scripts/bulk-env.sh [local|vercel]

set -e

MODE=${1:-local}

echo "=========================================="
echo "  Drifee by Briga — Bulk Env Setup"
echo "  Mode: $MODE"
echo "=========================================="

# ── Generate NEXTAUTH_SECRET ──────────────────────────────
echo ""
echo "🔑 Generating NEXTAUTH_SECRET..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "   Generated: ${NEXTAUTH_SECRET:0:20}..."

# ── Environment Variables ─────────────────────────────────
declare -A ENV_VARS=(
  ["GOOGLE_CLIENT_ID"]="your-client-id.apps.googleusercontent.com"
  ["GOOGLE_CLIENT_SECRET"]="your-client-secret"
  ["NEXTAUTH_SECRET"]="$NEXTAUTH_SECRET"
  ["NEXTAUTH_URL"]="https://drifee.briga.id"
  ["NEXT_PUBLIC_APP_URL"]="https://drifee.briga.id"
  ["ALLOWED_ORIGINS"]="https://drifee.briga.id"
  ["OSRM_URL"]="https://router.project-osrm.org"
  ["BAILEYS_CONFIG_PATH"]="./baileys-config.json"
)

# ── Mode: Local (.env.local) ──────────────────────────────
if [ "$MODE" = "local" ]; then
  echo ""
  echo "📝 Writing to .env.local..."

  # Backup existing
  if [ -f .env.local ]; then
    cp .env.local .env.local.backup
    echo "   Backed up existing .env.local"
  fi

  # Write env vars
  for key in "${!ENV_VARS[@]}"; do
    echo "$key=${ENV_VARS[$key]}" >> .env.local
    echo "   ✓ $key"
  done

  echo ""
  echo "✅ Done! .env.local updated."
  echo "   Run 'npm run dev' to start development server."

# ── Mode: Vercel ──────────────────────────────────────────
elif [ "$MODE" = "vercel" ]; then
  echo ""
  echo "🚀 Setting environment variables in Vercel..."

  for key in "${!ENV_VARS[@]}"; do
    echo "   Adding $key..."
    echo "${ENV_VARS[$key]}" | vercel env add "$key" production
  done

  echo ""
  echo "✅ Done! All env vars set in Vercel."
  echo "   Redeploy to apply changes."

else
  echo "❌ Invalid mode. Use: bash scripts/bulk-env.sh [local|vercel]"
  exit 1
fi

echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo "  GOOGLE_CLIENT_ID:     ${ENV_VARS["GOOGLE_CLIENT_ID"]}"
echo "  GOOGLE_CLIENT_SECRET: ${ENV_VARS["GOOGLE_CLIENT_SECRET"]}"
echo "  NEXTAUTH_SECRET:      ${NEXTAUTH_SECRET:0:20}..."
echo "  NEXTAUTH_URL:         ${ENV_VARS["NEXTAUTH_URL"]}"
echo "  NEXT_PUBLIC_APP_URL:  ${ENV_VARS["NEXT_PUBLIC_APP_URL"]}"
echo "  ALLOWED_ORIGINS:      ${ENV_VARS["ALLOWED_ORIGINS"]}"
echo "  OSRM_URL:             ${ENV_VARS["OSRM_URL"]}"
echo "  BAILEYS_CONFIG_PATH:  ${ENV_VARS["BAILEYS_CONFIG_PATH"]}"
echo "=========================================="
