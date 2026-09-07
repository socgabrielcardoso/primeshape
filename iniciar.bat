@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3.12 -c "import sys" >nul 2>&1
if not errorlevel 1 (
  py -3.12 scripts\bootstrap.py
  goto fim
)
py -3.11 -c "import sys" >nul 2>&1
if not errorlevel 1 (
  py -3.11 scripts\bootstrap.py
  goto fim
)
python scripts\bootstrap.py
:fim
if errorlevel 1 pause
