#!/bin/bash

# 快速重启后端服务脚本
# 杀死端口 4096 上的进程并重新启动后端服务

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "🔄 正在重启后端服务..."
echo "📍 项目根目录: $PROJECT_ROOT"

# 杀死端口 4096 上的进程
echo "🛑 正在停止端口 4096 上的进程..."
if lsof -ti:4096 > /dev/null 2>&1; then
  lsof -ti:4096 | xargs kill -9 2>/dev/null || true
  echo "✅ 进程已停止"
  sleep 1
else
  echo "ℹ️  端口 4096 上没有运行的进程"
fi

# 启动后端服务
echo "🚀 正在启动后端服务 (端口 4096)..."
cd "$BACKEND_DIR"
bun run dev &
BACKEND_PID=$!

echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
echo "📝 日志输出:"
wait $BACKEND_PID
