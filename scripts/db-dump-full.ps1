# Genera scripts/escolar-full-dump.sql (esquema + datos completos).
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '==> Verificando contenedor escolar-postgres…' -ForegroundColor Cyan
docker ps --filter name=escolar-postgres --format '{{.Names}}' | Select-String escolar-postgres | Out-Null
if ($LASTEXITCODE -ne 0 -or -not $?) {
  Write-Host 'Contenedor no encontrado. Ejecute: npm run db:up' -ForegroundColor Red
  exit 1
}

$OutFile = Join-Path $PSScriptRoot 'escolar-full-dump.sql'
Write-Host "==> Exportando a $OutFile …" -ForegroundColor Cyan

docker exec escolar-postgres pg_dump -U postgres -d escolar --no-owner --no-acl --clean --if-exists |
  Out-File -FilePath $OutFile -Encoding utf8

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$mb = [math]::Round((Get-Item $OutFile).Length / 1MB, 2)
Write-Host "Listo ($mb MB). Restaurar con: npm run db:restore" -ForegroundColor Green
