# Activates playedmade.com custom domain once Cloudflare DNS A/CNAME records resolve to GitHub Pages
param([string]$Domain = "playedmade.com")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Checking DNS resolution for $Domain..."
$ips = @(Resolve-DnsName $Domain -Type A -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress)
if (-not $ips.Count) {
  throw "DNS A records for $Domain are not resolving yet. Add the 4 GitHub Pages A records in Cloudflare DNS first, then re-run this script."
}
Write-Host "Resolved $Domain -> $($ips -join ', ')"

# 1. Update $SiteUrl in tools\build.ps1 and preserve dist\CNAME on every build
$bPath = Join-Path $root "tools\build.ps1"
$bTxt = [IO.File]::ReadAllText($bPath, [Text.Encoding]::UTF8)
$bTxt = $bTxt.Replace('$SiteUrl = "https://johanheurlin.github.io/inspired-by/"', '$SiteUrl = "https://' + $Domain + '/"')
if (-not $bTxt.Contains("dist\CNAME")) {
  $bTxt = $bTxt + "`n[IO.File]::WriteAllText((Join-Path `$root 'dist\CNAME'), '$Domain', (New-Object System.Text.UTF8Encoding(`$false)))`n"
}
[IO.File]::WriteAllText($bPath, $bTxt, (New-Object System.Text.UTF8Encoding($false)))

# 2. Update fallback shareBase in src\app.html
$aPath = Join-Path $root "src\app.html"
$aTxt = [IO.File]::ReadAllText($aPath, [Text.Encoding]::UTF8)
$aTxt = $aTxt.Replace('"https://johanheurlin.github.io/inspired-by/"', '"https://' + $Domain + '/"')
[IO.File]::WriteAllText($aPath, $aTxt, (New-Object System.Text.UTF8Encoding($false)))

# 3. Rebuild bundle (writes dist\CNAME, canonical URLs, sitemap.xml, robots.txt, llms.txt)
powershell -ExecutionPolicy Bypass -File (Join-Path $root "tools\build.ps1")

Write-Host "Ready! Commit & push dist\CNAME, then gh api -X PUT repos/JohanHeurlin/inspired-by/pages -f cname=$Domain -F https_enforced=true"
