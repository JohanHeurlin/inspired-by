# Inspired By - build script
# Merges the base data (from the Nov 7 artifact) with research-agent output in data\agents,
# validates it, and injects a compact JSON blob into src\app.html -> dist\inspired-by.html.
# Run:  powershell -ExecutionPolicy Bypass -File tools\build.ps1
param([switch]$NoAgents, [string]$Out = "dist\inspired-by.html")
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
[Environment]::CurrentDirectory = $root
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$ser.MaxJsonLength = [int]::MaxValue
$utf8 = New-Object System.Text.UTF8Encoding($false)
function ReadJson([string]$p) { return $ser.DeserializeObject([IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)) }
function Get([object]$d, [string]$k) { if ($d -is [System.Collections.IDictionary] -and $d.ContainsKey($k)) { return $d[$k] } return $null }
function Str([object]$v) { if ($null -eq $v) { return '' } return ([string]$v).Trim() }
function Fold([string]$t) {
  $n = $t.Normalize([Text.NormalizationForm]::FormD); $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $n.ToCharArray()) { if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) } }
  return $sb.ToString()
}
function Norm([string]$t) { return ((Fold $t).ToLowerInvariant().Replace('&', 'and') -replace '[^a-z0-9]+', '') }
function Slug([string]$t) { return (((Fold $t).ToLowerInvariant().Replace('&', ' and ') -replace "['’`]", '') -replace '[^a-z0-9]+', '-').Trim('-') }
$log = New-Object System.Collections.Generic.List[string]
function Note([string]$m) { $log.Add($m) }

$GENRES = @(
  @('roots','Roots & tabletop'), @('arcade','Arcade'), @('shmup',"Shoot 'em up"), @('platformer','Platformer'), @('metroidvania','Metroidvania'),
  @('action-adventure','Action-adventure'), @('open-world','Open world'), @('fps','First-person shooter'), @('shooter','Shooter'), @('battle-royale','Battle royale & extraction'),
  @('immersive-sim','Immersive sim & stealth'), @('horror','Horror'), @('rpg','Western RPG'), @('jrpg','Japanese RPG'), @('arpg','Action RPG & soulslike'),
  @('roguelike','Roguelike'), @('mmo','Online world'), @('strategy','Strategy & tactics'), @('moba','MOBA & auto-battler'), @('sim','Simulation & management'),
  @('survival','Survival & sandbox'), @('adventure','Adventure & story'), @('puzzle','Puzzle'), @('fighting','Fighting'), @('beat-em-up',"Beat 'em up"),
  @('racing','Racing'), @('sports','Sports'), @('party','Party & music'), @('card','Card & deckbuilder'), @('space','Space & flight'))
$genreIdx = @{}; for ($i = 0; $i -lt $GENRES.Count; $i++) { $genreIdx[$GENRES[$i][0]] = $i }
$genreAlias = @{ 'action'='action-adventure'; 'stealth'='immersive-sim'; 'tactics'='strategy'; 'rts'='strategy'; '4x'='strategy'; 'simulation'='sim'; 'management'='sim'; 'sandbox'='survival'; 'crafting'='survival'; 'tps'='shooter'; 'music'='party'; 'rhythm'='party'; 'deckbuilder'='card'; 'flight'='space'; 'maze'='arcade'; 'souls'='arpg'; 'soulslike'='arpg'; 'narrative'='adventure'; 'tabletop'='roots'; 'extraction'='battle-royale'; 'mobile'='puzzle'; 'auto-battler'='moba' }
$TIERS = @('dev','team','series','critic','mech','disp')
$tierRank = @{ dev=6; team=5; critic=4; series=3; mech=2; disp=1 }
$RELS = @('','synthesis','evolution','mod','fast-follow','variant')
$relIdx = @{}; for ($i = 0; $i -lt $RELS.Count; $i++) { $relIdx[$RELS[$i]] = $i }
$platCanon = @{ 'PC'='PC (Windows)'; 'Windows'='PC (Windows)'; 'DOS'='PC (DOS)'; 'MS-DOS'='PC (DOS)'; 'Genesis'='Mega Drive / Genesis'; 'Mega Drive'='Mega Drive / Genesis'; 'Sega Genesis'='Mega Drive / Genesis'; 'PS1'='PlayStation'; 'PS2'='PlayStation 2'; 'PS3'='PlayStation 3'; 'PS4'='PlayStation 4'; 'PS5'='PlayStation 5'; 'Xbox Series X/S'='Xbox Series X|S'; 'Xbox Series'='Xbox Series X|S'; 'iOS'='iPhone / iPad'; 'iPhone'='iPhone / iPad'; 'N64'='Nintendo 64'; 'GBA'='Game Boy Advance'; 'DS'='Nintendo DS'; '3DS'='Nintendo 3DS'; 'Nintendo Switch'='Switch'; 'Nintendo Switch 2'='Switch 2'; 'PC Engine'='TurboGrafx-16'; 'Commodore Amiga'='Amiga'; 'C64'='Commodore 64'; 'Web'='Browser'; 'Flash'='Browser'; 'PDP-1'='Mainframe'; 'PLATO'='Mainframe' }

# ---------------- games ----------------
$games = New-Object System.Collections.Generic.List[object]
$byId = @{}; $byNorm = @{}
function Plats($arr) { $o = New-Object System.Collections.Generic.List[string]; foreach ($p in @($arr)) { $s = Str $p; if (-not $s) { continue }; if ($platCanon.ContainsKey($s)) { $s = $platCanon[$s] }; if (-not $o.Contains($s)) { $o.Add($s) } }; return ,$o.ToArray() }
function Genres($arr) { $o = New-Object System.Collections.Generic.List[string]; foreach ($x in @($arr)) { $s = (Str $x).ToLowerInvariant(); if ($genreAlias.ContainsKey($s)) { $s = $genreAlias[$s] }; if ($genreIdx.ContainsKey($s) -and -not $o.Contains($s)) { $o.Add($s) } }; return ,$o.ToArray() }
function NewGame([string]$id, [string]$title, [int]$year) {
  if ($byId.ContainsKey($id)) { if ($id -notmatch "-$year$") { $id = "$id-$year" }; $n = 2; $b = $id; while ($byId.ContainsKey($id)) { $id = "$b-$n"; $n++ } }
  $g = [ordered]@{ id = $id; title = $title; year = $year; dev = ''; cc = ''; genres = @(); plats = @(); pop = 0; note = ''; aka = @(); src = '' }
  $games.Add($g); $byId[$id] = $g; $k = Norm $title; if (-not $byNorm.ContainsKey($k)) { $byNorm[$k] = $g }
  if (-not $byNormList.ContainsKey($k)) { $byNormList[$k] = New-Object System.Collections.Generic.List[object] }; $byNormList[$k].Add($g)
  $k2 = NoThe $k; if (-not $byNormThe.ContainsKey($k2)) { $byNormThe[$k2] = $g }
  return $g
}
$byNormThe = @{}; $byNormList = @{}
function NoThe([string]$k) { if ($k.StartsWith('the') -and $k.Length -gt 6) { return $k.Substring(3) } return $k }
function ClosestByTitle([string]$k, [int]$year, [int]$tol) {
  if (-not $byNormList.ContainsKey($k)) { return $null }
  $best = $null; $bd = 9999
  foreach ($c in $byNormList[$k]) { $dd = if ($year -eq 0) { 0 } else { [Math]::Abs($c.year - $year) }; if ($dd -lt $bd) { $bd = $dd; $best = $c } }
  if ($bd -le $tol) { return $best } return $null
}
function FindGame([string]$id, [string]$title, [int]$year) {
  # same game = same id or same title within a few years (early access vs 1.0, Japan vs West); further apart = a remake or reboot
  if ($id -and $byId.ContainsKey($id)) { $c = $byId[$id]; if ($year -eq 0 -or -not $title -or [Math]::Abs($c.year - $year) -le 2 -or ((Norm $c.title) -eq (Norm $title) -and [Math]::Abs($c.year - $year) -le 6)) { return $c } }
  if ($title) { $k = Norm $title; $c = ClosestByTitle $k $year 6; if ($c) { return $c }
    $k2 = NoThe $k; if ($byNormThe.ContainsKey($k2)) { $c = $byNormThe[$k2]; if ($year -eq 0 -or [Math]::Abs($c.year - $year) -le 1) { return $c } } }
  if ($id) { $s = $id -replace '-', ''; if ($byNorm.ContainsKey($s)) { $c = $byNorm[$s]; if ($year -eq 0 -or [Math]::Abs($c.year - $year) -le 2) { return $c } } }
  return $null
}
function Fill($g, $src) {
  $dev = Str (Get $src 'dev'); if ($dev -and -not $g.dev) { $g.dev = $dev }
  $cc = (Str (Get $src 'cc')).ToUpperInvariant(); if ($cc -match '^[A-Z]{2}$' -and -not $g.cc) { $g.cc = $cc }
  $gs = Genres (Get $src 'genres'); if ($gs.Count -and -not $g.genres.Count) { $g.genres = $gs }
  $ps = Plats (Get $src 'plats'); if ($ps.Count -and -not $g.plats.Count) { $g.plats = $ps }
  $pop = Get $src 'pop'; if ($pop -and -not $g.pop) { $g.pop = [int]$pop }
  $note = Str (Get $src 'note'); if ($note -and -not $g.note) { $g.note = $note }
}

$base = ReadJson 'data\base\data.json'
$catalog = ReadJson 'data\base\catalog.json'
$devs = ReadJson 'data\base\devs.json'
$platsMap = ReadJson 'data\base\plats.json'
$countries = ReadJson 'data\base\countries.json'
foreach ($bg in $base['games']) {
  $g = NewGame (Str $bg['id']) (Str $bg['title']) ([int]$bg['year']); $g.dev = Str $bg['dev']; $g.note = Str $bg['note']; $g.src = 'base'
}
foreach ($y in $catalog.Keys) {
  foreach ($e in $catalog[$y]) {
    $t = Str $e[0]; $g = FindGame '' $t ([int]$y)
    if (-not $g) {
      if ($byNorm.ContainsKey((Norm $t))) { $g = NewGame ((Slug $t) + "-$y") "$t ($y)" ([int]$y); $g.noMaps = $true }
      else { $g = NewGame (Slug $t) $t ([int]$y) }
      $g.src = 'catalog'
    }
    $g.inCat = $true
  }
}
foreach ($g in $games) {
  if ($g.noMaps) { continue }
  if (-not $g.dev -and $devs.ContainsKey($g.title)) { $g.dev = Str $devs[$g.title] }
  if ($platsMap.ContainsKey($g.title)) { $g.plats = Plats $platsMap[$g.title] }
  $studio = ($g.dev -split '\s+/\s+')[0]; if ($studio -and $countries.ContainsKey($studio)) { $g.cc = Str $countries[$studio] }
}

# ---------------- agent files ----------------
$agentLinks = New-Object System.Collections.Generic.List[object]
$updates = New-Object System.Collections.Generic.List[object]
$tags = New-Object System.Collections.Generic.List[object]
$files = @(); if (-not $NoAgents) { $files = Get-ChildItem 'data\agents' -Filter *.json -ErrorAction SilentlyContinue | Sort-Object Name }
$agentGameCount = 0
foreach ($f in $files) {
  try { $d = ReadJson $f.FullName } catch { Note "PARSE FAIL $($f.Name): $($_.Exception.Message)"; continue }
  $slice = ($f.BaseName -replace '-\d+$', '')
  foreach ($ag in @(Get $d 'games')) {
    if ($null -eq $ag) { continue }
    $title = Str (Get $ag 'title'); $year = [int](Get $ag 'year'); $id = Str (Get $ag 'id')
    if (-not $title -or $year -lt 1800 -or $year -gt 2026) { Note "skip game (bad title/year) in $($f.Name): $title $year"; continue }
    if (-not $id) { $id = Slug $title }
    $g = FindGame $id $title $year
    if (-not $g) { if ($byId.ContainsKey($id)) { $id = "$id-$year" }; $g = NewGame $id $title $year; $g.src = $slice; $agentGameCount++ }
    else { $g.alias = $id }
    if ($slice -like 'catalog-*') { $g.inCat = $true }
    Fill $g $ag
  }
  foreach ($l in @(Get $d 'links')) { if ($null -ne $l) { $l['_file'] = $f.Name; $agentLinks.Add($l) } }
  foreach ($u in @(Get $d 'updates')) { if ($null -ne $u) { $u['_file'] = $f.Name; $updates.Add($u) } }
  foreach ($t in @(Get $d 'tags')) { if ($null -ne $t) { $tags.Add($t) } }
}
# tags (genres / pop / cc for the base games)
foreach ($t in $tags) {
  $g = FindGame (Str (Get $t 'id')) (Str (Get $t 'title')) 0
  if (-not $g) { continue }
  $gs = Genres (Get $t 'genres'); if ($gs.Count) { $g.genres = $gs }
  $pop = Get $t 'pop'; if ($pop) { $g.pop = [int]$pop }
  $cc = (Str (Get $t 'cc')).ToUpperInvariant(); if ($cc -match '^[A-Z]{2}$' -and -not $g.cc) { $g.cc = $cc }
}
# updates: pop always; year/dev/title only when they come with a reason
$applied = 0
foreach ($u in $updates) {
  $g = FindGame (Str (Get $u 'id')) (Str (Get $u 'title')) 0; if (-not $g) { continue }
  $field = Str (Get $u 'field'); $val = Get $u 'value'
  switch ($field) {
    'pop' { if ($val) { $g.pop = [int]$val; $applied++ } }
    'year' { if ((Str (Get $u 'why')) -and [int]$val -ge 1800) { Note "year update: $($g.title) $($g.year) -> $val ($($u['why']))"; $g.year = [int]$val; $applied++ } }
    'dev' { if (Str (Get $u 'why')) { Note "dev update: $($g.title) '$($g.dev)' -> '$val'"; $g.dev = Str $val; $applied++ } }
    'cc' { $c = (Str $val).ToUpperInvariant(); if ($c -match '^[A-Z]{2}$') { $g.cc = $c; $applied++ } }
    'genres' { $gs = Genres $val; if ($gs.Count) { $g.genres = $gs; $applied++ } }
    'addPlats' { foreach ($np in (Plats $val)) { if ($g.plats -notcontains $np) { $g.plats = @($g.plats) + $np } }; $applied++ }
    'note' { if (Str $val) { $g.note = Str $val; $applied++ } }
  }
}

# hand-checked corrections
$corr = $null; if (Test-Path 'data\corrections.json') { $corr = ReadJson 'data\corrections.json' }
if ($corr) {
  foreach ($c in @(Get $corr 'games')) {
    $g = $byId[(Str $c['id'])]; if (-not $g) { Note "correction: unknown id $($c['id'])"; continue }
    $set = $c['set']
    foreach ($k in $set.Keys) {
      switch ($k) {
        'plats' { $g.plats = Plats $set[$k] } 'genres' { $g.genres = Genres $set[$k] } 'year' { $g.year = [int]$set[$k] } 'pop' { $g.pop = [int]$set[$k] }
        'title' { $g.title = Str $set[$k]; $kk = Norm $g.title; if (-not $byNorm.ContainsKey($kk)) { $byNorm[$kk] = $g } }
        default { $g[$k] = Str $set[$k] }
      }
    }
  }
}

# ---------------- links ----------------
$resolve = @{}
foreach ($g in $games) { $resolve[$g.id] = $g }
foreach ($g in $games) { if ($g.alias -and -not $resolve.ContainsKey($g.alias)) { $resolve[$g.alias] = $g } }
foreach ($g in $games) { foreach ($k in @((Slug $g.title), ((Slug $g.title) + '-' + $g.year))) { if (-not $resolve.ContainsKey($k)) { $resolve[$k] = $g } } }
function ResolveId([string]$x) { if (-not $x) { return $null }; if ($resolve.ContainsKey($x)) { return $resolve[$x] }; $k = $x -replace '-', ''; if ($byNorm.ContainsKey($k)) { return $byNorm[$k] }; $k2 = ($x -replace '-(19|20)\d\d$', '') -replace '-', ''; if ($byNorm.ContainsKey($k2)) { return $byNorm[$k2] }; return $null }
$links = New-Object System.Collections.Generic.List[object]
$pairs = @{}
function AddLink($from, $to, $l, [string]$origin) {
  $tier = (Str (Get $l 'tier')).ToLowerInvariant(); if (-not $tierRank.ContainsKey($tier)) { Note "bad tier '$tier' $($from.id)>$($to.id) ($origin)"; return }
  if ($from.id -eq $to.id) { return }
  if ($from.year -gt $to.year) { Note "time travel dropped: $($from.title) ($($from.year)) > $($to.title) ($($to.year)) [$origin]"; return }
  $took = Str (Get $l 'took'); $added = Str (Get $l 'added')
  if (-not $took -and -not $added) { Note "empty link dropped: $($from.id)>$($to.id) [$origin]"; return }
  $rel = (Str (Get $l 'rel')).ToLowerInvariant(); if (-not $relIdx.ContainsKey($rel)) { $rel = '' }
  $src = New-Object System.Collections.Generic.List[object]
  foreach ($s in @(Get $l 'src')) { if ($null -eq $s) { continue }; if ($s -is [string]) { $src.Add(@((Str $s), '')) } else { $t = Str (Get $s 't'); $u = Str (Get $s 'u'); if ($u -and $u -notmatch '^https?://') { $u = '' }; if ($t -or $u) { $src.Add(@($t, $u)) } } }
  $key = "$($from.id)>$($to.id)"; $rev = "$($to.id)>$($from.id)"
  if ($pairs.ContainsKey($rev)) { Note "reverse pair skipped: $key [$origin]"; return }
  $rec = [ordered]@{ from = $from; to = $to; tier = $tier; took = $took; added = $added; src = $src.ToArray(); extra = (Str (Get $l 'extra')); rel = $rel; disputed = ($tier -eq 'disp'); origin = $origin }
  if ($pairs.ContainsKey($key)) {
    $old = $pairs[$key]
    $hadDisp = [bool]($old.disputed -or ($tier -eq 'disp'))
    $dispNote = if ($tier -eq 'disp' -and $rec.extra) { $rec.extra } elseif ($old.tier -eq 'disp' -and $old.extra) { $old.extra } else { '' }
    # a documented denial ("disp") beats a weaker claim on the same pair; otherwise stronger evidence (or richer sources/rel) wins while preserving dispute flag
    $replace = $false
    if ($tier -eq 'disp' -and $old.tier -ne 'disp' -and $old.tier -ne 'dev') { $replace = $true }
    elseif ($old.tier -eq 'disp' -and $tier -ne 'dev') { $replace = $false }
    elseif ($tierRank[$tier] -gt $tierRank[$old.tier] -or ($tierRank[$tier] -eq $tierRank[$old.tier] -and $src.Count -gt $old.src.Count) -or ($tierRank[$tier] -eq $tierRank[$old.tier] -and $rel -and -not $old.rel)) { $replace = $true }
    if ($replace) {
      $rec.disputed = $hadDisp
      if (-not $rec.rel -and $old.rel) { $rec.rel = $old.rel }
      if ($dispNote -and -not $rec.extra) { $rec.extra = $dispNote }
      $i = $links.IndexOf($old); $links[$i] = $rec; $pairs[$key] = $rec; Note "pair conflict: $key kept $tier over $($old.tier) [$origin vs $($old.origin)]"
    } else {
      $old.disputed = $hadDisp
      if (-not $old.rel -and $rel) { $old.rel = $rel }
      if ($dispNote -and -not $old.extra) { $old.extra = $dispNote }
      if ($tier -ne $old.tier) { Note "pair conflict: $key kept $($old.tier) over $tier [$($old.origin) vs $origin]" }
    }
    return
  }
  $links.Add($rec); $pairs[$key] = $rec
}
$drop = @{}; if ($corr) { foreach ($p in @(Get $corr 'dropLinks')) { if ($p) { $drop["$($p[0])>$($p[1])"] = 1 } } }
foreach ($l in $base['links']) { if ($drop.ContainsKey("$($l['from'])>$($l['to'])")) { continue }; $a = ResolveId (Str $l['from']); $b = ResolveId (Str $l['to']); if ($a -and $b) { AddLink $a $b $l 'base' } }
if ($corr) { foreach ($l in @(Get $corr 'addLinks')) { if (-not $l) { continue }; $a = ResolveId (Str $l['from']); $b = ResolveId (Str $l['to']); if ($a -and $b) { AddLink $a $b $l 'corrections' } else { Note "correction link unresolved: $($l['from'])>$($l['to'])" } } }
# same-named games (Utopia 1981 vs 1991): pick the pair that respects time and came from the same research slice
$candIndex = @{}
foreach ($g in $games) { foreach ($k in @(($g.id -replace '-(19|20)\d\d(-\d+)?$', ''), (Slug $g.title))) { if (-not $candIndex.ContainsKey($k)) { $candIndex[$k] = New-Object System.Collections.Generic.List[object] }; if (-not $candIndex[$k].Contains($g)) { $candIndex[$k].Add($g) } } }
function Candidates([string]$x) {
  $list = New-Object System.Collections.Generic.List[object]
  $r = ResolveId $x; if ($r) { $list.Add($r) }
  $b = $x -replace '-(19|20)\d\d$', ''
  if ($candIndex.ContainsKey($b)) { foreach ($g in $candIndex[$b]) { if (-not $list.Contains($g)) { $list.Add($g) } } }
  return ,$list
}
function PickPair([string]$fromId, [string]$toId, [string]$slice) {
  $ca = Candidates $fromId; $cb = Candidates $toId
  if (-not $ca.Count -or -not $cb.Count) { return $null }
  if ($ca.Count -eq 1 -and $cb.Count -eq 1) { return @($ca[0], $cb[0]) }
  $best = $null; $bs = -1e9
  foreach ($a in $ca) { foreach ($b in $cb) {
    if ($a.id -eq $b.id) { continue }
    $s = 0; if ($a.year -le $b.year) { $s += 100 }
    if ($a.src -eq $slice) { $s += 5 }; if ($b.src -eq $slice) { $s += 5 }
    if ($a.id -eq $fromId) { $s += 3 }; if ($b.id -eq $toId) { $s += 3 }
    $s -= [Math]::Abs($b.year - $a.year) / 100
    if ($s -gt $bs) { $bs = $s; $best = @($a, $b) } } }
  return $best
}
$unresolved = @{}
foreach ($l in $agentLinks) {
  $fid = Str (Get $l 'from'); $tid = Str (Get $l 'to'); $slice = ($l['_file'] -replace '-\d+\.json$', '')
  $pair = PickPair $fid $tid $slice
  if (-not $pair) { if (-not (ResolveId $fid)) { $unresolved[$fid] = 1 + [int]$unresolved[$fid] } else { $unresolved[$tid] = 1 + [int]$unresolved[$tid] }; continue }
  AddLink $pair[0] $pair[1] $l $l['_file']
}

# duplicate titles left after merging (worth a look)
$games | Group-Object { Norm $_.title } | Where-Object { $_.Count -gt 1 } | ForEach-Object { Note ("duplicate title: " + (($_.Group | ForEach-Object { "$($_.title) [$($_.id), $($_.year)]" }) -join ' | ')) }

# hand edits to link text
if ($corr) { foreach ($e in @(Get $corr 'editLinks')) { if (-not $e) { continue }; $a = ResolveId (Str $e['from']); $b = ResolveId (Str $e['to']); if (-not $a -or -not $b) { Note "editLinks unresolved: $($e['from'])>$($e['to'])"; continue }
  $rec = $pairs["$($a.id)>$($b.id)"]; if (-not $rec) { Note "editLinks: no link $($a.id)>$($b.id)"; continue }
  foreach ($k in @('took','added','extra','tier','rel')) { if ($e.ContainsKey($k)) { $rec[$k] = Str $e[$k] } }
  if ($e.ContainsKey('disputed')) { $rec['disputed'] = [bool]$e['disputed'] } } }

# ---------------- derived fields ----------------
$deg = @{}; foreach ($l in $links) { $deg[$l.from.id] = 1 + [int]$deg[$l.from.id]; $deg[$l.to.id] = 1 + [int]$deg[$l.to.id] }
foreach ($g in $games) {
  if (-not $g.pop) { $d = [int]$deg[$g.id]; $g.pop = if ($d -ge 8) { 4 } elseif ($d -ge 3) { 3 } else { 2 } }
  if ($g.pop -lt 1) { $g.pop = 1 }; if ($g.pop -gt 5) { $g.pop = 5 }
}
# stable short codes for share links (append-only registry)
$codesPath = 'data\codes.json'
$codes = @{}; $next = 1
if (Test-Path $codesPath) { $c = ReadJson $codesPath; foreach ($k in $c.Keys) { $codes[$k] = [int]$c[$k] }; if ($codes.Count) { $next = ($codes.Values | Measure-Object -Maximum).Maximum + 1 } }
$ordered = $games | Sort-Object @{e = { $_.year } }, @{e = { $_.title } }
# key = normalized title + year (two games can share a title); older title-only keys are honoured once; every code is unique
$usedCodes = @{}
foreach ($g in $ordered) {
  $k1 = Norm $g.title; $k2 = "$k1|$($g.year)"; $code = $null
  if ($codes.ContainsKey($k2) -and -not $usedCodes.ContainsKey($codes[$k2])) { $code = $codes[$k2] }
  elseif ($codes.ContainsKey($k1) -and -not $usedCodes.ContainsKey($codes[$k1])) { $code = $codes[$k1] }
  if ($null -eq $code) { $code = $next; $next++ }
  $codes[$k2] = $code; $usedCodes[$code] = $g.id; $g.code = $code
}
if ($next -gt 46655) { Note "WARNING: share codes passed 46,655 and no longer fit in 3 characters" }
$cj = New-Object System.Text.StringBuilder; [void]$cj.Append('{'); $first = $true
foreach ($k in ($codes.Keys | Sort-Object)) { if (-not $first) { [void]$cj.Append(',') }; $first = $false; [void]$cj.Append('"' + $k + '":' + $codes[$k]) }
[void]$cj.Append('}'); [IO.File]::WriteAllText((Join-Path $root $codesPath), $cj.ToString(), $utf8)

# influence: number of distinct later games reachable through "inspired" links (C# for speed)
Add-Type -Language CSharp -TypeDefinition @"
using System.Collections.Generic;
public static class GraphTools {
  public static int[] Reach(int n, int[] from, int[] to) {
    var kids = new List<int>[n]; for (int i = 0; i < n; i++) kids[i] = new List<int>();
    for (int i = 0; i < from.Length; i++) kids[from[i]].Add(to[i]);
    var res = new int[n]; var seen = new int[n]; var stack = new Stack<int>(); int stamp = 0;
    for (int s = 0; s < n; s++) { stamp++; int c = 0; stack.Push(s); seen[s] = stamp;
      while (stack.Count > 0) { int v = stack.Pop(); foreach (int w in kids[v]) if (seen[w] != stamp) { seen[w] = stamp; c++; stack.Push(w); } }
      res[s] = c; }
    return res;
  }
}
"@
$gi = @{}; for ($i = 0; $i -lt $games.Count; $i++) { $gi[$games[$i].id] = $i }
$fa = [int[]]($links | ForEach-Object { $gi[$_.from.id] }); $ta = [int[]]($links | ForEach-Object { $gi[$_.to.id] })
$reach = [GraphTools]::Reach($games.Count, $fa, $ta)
for ($i = 0; $i -lt $games.Count; $i++) { $games[$i].inf = $reach[$i] }

# ---------------- aliases people type ----------------
$aka = @{
  'grand-theft-auto-vi'='gta 6 gta6 gtavi gta vi';
  'grand-theft-auto-v'='gta 5 gtav gta v'; 'grand-theft-auto-iii'='gta 3 gta iii'; 'grand-theft-auto-san-andreas'='gta sa'; 'grand-theft-auto-vice-city'='gta vc'; 'grand-theft-auto-iv'='gta 4';
  'the-legend-of-zelda-breath-of-the-wild'='botw'; 'the-legend-of-zelda-tears-of-the-kingdom'='totk'; 'the-legend-of-zelda-ocarina-of-time'='oot ocarina'; 'the-legend-of-zelda-a-link-to-the-past'='alttp';
  'castlevania-symphony-of-the-night'='sotn'; 'star-wars-knights-of-the-old-republic'='kotor'; 'baldurs-gate-3'='bg3'; 'red-dead-redemption-2'='rdr2'; 'world-of-warcraft'='wow';
  'league-of-legends'='lol'; 'counter-strike'='cs counterstrike'; 'pubg'='playerunknowns battlegrounds'; 'final-fantasy-vii'='ff7 ffvii'; 'metal-gear-solid'='mgs';
  'call-of-duty-4-modern-warfare'='cod4 cod 4'; 'defense-of-the-ancients'='dota'; 'super-mario-bros'='smb mario'; 'the-elder-scrolls-v-skyrim'='skyrim'; 'shadow-colossus'='sotc';
  'battlefield-1942'='bf1942 bf 1942'; 'age-of-empires-ii'='aoe2 aoe 2'; 'team-fortress-2'='tf2'; 'clair-obscur-expedition-33'='expedition 33 e33';
  'battle-city'='tanki tanchiki dendy tanks 1990'; 'darkwing-duck'='cherniy plashch dendy'; 'chip-n-dale-rescue-rangers'='chip and dale dendy'; 'teenage-mutant-ninja-turtles-iii-the-manhattan-project'='tmnt 3 tmnt3 dendy'
}

# ---------------- media, culture, mechanics & studios ----------------
function NormImg([string]$u) {
  if (-not $u) { return '' }
  if ($u.StartsWith('https://thumb.wikimedia.org/wikipedia/')) { return 'wt:' + $u.Substring(38) }
  if ($u.StartsWith('https://upload.wikimedia.org/wikipedia/')) { $u = 'w:' + $u.Substring(39) }
  if ($u.StartsWith('w:') -and $u.Contains('/thumb/')) { return 'wt:' + $u.Substring(2) }
  return $u
}
$media = @{}; if (Test-Path 'data\media.json') { $media = ReadJson 'data\media.json' }
$mediaExCovers = @{}; $mediaExYt = @{}
if (Test-Path 'data\media_extra.json') {
  $mex = ReadJson 'data\media_extra.json'
  if (Get $mex 'covers') { $mediaExCovers = Get $mex 'covers' }
  if (Get $mex 'yt') { $mediaExYt = Get $mex 'yt' }
}
$studiosRaw = @(); if (Test-Path 'data\studios.json') { $stDoc = ReadJson 'data\studios.json'; $studiosRaw = @(Get $stDoc 'studios') }
$ser2 = New-Object System.Web.Script.Serialization.JavaScriptSerializer; $ser2.MaxJsonLength = 67108864
$cultureJson = '{}'; if (Test-Path 'data\culture.json') {
  $cDoc = ReadJson 'data\culture.json'
  $cultureJson = $ser2.Serialize($cDoc)
}
$mwCoverFixes = @{}; $mwStudioLogos = @{}; $mwJson = '{}'
if (Test-Path 'data\mechanics_world.json') {
  $mwDoc = ReadJson 'data\mechanics_world.json'
  if (Get $mwDoc 'coverFixes') { $mwCoverFixes = Get $mwDoc 'coverFixes' }
  if (Get $mwDoc 'studioLogos') { $mwStudioLogos = Get $mwDoc 'studioLogos' }
  $mwExport = [ordered]@{
    mechanics  = @(Get $mwDoc 'mechanics')
    genres     = (Get $mwDoc 'genres')
    boardgames = @(Get $mwDoc 'boardgames')
    prices     = (Get $mwDoc 'prices')
    worldMap   = (Get $mwDoc 'worldMap')
  }
  $mwJson = $ser2.Serialize($mwExport)
}

# ---------------- write compact JSON ----------------
function J([string]$s) { return '"' + [System.Web.HttpUtility]::JavaScriptStringEncode($s) + '"' }
$platList = New-Object System.Collections.Generic.List[string]; $platIdx = @{}
foreach ($g in $games) { foreach ($p in $g.plats) { if (-not $platIdx.ContainsKey($p)) { $platIdx[$p] = $platList.Count; $platList.Add($p) } } }
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('{"v":5,"built":' + (J ((Get-Date).ToString('yyyy-MM-dd'))) + ',"genres":[')
[void]$sb.Append((($GENRES | ForEach-Object { '[' + (J $_[0]) + ',' + (J $_[1]) + ']' }) -join ','))
[void]$sb.Append('],"plats":[' + (($platList | ForEach-Object { J $_ }) -join ',') + '],"tiers":[' + (($TIERS | ForEach-Object { J $_ }) -join ',') + '],"rels":[' + (($RELS | ForEach-Object { J $_ }) -join ',') + '],"g":[')
$coverCount = 0; $mobyCount = 0; $ytCount = 0
for ($i = 0; $i -lt $games.Count; $i++) {
  $g = $games[$i]
  $ge = ($g.genres | ForEach-Object { $genreIdx[$_] }) -join ','
  $pl = ($g.plats | ForEach-Object { $platIdx[$_] }) -join ','
  $ak = ''; if ($aka.ContainsKey($g.id)) { $ak = $aka[$g.id] }
  $flags = 0; if ($g.inCat) { $flags = 1 }
  $mrec = Get $media $g.id
  $img = ''; $moby = 0; $yt = ''
  if ($mrec) {
    $img = Str (Get $mrec 'img')
    $mv = Get $mrec 'moby'; if ($mv) { $moby = [int]$mv; $mobyCount++ }
    $yt = Str (Get $mrec 'yt')
  }
  if (-not $img -and (Get $mediaExCovers $g.id)) { $img = Str (Get $mediaExCovers $g.id) }
  if (Get $mwCoverFixes $g.id) { $img = Str (Get $mwCoverFixes $g.id) }
  $img = NormImg $img
  if (-not $yt -and (Get $mediaExYt $g.id)) { $yt = Str (Get $mediaExYt $g.id) }
  if (-not $yt -and $mex -and (Get $mex $g.id)) { $sub = Get $mex $g.id; if ($sub -is [System.Collections.IDictionary] -and (Get $sub 'yt')) { $yt = Str (Get $sub 'yt') } }
  if ($img) { $coverCount++ }
  if ($yt) { $ytCount++ }
  if ($i) { [void]$sb.Append(',') }
  [void]$sb.Append('[' + $g.code + ',' + (J $g.id) + ',' + (J $g.title) + ',' + $g.year + ',' + (J $g.dev) + ',' + (J $g.cc) + ',[' + $ge + '],[' + $pl + '],' + $g.pop + ',' + (J $g.note) + ',' + $g.inf + ',' + (J $ak) + ',' + $flags + ',' + (J $img) + ',' + $moby + ',' + (J $yt) + ']')
}
[void]$sb.Append('],"l":[')
$tierIdx = @{}; for ($i = 0; $i -lt $TIERS.Count; $i++) { $tierIdx[$TIERS[$i]] = $i }
$minor = @{}; if ($corr) { foreach ($p in @(Get $corr 'minor')) { if ($p) { $minor["$($p[0])>$($p[1])"] = 1 } } }
for ($i = 0; $i -lt $links.Count; $i++) {
  $l = $links[$i]
  $srcs = ($l.src | ForEach-Object { '[' + (J $_[0]) + ',' + (J $_[1]) + ']' }) -join ','
  if ($i) { [void]$sb.Append(',') }
  $mn = 0; if ($minor.ContainsKey("$($l.from.id)>$($l.to.id)")) { $mn = 1 }
  if ($l.disputed) { $mn = $mn -bor 2 }
  $ri = if ($l.rel -and $relIdx.ContainsKey($l.rel)) { $relIdx[$l.rel] } else { 0 }
  [void]$sb.Append('[' + $gi[$l.from.id] + ',' + $gi[$l.to.id] + ',' + $tierIdx[$l.tier] + ',' + (J $l.took) + ',' + (J $l.added) + ',[' + $srcs + '],' + (J $l.extra) + ',' + $mn + ',' + $ri + ']')
}
[void]$sb.Append('],"studios":[')
$stFirst = $true
foreach ($st in $studiosRaw) {
  if (-not $st) { continue }
  if (-not $stFirst) { [void]$sb.Append(',') }; $stFirst = $false
  $als = (@(Get $st 'aliases') | Where-Object { $_ } | ForEach-Object { J (Str $_) }) -join ','
  $mks = (@(Get $st 'makers') | Where-Object { $_ } | ForEach-Object { J (Str $_) }) -join ','
  $dias = (@(Get $st 'diaspora') | Where-Object { $_ } | ForEach-Object { '[' + (J (Str (Get $_ 'studio'))) + ',' + (J (Str (Get $_ 'note'))) + ']' }) -join ','
  $fnd = if (Get $st 'founded') { [int](Get $st 'founded') } else { 0 }
  $cls = if (Get $st 'closed') { [int](Get $st 'closed') } else { 0 }
  $stid = Str (Get $st 'id')
  $stLogo = NormImg (Str (Get $mwStudioLogos $stid))
  [void]$sb.Append('[' + (J $stid) + ',' + (J (Str (Get $st 'name'))) + ',[' + $als + '],' + (J (Str (Get $st 'cc'))) + ',' + $fnd + ',' + $cls + ',' + (J (Str (Get $st 'status'))) + ',' + (J (Str (Get $st 'hq'))) + ',[' + $mks + '],' + (J (Str (Get $st 'bio'))) + ',[' + $dias + '],' + (J $stLogo) + ']')
}
[void]$sb.Append('],"culture":' + $cultureJson + ',"mw":' + $mwJson + '}')
$json = $sb.ToString()
[IO.File]::WriteAllText((Join-Path $root 'dist\data.json'), $json, $utf8)

$tpl = [IO.File]::ReadAllText((Join-Path $root 'src\app.html'), [Text.Encoding]::UTF8)
if ($tpl -notmatch '/\*__DATA__\*/') { throw 'src\app.html has no /*__DATA__*/ placeholder' }
$html = $tpl.Replace('/*__DATA__*/', $json)
[IO.File]::WriteAllText((Join-Path $root $Out), $html, $utf8)
# Standalone web document + installable PWA assets for GitHub Pages and local preview
$skel = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Played &amp; Made — Your Life in Games &amp; the Humans Who Built Them</title><meta name="description" content="Played &amp; Made: build your childhood or dev-career gaming timeline, trace 4,195+ games back to the 1950s, and send love to the human teams and machines that raised you."><meta name="application-name" content="Played&amp;Made"><meta name="apple-mobile-web-app-title" content="Played&amp;Made"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#EAF0F7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0F141C" media="(prefers-color-scheme: dark)"><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png"><meta property="og:site_name" content="Played &amp; Made"><meta property="og:title" content="Played &amp; Made — Your Life in Games &amp; the Humans Who Built Them"><meta property="og:description" content="What games carried you growing up, and who built them? Build your shareable timeline in two minutes, explore 60+ years of game lineage, and celebrate the makers behind the art."><meta property="og:type" content="website"><meta property="og:url" content="https://johanheurlin.github.io/inspired-by/"><meta property="og:image" content="https://johanheurlin.github.io/inspired-by/og-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://johanheurlin.github.io/inspired-by/og-card.png"><link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 17 17%27 shape-rendering=%27crispEdges%27%3E%3Crect width=%2717%27 height=%2717%27 rx=%274%27 fill=%27%231D6AE5%27 shape-rendering=%27geometricPrecision%27/%3E%3Cpath fill=%27%23fff%27 d=%27M4 3h3v1h1v1h1V4h1V3h3v1h1v1h1v3h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H8v-1H7v-1H6v-1H5v-1H4V9H3V8H2V5h1V4h1z%27/%3E%3Cpath fill=%27%23FF5442%27 d=%27M4 4h3v1h1v1h1V5h1V4h3v1h1v3h-1v1h-1v1h-1v1h-1v1H9v1H8v-1H7v-1H6v-1H5V9H4V8H3V5h1z%27/%3E%3Cpath fill=%27%23fff%27 d=%27M4 5h2v1H5v1H4z%27/%3E%3C/svg%3E"><style>:root{color-scheme:light dark;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:calc(3.5rem + env(safe-area-inset-top,0px));scroll-padding-bottom:calc(4.5rem + env(safe-area-inset-bottom,0px))}body{margin:0;padding:0;font:15px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000;overflow-wrap:break-word}img{max-inline-size:100%;block-size:auto}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>'
$indexDoc = $skel + $html + '</body></html>'
[IO.File]::WriteAllText((Join-Path $root 'dist\index.html'), $indexDoc, $utf8)

$manifestSrc = Join-Path $root 'src\manifest.webmanifest'
if (Test-Path $manifestSrc) {
  [IO.File]::WriteAllText((Join-Path $root 'dist\manifest.webmanifest'), [IO.File]::ReadAllText($manifestSrc, [Text.Encoding]::UTF8), $utf8)
}
$swSrc = Join-Path $root 'src\sw.js'
if (Test-Path $swSrc) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hashBytes = $sha.ComputeHash($utf8.GetBytes($indexDoc))
  $buildHash = ([BitConverter]::ToString($hashBytes).Replace('-', '').ToLowerInvariant()).Substring(0, 10)
  $sha.Dispose()
  $swTpl = [IO.File]::ReadAllText($swSrc, [Text.Encoding]::UTF8)
  [IO.File]::WriteAllText((Join-Path $root 'dist\sw.js'), $swTpl.Replace('__BUILD_HASH__', $buildHash), $utf8)
}
if (-not (Test-Path (Join-Path $root 'dist\icon-512.png'))) {
  & (Join-Path $PSScriptRoot 'make-pwa-assets.ps1') | Out-Null
}

# ---------------- report ----------------
$tierCount = @{}; foreach ($l in $links) { $tierCount[$l.tier] = 1 + [int]$tierCount[$l.tier] }
$inTree = @{}; foreach ($l in $links) { $inTree[$l.from.id] = 1; $inTree[$l.to.id] = 1 }
$noGenre = ($games | Where-Object { -not $_.genres.Count }).Count
$rep = @(
  "Built $(Get-Date -Format 'yyyy-MM-dd HH:mm')  ->  $Out ($([Math]::Round($html.Length/1KB)) KB, data $([Math]::Round($json.Length/1KB)) KB)",
  "Agent files: $($files.Count)  |  games: $($games.Count) (in family tree: $($inTree.Count), in catalog: $(($games | Where-Object { $_.inCat }).Count), new from agents: $agentGameCount)",
  "Links: $($links.Count)  |  " + (($TIERS | ForEach-Object { "$_=$([int]$tierCount[$_])" }) -join ' '),
  "Covers: $coverCount  |  YouTube IDs: $ytCount  |  MobyGames IDs: $mobyCount  |  Studios curated: $($studiosRaw.Count)",
  "Updates applied: $applied  |  games without genre: $noGenre  |  unresolved link ids: $($unresolved.Count)"
)
$rep | ForEach-Object { Write-Output $_ }
$top = $games | Sort-Object { - $_.inf } | Select-Object -First 12 | ForEach-Object { "$($_.title) ($($_.inf))" }
Write-Output ("Most influential: " + ($top -join ', '))
$logPath = Join-Path $root 'dist\build-log.txt'
$all = @($rep) + @('', 'Unresolved ids (count):') + @($unresolved.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "  $($_.Key) x$($_.Value)" }) + @('', 'Notes:') + @($log)
[IO.File]::WriteAllLines($logPath, [string[]]$all, $utf8)
Write-Output "Log: dist\build-log.txt ($($log.Count) notes, $($unresolved.Count) unresolved ids)"
