#!/usr/bin/env bash
echo "========================================================"
echo "  RaidProof AI - Wildlife Crop Damage Evidence Assistant"
echo "========================================================"
echo ""

# 1. Start Backend FastAPI Server
echo "[1/2] Starting FastAPI Backend on http://localhost:8000 ..."
(cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

sleep 2

# 2. Start Frontend Vite Dev Server
echo "[2/2] Starting React Vite Frontend on http://localhost:5173 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "========================================================"
echo "  RaidProof AI is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend API Docs: http://localhost:8000/docs"
echo "========================================================"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait

