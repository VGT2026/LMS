# ---------- Build Stage ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies (with cache optimization)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build app (skip if not needed)
RUN npm run build || echo "No build step"

# ---------- Production Stage ----------
FROM node:18-alpine

WORKDIR /app

# Copy only necessary files
COPY package*.json ./
RUN npm install --production

# Copy built app (or fallback to source)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app . .

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Railway uses dynamic port
EXPOSE 3000

# Migrations align Railway/schema drift (e.g. approval_status, support_tickets), then serve
CMD ["npm", "start"]