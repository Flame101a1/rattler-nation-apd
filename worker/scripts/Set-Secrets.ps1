# Run locally after signing into the official Cloudflare CLI. Never paste credentials into chat.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
function Write-WorkerSecret([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { throw "Missing value for $Name" }
    $Value | & npx.cmd wrangler secret put $Name
    if ($LASTEXITCODE -ne 0) { throw "Secret upload failed for $Name" }
}
function Read-HiddenSecret([string]$Name) {
    $secure = Read-Host "$Name (hidden)" -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { Write-WorkerSecret $Name ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}
Write-Host 'Confirm the Worker account is on Free before continuing. This uploads secrets; it does not enable billing.'
& npx.cmd wrangler whoami
if ($LASTEXITCODE -ne 0) { throw 'Sign into Cloudflare first.' }
Read-HiddenSecret 'DISCORD_BOT_TOKEN'
foreach ($name in @('DISCORD_PUBLIC_KEY','DISCORD_APPLICATION_ID','DISCORD_GUILD_ID','FIREBASE_WEB_API_KEY')) {
    Write-WorkerSecret $name (Read-Host $name)
}
$keyPath = Read-Host 'Absolute path to the dedicated Firebase service-account JSON outside this repository'
$resolved = (Resolve-Path -LiteralPath $keyPath).Path
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')) + [IO.Path]::DirectorySeparatorChar
if ($resolved.StartsWith($repository,[StringComparison]::OrdinalIgnoreCase)) { throw 'Move the private key outside the repository before uploading.' }
$credential = Get-Content -Raw -LiteralPath $resolved | ConvertFrom-Json
if ($credential.project_id -ne 'rattler-nation-apd' -or $credential.type -ne 'service_account') { throw 'Wrong Firebase project or credential type.' }
Write-WorkerSecret 'FIREBASE_CLIENT_EMAIL' $credential.client_email
Write-WorkerSecret 'FIREBASE_PRIVATE_KEY' $credential.private_key
$credential = $null
Write-Host 'Secrets uploaded. Keep the local credential protected and do not commit it.'
