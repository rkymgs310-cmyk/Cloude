param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$AiderArgs
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Get-Command aider -ErrorAction SilentlyContinue)) {
    throw 'aider is not on PATH. Restart PowerShell or add $HOME\.local\bin to PATH.'
}

$branch = (git branch --show-current).Trim()
if (-not $branch.StartsWith('aider/')) {
    throw "Refusing to start Aider on branch '$branch'. Switch/create an aider/* branch first."
}

Write-Host "Aider branch: $branch"
Write-Host 'Shared context: AGENTS.md, README.md, docs/AI_CONTEXT.md'
Write-Host 'Repository config disables Aider auto-commits and runs test+build after edits.'
& aider @AiderArgs
exit $LASTEXITCODE
