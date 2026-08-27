# 看房助手 · 零依赖 Node.js 服务镜像（Sealos / 任意 Docker 平台通用）
# 数据存储于 /app/data，建议在部署平台挂载持久卷
FROM node:20-alpine
WORKDIR /app

# 复制项目（data/ 已在 .dockerignore 排除，运行时自动创建并建议挂载持久卷）
COPY . .

# 预创建数据目录（首次启动 server.js 会自动初始化 users.json 等）
RUN mkdir -p /app/data/db

EXPOSE 8080
CMD ["node", "server.js"]
