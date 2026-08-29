# --- builder: full devDependencies, compiles TypeScript ---
FROM node:24-alpine AS builder
WORKDIR /app

# Copied separately from the rest of the source so Docker can cache this
# layer — npm ci only reruns when package.json/package-lock.json change,
# not on every source edit.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime: only production dependencies + the compiled output ---
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
