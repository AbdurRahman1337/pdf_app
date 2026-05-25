# Multi-stage Dockerfile for React Native (Expo Web)
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
# For production, we would run 'expo build:web', but since we are running in dev mode for this demo:
# CMD ["npx", "expo", "start", "--web"]

# Let's create a production-like build stage for correctness
RUN npx expo export --platform web

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
