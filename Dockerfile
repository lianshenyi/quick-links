FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 不用 npm run build：prebuild 里的 sync-cluster-links 需要集群访问，
# 由 CI 的 validate 阶段（在集群 Pod 内）先行完成；此处只合并与编译。
RUN npm run generate-config && npx tsc -b && npx vite build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
USER 101
