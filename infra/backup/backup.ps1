param(
  [string]$ComposeProject = "studio-task-platform",
  [string]$OutputDirectory = ".\backups"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$target = Join-Path $OutputDirectory "studio_tasks_$timestamp.dump"
docker compose -p $ComposeProject exec -T postgres sh -c "pg_dump -U studio -d studio_tasks -Fc -f /tmp/manual-backup.dump"
docker compose -p $ComposeProject cp postgres:/tmp/manual-backup.dump $target
docker compose -p $ComposeProject exec -T postgres rm -f /tmp/manual-backup.dump
Get-ChildItem -LiteralPath $OutputDirectory -Filter "*.dump" |
  Where-Object { $_.LastWriteTimeUtc -lt (Get-Date).ToUniversalTime().AddDays(-7) } |
  Remove-Item -Force
Write-Output "Backup created: $target"
