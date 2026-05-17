$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
$venvDir = Join-Path $scriptDir ".venv\Scripts"

# Crear .venv si no existe
if (-not (Test-Path $venvPython)) {
    Write-Host "[0/4] Creando entorno virtual..."
    python -m venv .venv
    if (-not (Test-Path $venvPython)) {
        Write-Host "ERROR: No se pudo crear el entorno virtual."
        Write-Host "Asegurate de tener Python instalado y marcado 'Add Python to PATH'"
        Read-Host "Presiona Enter para salir"
        exit 1
    }
}

# 1. Instalar dependencias
Write-Host "[1/4] Instalando dependencias Python..."
& $venvPython -m pip install -r requirements.txt --quiet 2>&1 | Out-Null

# 2. Iniciar servicios en background (misma ventana)
Write-Host "[2/4] Iniciando servicios..."

$apiJob = Start-Job -Name "API" -ScriptBlock {
    param($d, $v)
    $env:Path = "$v;$env:Path"
    Set-Location $d
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
} -ArgumentList $scriptDir, $venvDir

Start-Sleep -Seconds 2

$frontendJob = Start-Job -Name "Frontend" -ScriptBlock {
    $fDir = Join-Path $args[0] "frontend"
    Set-Location $fDir
    npm run dev
} -ArgumentList $scriptDir

# 3. Esperar y mostrar logs
Write-Host "[3/4] Listo!" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================="
Write-Host "  Frontend:  http://localhost:3000"
Write-Host "  API:       http://localhost:8000"
Write-Host "  Docs:      http://localhost:8000/docs"
Write-Host "=========================================="
Write-Host ""
Write-Host "LOGS EN VIVO (Ctrl+C para detener todo):"
Write-Host ""

try {
    while ($apiJob.State -eq 'Running' -or $frontendJob.State -eq 'Running') {
        $apiOut = Receive-Job -Job $apiJob -ErrorAction SilentlyContinue
        $frontendOut = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
        
        if ($apiOut) { Write-Host "[API] $apiOut" }
        if ($frontendOut -and $frontendOut.Trim()) { Write-Host "[Frontend] $frontendOut" }
        
        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host "`n=========================================="
    Write-Host "  DETENIENDO SERVICIOS..."
    Write-Host "=========================================="
    
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    
    Remove-Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    
    Write-Host "Todo detenido."
    Read-Host "Presiona Enter para cerrar"
}
