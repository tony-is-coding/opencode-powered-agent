#!/bin/bash

# 快速重启全栈服务脚本
# 同时重启后端和前端服务

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
WEB_DIR="$PROJECT_ROOT/web"

echo "🔄 正在重启全栈服务..."
echo "📍 项目根目录: $PROJECT_ROOT"

# 杀死两个端口上的进程
echo "🛑 正在停止现有进程..."

if lsof -ti:4096 > /dev/null 2>&1; then
  echo "  • 停止端口 4096 (后端)..."
  lsof -ti:4096 | xargs kill -9 2>/dev/null || true
fi

if lsof -ti:3000 > /dev/null 2>&1; then
  echo "  • 停止端口 3000 (前端)..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

sleep 1
echo "✅ 现有进程已停止"

# 启动后端服务
echo ""
echo "🚀 正在启动后端服务 (端口 4096)..."
cd "$BACKEND_DIR"
bun run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"

# 等待后端启动
sleep 3

# 启动前端服务
echo ""
echo "🚀 正在启动前端服务 (端口 3000)..."
cd "$WEB_DIR"
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 服务状态:"
echo "  • 后端: http://localhost:4096 (PID: $BACKEND_PID)"
echo "  • 前端: http://localhost:3000 (PID: $FRONTEND_PID)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 查看日志:"
echo "  • 后端日志: tail -f /tmp/backend.log"
echo "  • 前端日志: tail -f /tmp/frontend.log"
echo ""
echo "🛑 停止服务: kill $BACKEND_PID $FRONTEND_PID"
echo ""

# 保持脚本运行，显示日志
wait
