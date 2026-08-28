$root = $PSScriptRoot
$port = 4173
$node = Get-Command node -ErrorAction SilentlyContinue
$serverFile = Join-Path $root "local-static-server.js"

if (-not $node) {
  Write-Error "Node.js was not found on PATH. Install Node.js first, then rerun serve-local.ps1."
  exit 1
}

if (-not (Test-Path -LiteralPath $serverFile)) {
  Write-Error "Missing local-static-server.js. Restore it, then rerun serve-local.ps1."
  exit 1
}

Write-Host "Starting local server at http://127.0.0.1:$port/"
Write-Host "Press Ctrl+C to stop the server."

Push-Location $root
try {
  & $node.Source $serverFile
}
finally {
  Pop-Location
}
