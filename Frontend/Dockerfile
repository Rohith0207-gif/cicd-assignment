# Stage 1: Build the Angular app
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./

# Install dependencies (skip peer dependency issues)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build Angular app for production
RUN npm run build --prod

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the Nginx config (with correct server block)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app to Nginx's public directory
COPY --from=build /app/dist/leave-management-frontend/browser /usr/share/nginx/html

# Expose the correct port (Cloud Run expects 8080)
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
