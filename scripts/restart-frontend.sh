#!/bin/bash

# 快速重启前端服务脚本
# 杀死端口 3000 上的进程并重新启动前端服务

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/web"

echo "🔄 正在重启前端服务..."
echo "📍 项目根目录: $PROJECT_ROOT"

# 杀死端口 3000 上的进程
echo "🛑 正在停止端口 3000 上的进程..."
if lsof -ti:3000 > /dev/null 2>&1; then
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  echo "✅ 进程已停止"
  sleep 1
else
  echo "ℹ️  端口 3000 上没有运行的进程"
fi

# 启动前端服务
echo "🚀 正在启动前端服务 (端口 3000)..."
cd "$WEB_DIR"
npm run dev &
FRONTEND_PID=$!

echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"
echo "📝 日志输出:"
wait $FRONTEND_PID
