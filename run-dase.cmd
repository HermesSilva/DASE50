@echo off
setlocal

rem Compila e abre o VS Code ja rodando a extensao DASE (Extension Development Host),
rem sem precisar apertar F5 dentro do editor.

set "ROOT=%~dp0"
set "DASE_DIR=%ROOT%DASE"

where code >nul 2>nul
if errorlevel 1 (
    echo [ERRO] O comando "code" nao foi encontrado no PATH.
    echo Abra o VS Code, rode "Shell Command: Install 'code' command in PATH" e tente de novo.
    exit /b 1
)

echo Compilando a extensao DASE...
pushd "%DASE_DIR%"
call npm run compile
if errorlevel 1 (
    echo [ERRO] Falha ao compilar o DASE.
    popd
    exit /b 1
)
popd

echo Abrindo o VS Code com o DASE em execucao...
code --extensionDevelopmentPath="%DASE_DIR%" "%ROOT%"

endlocal
