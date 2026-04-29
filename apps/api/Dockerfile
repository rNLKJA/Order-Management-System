# syntax=docker/dockerfile:1.7
#
# meal-api 容器构建。
#
# 约定：
#  - Build context = monorepo 根目录（Zeabur service 设置里 Build Context 填 `.`）
#  - Dockerfile 路径 = apps/api/Dockerfile
#  - 最终产物只含生产依赖 + dist/，由 node:20-slim 启动
#
# 本地验证：
#   docker build -t meal-api:local -f apps/api/Dockerfile .
#   docker run --rm -p 3000:3000 --env-file apps/api/.env.docker meal-api:local
#   curl http://localhost:3000/api/health
#
# 多实例 + 负载均衡见 infra/docker/docker-compose.lb.yml

# ---------- Stage 1: builder ----------
FROM node:20-slim AS builder

# pnpm 10 由 corepack 驱动
RUN corepack enable
WORKDIR /repo

# 先拷 lockfile + 各 workspace 的 package.json（改动少 → 命中 layer cache）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# 只装 api 链路相关的 workspace 依赖（含 shared）
RUN pnpm install --frozen-lockfile --filter @meal/api... --filter @meal/shared

# 复制真正的源码
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# 先 build shared（产生 packages/shared/dist），再 build api（产生 apps/api/dist）
RUN pnpm --filter @meal/shared build \
 && pnpm --filter @meal/api exec tsc -p tsconfig.json

# 生成最小 prod node_modules（把 workspace 依赖物化为普通文件夹）
RUN pnpm --filter @meal/api --prod --legacy deploy /out

# ---------- Stage 2: runtime ----------
FROM node:20-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# 非 root 跑，用内建的 node 用户
USER node

# 拷贝 prod node_modules + package.json + 编译产物
COPY --from=builder --chown=node:node /out/node_modules ./node_modules
COPY --from=builder --chown=node:node /out/package.json ./package.json
COPY --from=builder --chown=node:node /repo/apps/api/dist ./dist

EXPOSE 3000

# Compose / 编排：配合 nginx upstream 做就绪探测与摘除异常实例
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
