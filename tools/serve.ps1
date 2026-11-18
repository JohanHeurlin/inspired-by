# Minimal static file server for previewing dist\ on http://localhost:8765 (localhost only, no admin rights needed).
param([int]$Port = 8765)
$root = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist'
$types = @{ '.html' = 'text/html; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.txt' = 'text/plain; charset=utf-8' }
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Output "Serving $root on http://localhost:$Port"
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream(); $stream.ReadTimeout = 5000
    $reader = New-Object System.IO.StreamReader($stream)
    $line = $reader.ReadLine()
    while ($true) { $h = $reader.ReadLine(); if ([string]::IsNullOrEmpty($h)) { break } }
    $path = '/'; if ($line -match '^[A-Z]+ ([^ ?#]+)') { $path = [Uri]::UnescapeDataString($Matches[1]) }
    if ($path -eq '/') { $path = '/index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root ($path.TrimStart('/'))))
    if ($file.StartsWith($root) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file); $ext = [IO.Path]::GetExtension($file).ToLower()
      $ct = $types[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $head = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    } else { $bytes = [Text.Encoding]::UTF8.GetBytes('Not found'); $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n" }
    $hb = [Text.Encoding]::ASCII.GetBytes($head); $stream.Write($hb, 0, $hb.Length); $stream.Write($bytes, 0, $bytes.Length); $stream.Flush()
  } catch { } finally { $client.Close() }
}
