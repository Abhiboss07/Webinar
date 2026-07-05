# Youngness CMS — admin panel (build → static nginx)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Baked at build time — point at the deployed API.
ARG VITE_API_BASE
ARG VITE_PUBLIC_SITE_URL
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_PUBLIC_SITE_URL=$VITE_PUBLIC_SITE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
