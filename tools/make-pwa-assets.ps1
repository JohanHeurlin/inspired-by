# Generates PWA launcher icons (icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png)
# and mobile Richer-Install preview screenshot (pwa-mobile.png) in dist\ using built-in .NET System.Drawing.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }
Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  if ($r -le 0) { $p.AddRectangle([System.Drawing.RectangleF]::new($x, $y, $w, $h)); return $p }
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Save-PwaIcon([string]$outPath, [int]$size, [bool]$fullBleed, [single]$markScale) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $bgPath = if ($fullBleed) {
    New-RoundedRectPath 0 0 $size $size 0
  } else {
    $pad = [Math]::Round($size * 0.03)
    $w = $size - ($pad * 2)
    New-RoundedRectPath $pad $pad $w $w ($w * 0.225)
  }

  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.PointF]::new($size, $size),
    [System.Drawing.Color]::FromArgb(255, 26, 99, 216),
    [System.Drawing.Color]::FromArgb(255, 13, 30, 68)
  )
  $g.FillPath($bgBrush, $bgPath)

  # Clip subtle notebook grid lines inside the icon silhouette
  $oldClip = $g.Clip
  $g.SetClip($bgPath)
  $step = [Math]::Max(12, [int]($size / 8))
  $gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(26, 255, 255, 255), [Math]::Max(1.0, $size / 256.0))
  for ($gx = $step; $gx -lt $size; $gx += $step) {
    $g.DrawLine($gridPen, $gx, 0, $gx, $size)
    $g.DrawLine($gridPen, 0, $gx, $size, $gx)
  }

  # Subtle radial top-left sheen
  $sheenBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(22, 160, 205, 255))
  $g.FillEllipse($sheenBrush, -[single]($size * 0.2), -[single]($size * 0.25), [single]($size * 0.9), [single]($size * 0.7))
  $g.Clip = $oldClip

  if (-not $fullBleed) {
    $rimPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(60, 255, 255, 255), [Math]::Max(1.5, $size / 160.0))
    $g.DrawPath($rimPen, $bgPath)
  }

  # Draw centered Played & Made emblem inside safe zone ($markScale ~ 0.60 for maskable, 0.68 for standard)
  $box = $size * $markScale
  $ox = ($size - $box) / 2.0
  $oy = ($size - $box) / 2.0

  # Coordinates inside [0..100] emblem space
  $S = { param([single]$v) return [single]($v * $box / 100.0) }
  $X = { param([single]$v) return [single]($ox + ($v * $box / 100.0)) }
  $Y = { param([single]$v) return [single]($oy + ($v * $box / 100.0)) }

  # Lineage curves from root pillar (left) to Played (top-right coral) and Made (bottom-right mint)
  $curveW = [Math]::Max(2.5, (& $S 7.2))
  $curvePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(235, 225, 238, 255), $curveW)
  $curvePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $curvePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $x1 = (& $X 29); $yMid = (& $Y 50)
  $x2 = (& $X 66); $yTop = (& $Y 26); $yBot = (& $Y 74)
  $dx = (& $S 19)
  $g.DrawBezier($curvePen, $x1, $yMid, ($x1 + $dx), $yMid, ($x2 - $dx), $yTop, $x2, $yTop)
  $g.DrawBezier($curvePen, $x1, $yMid, ($x1 + $dx), $yMid, ($x2 - $dx), $yBot, $x2, $yBot)

  # Left root pillar + bridge bar (echoing header logo mark)
  $stemPath = New-RoundedRectPath (& $X 10) (& $Y 14) (& $S 21) (& $S 72) (& $S 5.5)
  $g.FillPath([System.Drawing.Brushes]::White, $stemPath)

  $barPath = New-RoundedRectPath (& $X 24) (& $Y 41) (& $S 24) (& $S 18) (& $S 4.5)
  $g.FillPath([System.Drawing.Brushes]::White, $barPath)

  # Top-right node: Warm coral ("Played" / Favorites)
  $topOuter = New-RoundedRectPath (& $X 60) (& $Y 11) (& $S 30) (& $S 30) (& $S 7.5)
  $coralBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 110, 90))
  $g.FillPath($coralBrush, $topOuter)
  $nodeRim = [System.Drawing.Pen]::new([System.Drawing.Color]::White, [Math]::Max(1.5, (& $S 3.2)))
  $g.DrawPath($nodeRim, $topOuter)

  # Bottom-right node: Bright mint ("Made" / Craft)
  $botOuter = New-RoundedRectPath (& $X 60) (& $Y 59) (& $S 30) (& $S 30) (& $S 7.5)
  $mintBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 56, 201, 168))
  $g.FillPath($mintBrush, $botOuter)
  $g.DrawPath($nodeRim, $botOuter)

  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "Generated $outPath ($size x $size)"
}

function Save-MobilePreview([string]$outPath) {
  $W = 540; $H = 960
  $bmp = [System.Drawing.Bitmap]::new($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

  $bg = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($W, $H),
    [System.Drawing.Color]::FromArgb(255, 15, 20, 28),
    [System.Drawing.Color]::FromArgb(255, 24, 35, 58)
  )
  $g.FillRectangle($bg, 0, 0, $W, $H)

  $gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(18, 138, 180, 248), 1)
  for ($x = 0; $x -lt $W; $x += 28) { $g.DrawLine($gridPen, $x, 0, $x, $H) }
  for ($y = 0; $y -lt $H; $y += 28) { $g.DrawLine($gridPen, 0, $y, $W, $y) }

  $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 138, 180, 248))
  $sub    = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 198, 206, 222))
  $white  = [System.Drawing.Brushes]::White

  $logoBg = New-RoundedRectPath 40 52 38 38 9
  $g.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 26, 99, 216)), $logoBg)
  $g.FillRectangle($white, 49, 60, 6, 22)
  $g.FillRectangle($white, 55, 68, 14, 6)

  $fEye   = [System.Drawing.Font]::new("Consolas", 12, [System.Drawing.FontStyle]::Bold)
  $fTitle = [System.Drawing.Font]::new("Segoe UI", 30, [System.Drawing.FontStyle]::Bold)
  $fSub   = [System.Drawing.Font]::new("Segoe UI", 14.5, [System.Drawing.FontStyle]::Regular)
  $fYr    = [System.Drawing.Font]::new("Consolas", 9.8, [System.Drawing.FontStyle]::Bold)
  $fCard  = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

  $g.DrawString("PLAYED & MADE", $fEye, $accent, [single]90, [single]62)
  $g.DrawString("Your Life in Games`n& Who Built Them", $fTitle, $white, [System.Drawing.RectangleF]::new(38, 112, 464, 110))
  $g.DrawString("Tap childhood favorites across every console & home computer, trace 4,190+ games to their roots, and send thank-you postcards to the makers.", $fSub, $sub, [System.Drawing.RectangleF]::new(40, 226, 460, 96))

  $cards = @(
    @{ x=40;  y=346; w=142; h=188; yr="1989 · Game Boy"; t="Tetris";            r1=36;  g1=110; b1=168; r2=16; g2=48; b2=82;  tag="✓ Played" },
    @{ x=199; y=346; w=142; h=188; yr="1991 · Amiga";    t="Lemmings";          r1=32;  g1=128; b1=88;  r2=14; g2=56; b2=38;  tag="★ Played a ton" },
    @{ x=358; y=346; w=142; h=188; yr="1998 · N64";      t="Ocarina of Time";   r1=186; g1=88;  b1=34;  r2=78; g2=34; b2=14;  tag="♥ Favorite" },
    @{ x=40;  y=566; w=142; h=188; yr="1997 · PS1";      t="Final Fantasy VII"; r1=62;  g1=78;  b1=172; r2=26; g2=32; b2=84;  tag="◆ Carried me" },
    @{ x=199; y=566; w=142; h=188; yr="2001 · PS2";      t="GTA III";           r1=172; g1=54;  b1=96;  r2=74; g2=22; b2=44;  tag="✓ Played" },
    @{ x=358; y=566; w=142; h=188; yr="2017 · Switch";   t="Breath of the Wild";r1=28;  g1=132; b1=136; r2=12; g2=58; b2=64;  tag="♥ Favorite" }
  )
  $rim = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(85, 255, 255, 255), 1.5)
  foreach ($c in $cards) {
    $cp = New-RoundedRectPath $c.x $c.y $c.w $c.h 12
    $cb = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      [System.Drawing.Point]::new($c.x, $c.y),
      [System.Drawing.Point]::new(($c.x + $c.w), ($c.y + $c.h)),
      [System.Drawing.Color]::FromArgb(255, $c.r1, $c.g1, $c.b1),
      [System.Drawing.Color]::FromArgb(255, $c.r2, $c.g2, $c.b2)
    )
    $g.FillPath($cb, $cp)
    $g.DrawPath($rim, $cp)
    $g.DrawString([string]$c.t, $fCard, $white, [System.Drawing.RectangleF]::new(($c.x + 12), ($c.y + 14), ($c.w - 24), 70))
    $g.DrawString([string]$c.tag, $fYr, $accent, [single]($c.x + 12), [single]($c.y + $c.h - 50))
    $g.DrawString([string]$c.yr, $fYr, $sub, [single]($c.x + 12), [single]($c.y + $c.h - 28))
  }

  $pill = New-RoundedRectPath 40 796 460 108 16
  $g.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 23, 31, 44)), $pill)
  $g.DrawPath([System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 138, 180, 248), 1.5), $pill)
  $g.DrawString("WORKS OFFLINE  ·  ZERO SIGN-UP", $fEye, $accent, [single]62, [single]818)
  $g.DrawString("4,190 games · 65 studio histories · Shareable PNG cards", $fSub, $white, [System.Drawing.RectangleF]::new(62, 844, 420, 48))

  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "Generated $outPath ($W x $H)"
}

Save-PwaIcon (Join-Path $dist 'icon-192.png')          192 $false 0.68
Save-PwaIcon (Join-Path $dist 'icon-512.png')          512 $false 0.68
Save-PwaIcon (Join-Path $dist 'icon-maskable-512.png') 512 $true  0.58
Save-PwaIcon (Join-Path $dist 'apple-touch-icon.png')  180 $true  0.66
Save-MobilePreview (Join-Path $dist 'pwa-mobile.png')
