# Levanta PostgreSQL con Docker Compose y espera a que acepte conexiones.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '==> Verificando Docker...' -ForegroundColor Cyan
try {
  docker info *> $null
} catch {
  Write-Host 'Docker no responde. Abra Docker Desktop, espere a "Running" y reintente.' -ForegroundColor Red
  exit 1
}

Write-Host '==> Levantando PostgreSQL (5433) y MinIO (9000/9001)...' -ForegroundColor Cyan
docker compose up -d postgres minio
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Fallo docker compose up. Pruebe: npm run db:reset' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host '==> Esperando conexion a la BD...' -ForegroundColor Cyan
node scripts/wait-for-postgres.js
exit $LASTEXITCODE
