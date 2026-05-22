#!/usr/bin/env bash
# Push current branch to origin (Vercel) and lovable (Lovable preview).
set -euo pipefail

BRANCH="${1:-$(git branch --show-current)}"

if [[ -z "$BRANCH" ]]; then
  echo "Not on a branch."
  exit 1
fi

echo "Pushing $BRANCH → origin (Vercel primary)..."
git push origin "$BRANCH"

echo "Pushing $BRANCH → lovable (Lovable sync)..."
git push lovable "$BRANCH"

echo "Done. Both remotes updated for $BRANCH."
