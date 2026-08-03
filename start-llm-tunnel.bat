@echo off
title TechFlow - Ollama LLM Tunnel
color 0A

echo ==========================================================
echo   TechFlow - Local LLM via Cloudflare Tunnel
echo ==========================================================
echo.

:: Check Ollama
echo [1/3] Checking Ollama...
where ollama >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Ollama not found. Install from https://ollama.com
    pause
    exit /b 1
)

curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [INFO] Starting Ollama service...
    start "Ollama" /min cmd /c "ollama serve"
    timeout /t 3 /nobreak >nul
) else (
    echo [OK] Ollama already running.
)

:: Check model
echo.
echo [2/3] Checking model deepseek-coder:6.7b...
ollama list 2>nul | findstr "deepseek-coder" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Pulling model (approx 4 GB, please wait)...
    ollama pull deepseek-coder:6.7b
) else (
    echo [OK] Model ready.
)

:: Check cloudflared
echo.
echo [3/3] Starting Cloudflare Tunnel...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [ERROR] cloudflared not found.
    echo         Install: winget install --id Cloudflare.cloudflared
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo   Tunnel active. Copy the URL shown below.
echo   Set it as OLLAMA_URL in Render environment variables.
echo ==========================================================
echo.

REM --- Named tunnel (edit tunnel name below if configured): ---
REM cloudflared tunnel run ollama-local

REM --- Quick Tunnel (URL changes on restart, update Render env): ---
cloudflared tunnel --url http://localhost:11434

echo.
pause
