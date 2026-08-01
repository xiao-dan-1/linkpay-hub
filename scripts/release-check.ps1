param(
  [string]$EnvFile = ".env.production",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Invoke-Step([string]$Name, [scriptblock]$Command) {
  Write-Host "`n==> $Name" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Environment file not found: $EnvFile"
}

$releaseEnvironment = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
  if ($line -match '^\s*([^#][^=]*)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim()
    $releaseEnvironment[$name] = $value
    Set-Item -Path "Env:$name" -Value $value
  }
}
if (-not $releaseEnvironment.TEST_DATABASE_URL) {
  throw "TEST_DATABASE_URL is required in $EnvFile and must point to a disposable test database"
}
$env:NODE_ENV = "test"
$env:DATABASE_URL = $releaseEnvironment.TEST_DATABASE_URL
$env:APP_ORIGIN = if ($releaseEnvironment.TEST_APP_ORIGIN) { $releaseEnvironment.TEST_APP_ORIGIN } else { "http://127.0.0.1:5173" }

if (-not $SkipInstall) {
  Invoke-Step "Install locked dependencies" { npm ci }
}
Invoke-Step "Generate Prisma client" { npm run db:generate }
Invoke-Step "Apply migrations to the disposable test database" { npx prisma migrate deploy }
Invoke-Step "Type check workspaces" { npm run typecheck }
Invoke-Step "Run all tests" { npm run test:run }
Invoke-Step "Build all workspaces" { npm run build }

foreach ($entry in $releaseEnvironment.GetEnumerator()) {
  Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value
}
Invoke-Step "Validate Compose" { docker compose --env-file $EnvFile config --quiet }
Invoke-Step "Build containers" { docker compose --env-file $EnvFile build }
Invoke-Step "Start production stack" { docker compose --env-file $EnvFile up -d }
Invoke-Step "Wait for container health" {
  $deadline = (Get-Date).AddMinutes(3)
  do {
    # Compose v5 `ps --format json` truncates the Command display with a Unicode ellipsis that
    # breaks ConvertFrom-Json under some console codepages, so parse the plain-text status instead.
    $records = @(docker compose --env-file $EnvFile ps --format "{{.Service}}|{{.Status}}" |
      ForEach-Object {
        $parts = $_ -split '\|', 2
        if ($parts.Count -eq 2) { [pscustomobject]@{ Service = $parts[0].Trim(); Status = $parts[1].Trim() } }
      })
    $unhealthy = @($records | Where-Object {
      $_.Service -ne "migrate" -and
      $_.Status -match '\((healthy|unhealthy)\)' -and
      $_.Status -notmatch '\(healthy\)'
    })
    if ($unhealthy.Count -eq 0 -and @($records | Where-Object { $_.Service -eq "nginx" -and $_.Status -match '\(healthy\)' }).Count -eq 1) { break }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  if ((Get-Date) -ge $deadline) { throw "Containers did not become healthy" }
}

$httpPort = (Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^HTTP_PORT=' } | Select-Object -Last 1) -replace '^HTTP_PORT=', ''
if (-not $httpPort) { $httpPort = "8080" }
$healthUrl = "http://127.0.0.1:$httpPort/health/ready"
Invoke-Step "Check HTTP readiness" {
  $response = Invoke-WebRequest $healthUrl -UseBasicParsing
  if ($response.StatusCode -ne 200) { throw "Readiness returned $($response.StatusCode)" }
}

Invoke-Step "Verify backup restoration" {
  docker compose --env-file $EnvFile exec -T postgres sh -c "pg_dump -U `$POSTGRES_USER -d `$POSTGRES_DB -Fc -f /tmp/release-check.dump"
  docker compose --env-file $EnvFile exec -T postgres sh -c "dropdb -U `$POSTGRES_USER --if-exists studio_tasks_verify && createdb -U `$POSTGRES_USER studio_tasks_verify"
  docker compose --env-file $EnvFile exec -T postgres sh -c "pg_restore -U `$POSTGRES_USER -d studio_tasks_verify /tmp/release-check.dump"
  $migrationCount = docker compose --env-file $EnvFile exec -T postgres sh -c "psql -U `$POSTGRES_USER -d studio_tasks_verify -tAc 'select count(*) from _prisma_migrations'"
  if ([int]$migrationCount -lt 1) { throw "Restored database has no Prisma migration records" }
  docker compose --env-file $EnvFile exec -T postgres sh -c "dropdb -U `$POSTGRES_USER studio_tasks_verify && rm -f /tmp/release-check.dump"
}

Invoke-Step "Check prototype and secret leakage" {
  $matches = rg -n "Demo123|Admin123|resetDemoState|PrototypeRepository|localStorage" . --glob "!docs/**" --glob "!scripts/release-check.*" --glob "!node_modules/**" --glob "!packages/contracts/dist/**" --glob "!apps/**/dist/**"
  $rgExitCode = $LASTEXITCODE
  if ($rgExitCode -eq 0) { $matches; throw "Prototype or demo credentials remain" }
  if ($rgExitCode -gt 1) { throw "rg failed with exit code $rgExitCode" }
  $global:LASTEXITCODE = 0
}

Write-Host "`nRelease checks passed: $healthUrl" -ForegroundColor Green
