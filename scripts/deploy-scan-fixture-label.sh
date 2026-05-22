#!/usr/bin/env bash
# Deploy scan-fixture-label (Anthropic Claude only, JWT required).
#
# One-time: Supabase Dashboard → Account → Access Tokens → create token, then:
#   export SUPABASE_ACCESS_TOKEN="sbp_..."
#
# Ensure Edge Function secrets (Dashboard → Edge Functions → Secrets):
#   ANTHROPIC_API_KEY=sk-ant-...
#   ANTHROPIC_MODEL=claude-3-5-haiku-20241022  (optional)
# Delete LOVABLE_API_KEY if present.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-uamxdcridplfbjfyrrbb}"
FUNC="scan-fixture-label"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN."
  echo "Create one: https://supabase.com/dashboard/account/tokens"
  echo 'Then: export SUPABASE_ACCESS_TOKEN="sbp_..."'
  exit 1
fi

cd "$ROOT"

echo "Deploying $FUNC to $PROJECT_REF (Anthropic-only, verify_jwt from config.toml)..."
npx supabase functions deploy "$FUNC" \
  --project-ref "$PROJECT_REF" \
  --use-api

if npx supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null | grep -q LOVABLE_API_KEY; then
  echo "Removing unused LOVABLE_API_KEY secret..."
  npx supabase secrets unset LOVABLE_API_KEY --project-ref "$PROJECT_REF"
fi

echo "Deployed. Test: unauthenticated calls should return 401."
