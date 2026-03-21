#!/bin/bash

echo "🚀 Starting Micro-Learn..."
echo ""

# Start backend
echo "Starting backend on port 8000..."
cd "$(dirname "$0")"

# Use venv if available, otherwise system uvicorn
if [ -f ".venv/bin/uvicorn" ]; then
  .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
else
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
fi
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend..."
sleep 3

# Start frontend
echo "Starting frontend on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Micro-Learn is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

# Trap Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Stopped.'; exit 0" SIGINT

# Wait
wait
