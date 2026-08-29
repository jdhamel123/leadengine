FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_ENABLE_LEGACY_PORTFOLIO=false
ARG RELEASE_VERSION=dev
ARG GIT_COMMIT=unknown
ENV VITE_ENABLE_LEGACY_PORTFOLIO=${VITE_ENABLE_LEGACY_PORTFOLIO}
ENV RELEASE_VERSION=${RELEASE_VERSION}
ENV GIT_COMMIT=${GIT_COMMIT}
RUN npm run typecheck && npm run build && RELEASE_VERSION=${RELEASE_VERSION} GIT_COMMIT=${GIT_COMMIT} npm run release:metadata && npm test

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm","run","start"]
