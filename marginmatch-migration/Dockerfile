FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_ENABLE_LEGACY_PORTFOLIO=false
ENV VITE_ENABLE_LEGACY_PORTFOLIO=${VITE_ENABLE_LEGACY_PORTFOLIO}
RUN npm run typecheck && npm run build && npm test

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm","run","start"]
