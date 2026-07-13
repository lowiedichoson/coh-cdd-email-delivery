<#
.SYNOPSIS
    Wrapper for coh-cdd-email-delivery.exe — to be called by Windows Task Scheduler.
.DESCRIPTION
    Runs the report engine, captures all console output to a timestamped log
    file, and propagates the exit code so the scheduler can track success/failure.
.NOTES
    Place this script, the .exe, and .env in the same directory.
    Task Scheduler action:
        Program:  powershell.exe
        Args:     -ExecutionPolicy Bypass -File "<path>\run-app.ps1"
#>

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$ExePath   = Join-Path $ScriptDir "coh-cdd-email-delivery.exe"
$EnvPath   = Join-Path $ScriptDir ".env"
$LogDir    = Join-Path $ScriptDir "logs"
$Now       = Get-Date
$LogName   = "run-{0:yyyy-MM-dd_HH-mm-ss}.log" -f $Now
$LogFile   = Join-Path $LogDir $LogName

function Write-Log {
    param([string]$Message)
    $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $Message
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

# ── Bootstrap ────────────────────────────────────────────────────────────────

Set-Location -LiteralPath $ScriptDir

if (-not (Test-Path -LiteralPath $LogDir -PathType Container)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

Write-Log "=== coh-cdd-email-delivery run-app.ps1 ==="
Write-Log "Script dir   : $ScriptDir"
Write-Log "Exe path     : $ExePath"
Write-Log "Env path     : $EnvPath"
Write-Log "Log file     : $LogFile"
Write-Log "CLI args     : $($args -join ' ')"

if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
    Write-Log "FATAL: .exe not found — $ExePath"
    exit 1
}

if (-not (Test-Path -LiteralPath $EnvPath -PathType Leaf)) {
    Write-Log "FATAL: .env not found — $EnvPath"
    exit 1
}

# ── Execute ──────────────────────────────────────────────────────────────────

try {
    Write-Log "Launching .exe ..."

    & $ExePath @args 2>&1 | Tee-Object -FilePath $LogFile -Append -Encoding UTF8
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Log "SUCCESS — .exe exited with code 0"
    }
    else {
        Write-Log "FAILURE — .exe exited with code $exitCode"
    }

    Write-Log "=== Finished ==="
    exit $exitCode
}
catch {
    Write-Log "FATAL — wrapper exception: $_"
    Write-Log "=== Finished (crashed) ==="
    exit 1
}
