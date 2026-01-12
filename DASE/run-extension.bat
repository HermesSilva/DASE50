@echo off
setlocal enabledelayedexpansion

echo ========================================
echo DASE Extension Development Launcher
echo ========================================
echo.

REM Navigate to script directory
cd /d "%~dp0"

echo Current directory: %CD%
echo.

echo [1/3] Compiling TypeScript...
call npm run compile

if errorlevel 1 (
    echo.
    echo [ERROR] Compilation failed!
    echo Please fix the errors and try again.
    pause
    exit /b 1
)

echo.
echo [2/3] Compilation successful!
echo.

echo [3/3] Launching VS Code Extension Development Host...
echo.

REM Use the samples folder as workspace for testing
set "EXT_PATH=%~dp0"
set "WORKSPACE_PATH=%~dp0samples"

echo Extension Path: %EXT_PATH%
echo Workspace Path: %WORKSPACE_PATH%
echo.

REM Remove trailing backslash if present
if "%EXT_PATH:~-1%"=="\" set "EXT_PATH=%EXT_PATH:~0,-1%"

echo Opening VS Code with extension development mode...
code --extensionDevelopmentPath="%EXT_PATH%" "%WORKSPACE_PATH%"

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to launch VS Code!
    echo Make sure VS Code is installed and 'code' command is in PATH.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Extension Development Host launched!
echo ========================================
echo.
echo The extension is now running in the new VS Code window.
echo.
echo You can:
echo   - Open sample.dsorm to test the ORM Designer
echo   - Use Ctrl+Shift+P and type "DASE" to access commands
echo   - Check the Debug Console (Ctrl+Shift+Y) for logs
echo.
echo Press any key to close this window...
pause > nul