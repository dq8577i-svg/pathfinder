$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot "logs"
$stdoutLog = Join-Path $logDirectory "server-out.log"
$stderrLog = Join-Path $logDirectory "server-error.log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$env:NEXT_PUBLIC_DATA_SOURCE = "api"
$env:AUTH_GATE = "true"

$process = Start-Process `
  -FilePath "C:\Program Files\nodejs\npm.cmd" `
  -ArgumentList @("run", "start") `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -PassThru

Write-Output "STARTED_PROCESS_ID=$($process.Id)"

$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/v1/health/live" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    # Continue polling until Next.js is listening.
  }
}

if (-not $ready) {
  Write-Output "SERVER_NOT_READY"
  if (Test-Path -LiteralPath $stdoutLog) { Get-Content -LiteralPath $stdoutLog -Tail 40 }
  if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog -Tail 40 }
  exit 1
}

Write-Output "SERVER_READY"
Write-Output $response.Content
