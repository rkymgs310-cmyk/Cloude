param(
    [switch]$Agents,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$DevinArgs
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$branch = (git branch --show-current).Trim()
if (-not $branch.StartsWith('windsurf/')) {
    throw "Refusing to start Devin Desktop on branch '$branch'. Switch/create a windsurf/* branch first."
}

$devin = Get-Command devin-desktop -ErrorAction SilentlyContinue
if (-not $devin) {
    $fallback = Join-Path $env:LOCALAPPDATA 'Programs\Devin\bin\devin-desktop.cmd'
    if (-not (Test-Path $fallback)) {
        throw 'devin-desktop is not installed or available on PATH.'
    }
    $devinPath = $fallback
} else {
    $devinPath = $devin.Source
}

Write-Host "Devin Desktop branch: $branch"
Write-Host 'Shared context: AGENTS.md, README.md, docs/AI_CONTEXT.md'
if ($Agents) { & $devinPath --agents $repoRoot @DevinArgs }
else { & $devinPath --new-window $repoRoot @DevinArgs }
exit $LASTEXITCODE