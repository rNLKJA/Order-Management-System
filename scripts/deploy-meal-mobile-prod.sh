#!/usr/bin/env bash
# 从「仓库根」部署 meal-mobile 生产构建，避免 Vercel 项目 Root Directory=apps/mobile
# 时再在 apps/mobile 下执行 CLI 导致路径叠成 apps/mobile/apps/mobile。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_gf6clNcEO0X7LzRZpzwXOMfu}"
export VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_Q3ZTLhFJrvCo8XbwpfIrh9gnZsEk}"
exec npx vercel deploy . --prod --yes "$@"
