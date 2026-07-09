$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pnpm = 'C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd'
$nodePath = 'C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\kkolk\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;'

$env:PATH = $nodePath + $env:PATH

Start-Process -FilePath $pnpm -ArgumentList '--dir', 'apps/consumer', 'dev' -WorkingDirectory $root -WindowStyle Hidden
Start-Process -FilePath $pnpm -ArgumentList '--dir', 'apps/admin', 'dev' -WorkingDirectory $root -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host 'Customer: http://127.0.0.1:5174/'
Write-Host 'Admin:    http://127.0.0.1:5173/admin'
