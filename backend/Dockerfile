FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY tsconfig.json ./
RUN mkdir -p uploads
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$SEED_ON_START\" = \"true\" ]; then npx tsx prisma/seed.ts; fi && node dist/index.js"]
