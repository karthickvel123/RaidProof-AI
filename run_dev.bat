@echo off
echo ========================================================
echo   RaidProof AI - Wildlife Crop Damage Evidence Assistant
echo ========================================================
echo.

:: 1. Start Backend FastAPI Server
echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "RaidProof Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: 2. Wait 2 seconds for backend to initialize
timeout /t 2 /nobreak >nul

:: 3. Start Frontend Vite Dev Server
echo [2/2] Starting React Vite Frontend on http://localhost:5173 ...
start "RaidProof Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo   RaidProof AI is running!
echo   Frontend: http://localhost:5173
echo   Backend API Docs: http://localhost:8000/docs
echo ========================================================
echo.
timeout /t 2 /nobreak >nul
start http://localhost:5173

