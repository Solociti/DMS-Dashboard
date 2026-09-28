FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client ./client
COPY common ./common
COPY dms ./dms
COPY public ./public
COPY scripts ./scripts
COPY server ./server
COPY tsconfig.json ./tsconfig.json

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/build/server ./server
COPY --from=build /app/public ./public
COPY --from=build /app/dms ./dms

VOLUME ["/data", "/dms"]
EXPOSE 3000
CMD ["node", "/app/server/index.js"]
