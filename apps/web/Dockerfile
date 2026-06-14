FROM node:22-alpine AS base

WORKDIR /workspace

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --legacy-peer-deps

FROM deps AS dev
COPY . /workspace
CMD ["npm", "--workspace", "apps/web", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM deps AS builder
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY . /workspace
RUN npm --workspace apps/web run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=builder /workspace /workspace
CMD ["npm", "--workspace", "apps/web", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
