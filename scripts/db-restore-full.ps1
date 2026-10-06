# Restaura scripts/escolar-full-dump.sql en PostgreSQL (Docker).
param([switch]$RecreateDb)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$DumpFile = Join-Path $PSScriptRoot 'escolar-full-dump.sql'
if (-not (Test-Path $DumpFile)) {
  Write-Host "No existe $DumpFile" -ForegroundColor Red
  Write-Host 'Genérelo con: npm run db:dump (después de npm run db:migrate:full)' -ForegroundColor Yellow
  exit 1
}

Write-Host '==> Levantando PostgreSQL…' -ForegroundColor Cyan
docker compose up -d postgres
node scripts/wait-for-postgres.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($RecreateDb) {
  Write-Host '==> Recreando base de datos escolar…' -ForegroundColor Yellow
  docker exec escolar-postgres psql -U postgres -c "DROP DATABASE IF EXISTS escolar;"
  docker exec escolar-postgres psql -U postgres -c "CREATE DATABASE escolar;"
}

Write-Host '==> Restaurando dump SQL…' -ForegroundColor Cyan
Get-Content $DumpFile -Raw | docker exec -i escolar-postgres psql -U postgres -d escolar -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Restauración completada.' -ForegroundColor Green
