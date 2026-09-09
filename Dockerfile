# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ .
RUN npm run build

# Stage 3: Production - serve frontend with nginx + run backend
FROM node:22-alpine AS production
RUN apk add --no-cache curl nginx

WORKDIR /app

# Copy backend
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=backend-builder /app/dist ./server/dist
COPY server/migrations ./server/migrations

# Copy frontend to nginx
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user and nginx dirs
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    addgroup -g 1001 -S hunter && \
    adduser -S hunter -u 1001 -G hunter && \
    chown -R hunter:hunter /app && \
    chown -R hunter:hunter /usr/share/nginx/html && \
    chown -R hunter:hunter /var/cache/nginx && \
    chown -R hunter:hunter /var/log/nginx && \
    chown -R hunter:hunter /var/run

USER hunter

EXPOSE 80 3000

# Start both nginx and backend
CMD sh -c 'nginx -g "daemon off;" & node server/dist/index.js'
