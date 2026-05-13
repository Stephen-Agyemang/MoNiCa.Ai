# Stage 1: Build the React Application
FROM node:20-alpine as build
WORKDIR /app

# Accept build arguments (like the Clerk Publishable Key)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve the optimized static files using Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Replace the default Nginx config with our SPA-aware config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
