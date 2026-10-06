# Migración completa: Docker + esquema + seed + todos los datos demo.
#
# Uso:
#   npm run db:migrate:full              # conserva datos existentes (idempotente donde aplique)
#   npm run db:migrate:full:reset        # borra volumen PostgreSQL y recarga todo desde cero
#   npm run db:migrate:full -- -SkipDocker   # solo migración (BD ya levantada)
#
param(
  [switch]$Reset,
  [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $SkipDocker) {
  Write-Host ''
  Write-Host '==> Infraestructura Docker' -ForegroundColor Cyan
  if ($Reset) {
    Write-Host '    Modo RESET: se eliminará el volumen de PostgreSQL.' -ForegroundColor Yellow
    & npm run db:reset
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host '    Levantando MinIO…' -ForegroundColor Cyan
    docker compose up -d minio
  } else {
    & npm run db:up
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host '==> SkipDocker: omitiendo docker compose' -ForegroundColor DarkGray
  & node scripts/wait-for-postgres.js
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ''
Write-Host '==> Ejecutando migración y carga de datos…' -ForegroundColor Cyan
npx ts-node scripts/db-migrate-full.ts
exit $LASTEXITCODE
