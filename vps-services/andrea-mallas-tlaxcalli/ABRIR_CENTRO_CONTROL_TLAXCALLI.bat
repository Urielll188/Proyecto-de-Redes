@echo off
title Plataforma Publica Blindada - Mallas Tlaxcalli (Cloudflare Tunnel + IA Pool)
echo ============================================================================
echo   INICIANDO SERVIDOR Y TUNEL PUBLICO HTTPS (MALLAS TLAXCALLI)
echo   Tus API Keys estan 100%% ocultas en .env y nunca se exponen en la web.
echo ============================================================================
start /B python "%~dp0scripts\servidor_interactivo_tlaxcalli.py"
timeout /t 2 >nul
echo Generando tu URL publica segura (https://...trycloudflare.com)...
"C:\Users\Hugo\Desktop\Respaldo_VPS\Desktop\Trading\cloudflared.exe" tunnel --url http://127.0.0.1:8090
pause
