# Generates dist\og-card.png (1200x630 OpenGraph / social preview card) using built-in .NET System.Drawing
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Drawing

$W = 1200; $H = 630
$bmp = [System.Drawing.Bitmap]::new($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Point]::new(0, 0),
  [System.Drawing.Point]::new($W, $H),
  [System.Drawing.Color]::FromArgb(255, 15, 20, 28),
  [System.Drawing.Color]::FromArgb(255, 24, 35, 56)
)
$g.FillRectangle($bgBrush, 0, 0, $W, $H)

$gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(18, 138, 180, 248), 1)
for ($x = 0; $x -lt $W; $x += 32) { $g.DrawLine($gridPen, $x, 0, $x, $H) }
for ($y = 0; $y -lt $H; $y += 32) { $g.DrawLine($gridPen, 0, $y, $W, $y) }

$nodes = @(
  @{ x=686; y=82;  w=118; h=156; yr="1962"; t="Spacewar!";       r1=22;  g1=86;  b1=58;  r2=10; g2=34; b2=24 },
  @{ x=686; y=282; w=118; h=156; yr="1984"; t="Elite";           r1=42;  g1=72;  b1=155; r2=20; g2=34; b2=78 },
  @{ x=860; y=170; w=124; h=164; yr="1998"; t="Ocarina of Time"; r1=34;  g1=118; b1=82;  r2=16; g2=52; b2=38 },
  @{ x=860; y=374; w=124; h=164; yr="2001"; t="GTA III";         r1=176; g1=92;  b1=28;  r2=76; g2=36; b2=12 },
  @{ x=1032;y=232; w=132; h=176; yr="2026"; t="GTA VI";          r1=214; g1=62;  b1=102; r2=88; g2=24; b2=62 }
)

$curvePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(195, 138, 180, 248), 3)
$pairs = @( @(0,2), @(1,3), @(2,3), @(3,4), @(2,4) )
foreach ($pr in $pairs) {
  $a = $nodes[$pr[0]]; $b = $nodes[$pr[1]]
  [int]$x1 = $a.x + $a.w; [int]$y1 = $a.y + ($a.h / 2)
  [int]$x2 = $b.x;        [int]$y2 = $b.y + ($b.h / 2)
  [int]$dx = [Math]::Max(28, [int](($x2 - $x1) / 2))
  $g.DrawBezier($curvePen, $x1, $y1, ($x1 + $dx), $y1, ($x2 - $dx), $y2, $x2, $y2)
}

$fCardYr = [System.Drawing.Font]::new("Consolas", 11, [System.Drawing.FontStyle]::Bold)
$fCardT  = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$white   = [System.Drawing.Brushes]::White
$yrBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(215, 230, 236, 248))
$borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(75, 255, 255, 255), 1.5)

foreach ($n in $nodes) {
  [int]$nx = $n.x; [int]$ny = $n.y; [int]$nw = $n.w; [int]$nh = $n.h
  $rect = [System.Drawing.Rectangle]::new($nx, $ny, $nw, $nh)
  $cb = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new($nx, $ny),
    [System.Drawing.Point]::new(($nx + $nw), ($ny + $nh)),
    [System.Drawing.Color]::FromArgb(255, $n.r1, $n.g1, $n.b1),
    [System.Drawing.Color]::FromArgb(255, $n.r2, $n.g2, $n.b2)
  )
  $g.FillRectangle($cb, $rect)
  $g.DrawRectangle($borderPen, $rect)
  $tRect = [System.Drawing.RectangleF]::new([single]($nx + 10), [single]($ny + 12), [single]($nw - 20), [single]($nh - 42))
  $g.DrawString([string]$n.t, $fCardT, $white, $tRect)
  $g.DrawString([string]$n.yr, $fCardYr, $yrBrush, [single]($nx + 10), [single]($ny + $nh - 26))
}

$accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 138, 180, 248))
$logoBg      = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 26, 99, 216))
$g.FillRectangle($logoBg, 64, 66, 36, 36)
$g.FillRectangle($white, 73, 74, 6, 20)
$g.FillRectangle($white, 79, 81, 13, 6)

$fEyebrow = [System.Drawing.Font]::new("Consolas", 14, [System.Drawing.FontStyle]::Bold)
$fTitle   = [System.Drawing.Font]::new("Segoe UI", 44, [System.Drawing.FontStyle]::Bold)
$fSub     = [System.Drawing.Font]::new("Segoe UI", 19, [System.Drawing.FontStyle]::Regular)
$fStats   = [System.Drawing.Font]::new("Consolas", 14, [System.Drawing.FontStyle]::Bold)

$g.DrawString("INSPIRED BY  ·  GAME HISTORY & MAKERS", $fEyebrow, $accentBrush, [single]114, [single]74)
$hRect = [System.Drawing.RectangleF]::new([single]60, [single]134, [single]595, [single]180)
$g.DrawString("The Family Tree of`nVideo Games", $fTitle, $white, $hRect)

$subBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 198, 206, 222))
$sRect = [System.Drawing.RectangleF]::new([single]64, [single]296, [single]585, [single]180)
$g.DrawString("Build your childhood or dev-career timeline in two minutes, honor the human teams behind the art, and trace 4,180+ games back to the 1950s.", $fSub, $subBrush, $sRect)

$g.DrawString("4,182 games  ·  2,749 sourced links  ·  65 studio tributes", $fStats, $accentBrush, [single]64, [single]538)

$outPath = Join-Path $root 'dist\og-card.png'
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "Generated $outPath"
