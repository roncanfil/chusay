# One container: the Next.js app, with the SQLite file on a mounted volume at /data.
# The app is built once on the build machine's own platform; only the small runtime stage is per platform.
# That works because the output is plain JavaScript and better-sqlite3 ships prebuilt binaries for every platform.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS deps
# node-gyp reads better-sqlite3's binding.gyp at install time (it finds the prebuilt binary and skips compiling)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/data/chusay.db
RUN mkdir -p /data /backups && chown node:node /data /backups
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# the SQLite driver loads a prebuilt native binary; copy the whole package so it's always there
COPY --from=build --chown=node:node /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# next/image isn't used, and sharp's binaries are for the build platform only
RUN rm -rf node_modules/sharp node_modules/@img
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/config').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
