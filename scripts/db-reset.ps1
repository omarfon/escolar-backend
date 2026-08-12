# Reinicia PostgreSQL desde cero (elimina datos del volumen).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '==> Deteniendo contenedor y eliminando volumen...' -ForegroundColor Yellow
docker compose down -v
if ($LASTEXITCODE -ne 0) {
  Write-Host 'docker compose down fallo. Reinicie Docker Desktop manualmente.' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host '==> Creando PostgreSQL limpio...' -ForegroundColor Cyan
docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node scripts/wait-for-postgres.js
exit $LASTEXITCODE
