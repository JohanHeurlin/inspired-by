# Generates PWA launcher icons (icon-192.png, icon-512.png, icon-maskable-512.png,
# icon-monochrome-512.png, apple-touch-icon.png) and mobile Richer-Install preview
# screenshot (pwa-mobile.png) in dist\ using built-in .NET System.Drawing.
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

# Symmetrical 13x11 16-bit Pixel Heart matrix:
#   W = crisp white pixel border, R = coral-red fill, S = ruby shade, H = white L-shine
$HEART_ROWS = @(
  "..WWW...WWW..",
  ".WRRRW.WRRRW.",
  "WRHHRRWRRRRSW",
  "WRHRRRRRRRRSW",
  "WRRRRRRRRRRSW",
  ".WRRRRRRRRSW.",
  "..WRRRRRRSW..",
  "...WRRRRSW...",
  "....WRRSW....",
  ".....WSW.....",
  "......W......"
)

function Draw-PixelHeart([System.Drawing.Graphics]$g, [single]$cx, [single]$cy, [single]$targetWidth, [bool]$monochrome = $false) {
  $cols = 13; $rows = 11
  # Snap pixel cell size to integer pixels when large enough so edges are razor-sharp
  $px = if ($targetWidth -ge 52) { [single][Math]::Round($targetWidth / $cols) } else { [single]($targetWidth / $cols) }
  $totalW = $px * $cols
  $totalH = $px * $rows
  $ox = [single][Math]::Round($cx - ($totalW / 2.0))
  $oy = [single][Math]::Round($cy - ($totalH / 2.0))

  $bWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $bRed   = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 84, 66))
  $bShade = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 214, 48, 34))

  $oldSmooth = $g.SmoothingMode
  $oldOffset = $g.PixelOffsetMode
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

  for ($ry = 0; $ry -lt $rows; $ry++) {
    $line = $HEART_ROWS[$ry]
    for ($rx = 0; $rx -lt $cols; $rx++) {
      $ch = $line[$rx]
      if ($ch -eq '.') { continue }
      $x = [single]($ox + ($rx * $px))
      $y = [single]($oy + ($ry * $px))
      # Slight overlap (+0.35px when fractional) prevents hairline seams at tiny sizes
      $s = if ($px -eq [Math]::Floor($px)) { $px } else { [single]($px + 0.35) }
      if ($monochrome) {
        # For Android 13+ monochrome themed icons: render crisp inner silhouette with transparent L-shine cutout
        if ($ch -eq 'R' -or $ch -eq 'S') {
          $g.FillRectangle($bWhite, $x, $y, $s, $s)
        }
      } else {
        $brush = switch ($ch) {
          'W' { $bWhite }
          'H' { $bWhite }
          'S' { $bShade }
          default { $bRed }
        }
        $g.FillRectangle($brush, $x, $y, $s, $s)
      }
    }
  }

  $g.SmoothingMode = $oldSmooth
  $g.PixelOffsetMode = $oldOffset
  $bWhite.Dispose(); $bRed.Dispose(); $bShade.Dispose()
}

function Save-PwaIcon([string]$outPath, [int]$size, [bool]$fullBleed, [single]$markScale, [bool]$monochrome = $false) {
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  if (-not $monochrome) {
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
      [System.Drawing.Color]::FromArgb(255, 29, 106, 229),
      [System.Drawing.Color]::FromArgb(255, 13, 32, 74)
    )
    $g.FillPath($bgBrush, $bgPath)

    # Clip subtle designer-notebook grid lines inside the icon silhouette
    $oldClip = $g.Clip
    $g.SetClip($bgPath)
    $step = [Math]::Max(12, [int]($size / 8))
    $gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(28, 255, 255, 255), [Math]::Max(1.0, $size / 256.0))
    for ($gx = $step; $gx -lt $size; $gx += $step) {
      $g.DrawLine($gridPen, $gx, 0, $gx, $size)
      $g.DrawLine($gridPen, 0, $gx, $size, $gx)
    }

    # Subtle top-left glow
    $sheenBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(24, 165, 210, 255))
    $g.FillEllipse($sheenBrush, -[single]($size * 0.2), -[single]($size * 0.25), [single]($size * 0.9), [single]($size * 0.7))
    $g.Clip = $oldClip

    if (-not $fullBleed) {
      $rimPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(68, 255, 255, 255), [Math]::Max(1.5, $size / 160.0))
      $g.DrawPath($rimPen, $bgPath)
    }
  }

  $heartW = [single]($size * $markScale)
  # Optical vertical nudge (+1.5% height) because a heart tapers at the bottom
  Draw-PixelHeart $g ([single]($size / 2.0)) ([single](($size / 2.0) + ($size * 0.015))) $heartW $monochrome

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
  $g.FillPath([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 29, 106, 229)), $logoBg)
  Draw-PixelHeart $g 59 71.5 26 $false

  $fEye   = [System.Drawing.Font]::new("Consolas", 12, [System.Drawing.FontStyle]::Bold)
  $fTitle = [System.Drawing.Font]::new("Segoe UI", 30, [System.Drawing.FontStyle]::Bold)
  $fSub   = [System.Drawing.Font]::new("Segoe UI", 14.5, [System.Drawing.FontStyle]::Regular)
  $fYr    = [System.Drawing.Font]::new("Consolas", 9.8, [System.Drawing.FontStyle]::Bold)
  $fCard  = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

  $g.DrawString("PLAYED & MADE", $fEye, $accent, [single]90, [single]62)
  $g.DrawString("Your Life in Games`n& Who Built Them", $fTitle, $white, [System.Drawing.RectangleF]::new(38, 112, 464, 110))
  $g.DrawString("Tap childhood favorites across every console & home computer, trace 4,195+ games to their roots, and send thank-you postcards to the makers.", $fSub, $sub, [System.Drawing.RectangleF]::new(40, 226, 460, 96))

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
  $g.DrawString("4,195+ games · 65 studio histories · Shareable PNG cards", $fSub, $white, [System.Drawing.RectangleF]::new(62, 844, 420, 48))

  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "Generated $outPath ($W x $H)"
}

Save-PwaIcon (Join-Path $dist 'icon-192.png')            192 $false 0.68 $false
Save-PwaIcon (Join-Path $dist 'icon-512.png')            512 $false 0.68 $false
Save-PwaIcon (Join-Path $dist 'icon-maskable-512.png')   512 $true  0.57 $false
Save-PwaIcon (Join-Path $dist 'icon-monochrome-512.png') 512 $true  0.68 $true
Save-PwaIcon (Join-Path $dist 'apple-touch-icon.png')    180 $true  0.65 $false
Save-MobilePreview (Join-Path $dist 'pwa-mobile.png')
