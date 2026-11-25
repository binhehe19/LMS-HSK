@echo off
setlocal EnableExtensions

rem Starts the shared LMS backend and the separate HSK frontend.
set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend\repo-lms"
set "FRONTEND_DIR=%ROOT_DIR%hsk_frontend"

if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8090"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=3000"

rem Defaults for local development. Existing environment variables take precedence.
if "%NEXT_PUBLIC_AUTH_FRONTEND_URL%"=="" set "NEXT_PUBLIC_AUTH_FRONTEND_URL=https://dev-accounts.thespace.edu.vn"
if "%NEXT_PUBLIC_AUTH_API_BASE_URL%"=="" set "NEXT_PUBLIC_AUTH_API_BASE_URL=https://dev-accounts.thespace.edu.vn/api/auth"
if "%NEXT_PUBLIC_LMS_API_BASE_PATH%"=="" set "NEXT_PUBLIC_LMS_API_BASE_PATH=/api/lms"
if "%LMS_API_PROXY_TARGET%"=="" set "LMS_API_PROXY_TARGET=http://localhost:%BACKEND_PORT%"

if not exist "%BACKEND_DIR%\pom.xml" (
    echo [ERROR] Backend project was not found: "%BACKEND_DIR%"
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] HSK frontend project was not found: "%FRONTEND_DIR%"
    pause
    exit /b 1
)

where mvn >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Maven was not found. Install Maven and reopen the terminal.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js/npm was not found. Install Node.js LTS and reopen the terminal.
    pause
    exit /b 1
)

echo Building shared backend dependencies...
call mvn -f "%ROOT_DIR%backend\repo-common-parent\pom.xml" -DskipTests install
if errorlevel 1 exit /b 1
call mvn -f "%ROOT_DIR%backend\repo-common-framework\pom.xml" -DskipTests install
if errorlevel 1 exit /b 1

echo Starting backend at http://localhost:%BACKEND_PORT%
start "LMS Backend" /D "%BACKEND_DIR%" cmd /k mvn spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.arguments=--server.port=%BACKEND_PORT%

if exist "%FRONTEND_DIR%\node_modules" (
    echo Starting HSK frontend at http://localhost:%FRONTEND_PORT%/admin/class-management
    start "HSK Frontend" /D "%FRONTEND_DIR%" cmd /k npm run dev -- --port %FRONTEND_PORT%
) else (
    echo Installing HSK dependencies, then starting at http://localhost:%FRONTEND_PORT%/admin/class-management
    start "HSK Frontend" /D "%FRONTEND_DIR%" cmd /k "npm ci && npm run dev -- --port %FRONTEND_PORT%"
)

echo.
echo HSK frontend and LMS backend are starting in separate windows.
echo Close each window or press Ctrl+C there to stop it before running this file again.
endlocal
