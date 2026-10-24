<#
  Pont Excel pour Todo — à lancer sur l'ordinateur (Windows PowerShell 5.1, rien à installer).

  L'app Todo (https://tomsremy.github.io/ToDo/) envoie ses lignes ici, sur http://127.0.0.1:8765.
  Le pont les écrit dans les fichiers Excel du dossier synchronisé avec SharePoint, en passant par
  Excel lui-même : mise en forme, listes déroulantes et formules sont conservées. OneDrive synchronise ensuite.

  Règles d'écriture (plusieurs personnes travaillent dans les mêmes fichiers) :
   - une ligne est retrouvée par sa clé (Pipe : Nom Producteur + Nom Centrale ; BDD : Nom_prod + Nom_Installation_prod) ;
   - une ligne close (Perdu, Abandonné, No Go, Résilié) n'est jamais modifiée : une nouvelle ligne est ajoutée.
     Si elle a été close il y a moins de 6 mois (date d'entrée de la ligne), l'app demande : nouvelle ligne ou reprendre ?
   - une ligne Gagné n'est mise à jour que pour la même affaire gagnée ; une nouvelle offre (renouvellement) a sa ligne ;
   - plusieurs lignes ouvertes avec la même clé (doublon) : rien n'est écrit, l'app demande laquelle ;
   - dans une ligne : une case vide est remplie ; une case qui contient encore ce que l'app y avait écrit est mise à jour ;
     une case changée par quelqu'un d'autre est gardée et signalée (l'app propose Garder / Remplacer / Fusionner pour
     les commentaires) ; rien n'est jamais vidé ; une cellule qui contient une formule n'est jamais écrasée ;
   - « Remplacer » n'agit que si la case contient toujours la valeur que tu as vue dans l'app ;
   - BDD : le code affaire (Ref_Watt.ee) départage les lignes d'une même centrale ; une ligne qui porte un autre code
     (autre contrat, saisi par quelqu'un d'autre) n'est jamais mise à jour sans ton accord ;
   - juste avant chaque écriture, la ligne est relue : si le tableau a bougé (tri, insertion par un collègue),
     rien n'est écrit sur cette ligne ;
   - une ligne n'est réutilisée que si elle est entièrement vide ;
   - avant la première écriture, une copie du fichier est gardée dans « Sauvegardes pont » (les 3 dernières),
     et chaque case écrite est notée dans « Sauvegardes pont/journal-pont.csv » avec son ancienne valeur (jamais effacé).

  Lancement : double-clic sur « Lancer-pont-excel.bat ». Au premier lancement, choisir les deux fichiers Excel
  et recopier la clé affichée dans l'app (Réf. & data → Pont Excel).
  Options : -Reconfigurer (choisir à nouveau les fichiers), -Port 8765, -Mock (test sans Excel).
#>
param([int]$Port = 8765, [switch]$Reconfigurer, [switch]$Mock)

$ErrorActionPreference = 'Stop'
$Version = '1.3'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $Here 'pont-excel-config.json'
# the app's addresses: GitHub Pages, and its own Cloudflare Pages address (an address given by hand: "origins" in pont-excel-config.json)
$AllowedOrigins = @('https://tomsremy.github.io', 'https://todo-tom.pages.dev', 'http://localhost:8000', 'http://127.0.0.1:8000')
if ($Mock) { $AllowedOrigins += 'null' }   # pages opened from a file, for tests only
$Kinds = @{
  pipe = @{ label = 'Pipe agrégation'; header = 'Nom Producteur'; keys = @('Nom Producteur', 'Nom Centrale'); sheet = 'Pipe agrégation' }
  bdd  = @{ label = 'BDD Agrégation'; header = 'Nom_prod'; keys = @('Nom_prod', 'Nom_Installation_prod'); sheet = 'BDD Agrégation' }
}

function Write-Info($msg, $color = 'Gray') { Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $msg) -ForegroundColor $color }
function Norm($s) {
  if ($null -eq $s) { return '' }
  $t = ([string]$s).Normalize([Text.NormalizationForm]::FormD)
  $t = -join ($t.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' })
  return ($t.ToLowerInvariant() -replace '[^a-z0-9]', '')
}

# ---------------- Configuration ----------------
function Pick-File($title) {
  Add-Type -AssemblyName System.Windows.Forms
  $d = New-Object System.Windows.Forms.OpenFileDialog
  $d.Title = $title; $d.Filter = 'Excel (*.xlsx;*.xlsm)|*.xlsx;*.xlsm'
  if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { return $d.FileName }
  return ''
}
function New-Token {   # 24 characters from the system's cryptographic generator
  $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ($b | ForEach-Object { 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[$_ % 57] })
}
function Load-Config {
  if (Test-Path $ConfigPath) { return (Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json) }
  return $null
}
$Config = Load-Config
if ($Mock -and -not $Config) { $Config = [pscustomobject]@{ pipe = 'mock-pipe.xlsx'; bdd = 'mock-suivi.xlsx'; token = 'mocktoken' } }
if (-not $Config -or $Reconfigurer) {
  Write-Host ''
  Write-Host 'Configuration du pont Excel' -ForegroundColor Cyan
  Write-Host '1/2 : choisis le fichier Excel du PIPE (dans le dossier synchronisé SharePoint/OneDrive).'
  $pipe = Pick-File 'Fichier Excel du Pipe agrégation'
  Write-Host '2/2 : choisis le fichier Excel du SUIVI AGRÉGATION (BDD).'
  $bdd = Pick-File 'Fichier Excel du Suivi Agrégation'
  $token = if ($Config -and $Config.token) { $Config.token } else { New-Token }
  $Config = [pscustomobject]@{ pipe = $pipe; bdd = $bdd; token = $token }
  ($Config | ConvertTo-Json) | Set-Content -Path $ConfigPath -Encoding UTF8
}
if ($Config.origins) { $AllowedOrigins += @($Config.origins | ForEach-Object { [string]$_ }) }

# ---------------- Table adapters (Excel via COM, or in-memory for -Mock) ----------------
# An adapter exposes: Headers (string[]), FirstCol (sheet column of the table's first column), RowCount,
# Get(r,c), HasFormula(r,c), Set(r,c,value), AddRow() -> new row index, ExcelRow(r), Save(), Close(), Sheets() for reading.
$script:xl = $null
function Get-Excel {
  if ($script:xl) { try { $null = $script:xl.Version; return $script:xl } catch { $script:xl = $null } }
  try { $script:xl = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application') }
  catch { $script:xl = New-Object -ComObject Excel.Application; $script:xl.Visible = $false; $script:xl.DisplayAlerts = $false }
  return $script:xl
}
function Open-Book($path) {
  if (-not (Test-Path $path)) { throw "Fichier introuvable : $path" }
  $xl = Get-Excel
  $name = [IO.Path]::GetFileName($path)
  # A file of a synced folder that is open in Excel reports its SharePoint URL as FullName: match on the name too.
  foreach ($wb in $xl.Workbooks) { if ($wb.FullName -eq $path -or $wb.Name -eq $name) { return @{ wb = $wb; opened = $false } } }
  return @{ wb = $xl.Workbooks.Open($path); opened = $true }
}
function Find-Table($wb, $kind) {
  $k = $Kinds[$kind]
  foreach ($ws in $wb.Worksheets) {
    foreach ($lo in $ws.ListObjects) {
      $h = $lo.HeaderRowRange.Value2
      for ($c = 1; $c -le $lo.ListColumns.Count; $c++) { if ((Norm $h[1, $c]) -eq (Norm $k.header)) { return $lo } }
    }
  }
  throw ("Tableau « " + $k.label + " » introuvable (colonne « " + $k.header + " »).")
}
function New-ComAdapter($kind) {
  $path = $Config.$kind
  $book = Open-Book $path
  $lo = Find-Table $book.wb $kind
  $hdr = $lo.HeaderRowRange.Value2
  $headers = @(); for ($c = 1; $c -le $lo.ListColumns.Count; $c++) { $headers += [string]$hdr[1, $c] }
  $a = @{ kind = $kind; book = $book; lo = $lo; Headers = $headers; FirstCol = $lo.Range.Column }
  $a.RowCount = { param($a) $a.lo.ListRows.Count }
  $a.Cell = { param($a, $r, $c) $a.lo.DataBodyRange.Cells.Item($r, $c) }
  $a.Get = { param($a, $r, $c) (& $a.Cell $a $r $c).Value2 }
  $a.Column = { param($a, $c) $n = $a.lo.ListRows.Count; $out = New-Object object[] ($n + 1); if ($n -gt 0) { $v = $a.lo.ListColumns.Item($c).DataBodyRange.Value2; if ($n -eq 1) { $out[1] = $v } else { for ($r = 1; $r -le $n; $r++) { $out[$r] = $v[$r, 1] } } }; ,$out }
  $a.HasFormula = { param($a, $r, $c) [bool](& $a.Cell $a $r $c).HasFormula }
  $a.Set = { param($a, $r, $c, $v) $cell = (& $a.Cell $a $r $c); if ($v -is [datetime]) { $cell.Value = $v } else { $cell.Value2 = $v } }
  $a.BeforeWrite = { param($a) }
  $a.AddRow = { param($a) $null = $a.lo.ListRows.Add(); $a.lo.ListRows.Count }
  $a.ExcelRow = { param($a, $r) $a.lo.DataBodyRange.Row + $r - 1 }
  $a.RowEmpty = { param($a, $r) $v = $a.lo.ListRows.Item($r).Range.Value2; if ($v -is [array]) { foreach ($x in $v) { if (-not (Is-Blank $x)) { return $false } }; return $true }; return (Is-Blank $v) }
  $a.WasClosed = [bool]$book.opened
  $a.Backup = { param($a, $dir, $stamp) $n = [IO.Path]::GetFileNameWithoutExtension($a.book.wb.Name); $e = [IO.Path]::GetExtension($a.book.wb.Name); $p = Join-Path $dir ($n + "-" + $stamp + $e); $a.book.wb.SaveCopyAs($p); $p }
  $a.BackupPattern = { param($a) [IO.Path]::GetFileNameWithoutExtension($a.book.wb.Name) + "-*" + [IO.Path]::GetExtension($a.book.wb.Name) }
  $a.Save = { param($a) $a.book.wb.Save() }
  $a.Close = { param($a) if ($a.book.opened) { $a.book.wb.Close($false) } }
  return $a
}
$script:mockTables = @{}
function New-MockAdapter($kind) {
  if (-not $script:mockTables.ContainsKey($kind)) {
    $n = if ($kind -eq 'pipe') { 37 } else { 91 }
    $h = @(); for ($i = 1; $i -le $n; $i++) { $h += "Col$i" }
    if ($kind -eq 'pipe') { $h[6] = 'Nom Producteur'; $h[19] = 'Nom Centrale' } else { $h[31] = 'Nom_prod'; $h[33] = 'Nom_Installation_prod'; $h[29] = 'Renouvellement'; $h[7] = 'Ref_Watt.ee' }
    $script:mockTables[$kind] = @{ headers = $h; rows = New-Object System.Collections.ArrayList; formulas = @{} }
    if ($kind -eq 'bdd') { $script:mockTables[$kind].formulas[30] = $true }   # column AD holds a formula
  }
  $t = $script:mockTables[$kind]
  $a = @{ kind = $kind; t = $t; Headers = $t.headers; FirstCol = 1 }
  $a.RowCount = { param($a) $a.t.rows.Count }
  $a.Get = { param($a, $r, $c) $a.t.rows[$r - 1][$c - 1] }
  $a.Column = { param($a, $c) $n = $a.t.rows.Count; $out = New-Object object[] ($n + 1); for ($r = 1; $r -le $n; $r++) { $out[$r] = $a.t.rows[$r - 1][$c - 1] }; ,$out }
  $a.HasFormula = { param($a, $r, $c) [bool]$a.t.formulas[$c] }
  $a.Set = { param($a, $r, $c, $v) $a.t.rows[$r - 1][$c - 1] = $v }
  # test only: a colleague inserts a line at the top just before the bridge writes
  $a.BeforeWrite = { param($a) if ($a.t.shiftOnWrite) { $a.t.shiftOnWrite = $false; $a.t.rows.Insert(0, (New-Object object[] $a.t.headers.Count)) } }
  $a.AddRow = { param($a) $null = $a.t.rows.Add((New-Object object[] $a.t.headers.Count)); $a.t.rows.Count }
  $a.ExcelRow = { param($a, $r) $r + 1 }
  $a.RowEmpty = { param($a, $r) foreach ($v in $a.t.rows[$r - 1]) { if (-not (Is-Blank $v)) { return $false } }; return $true }
  $a.WasClosed = [bool]$t.closed
  $a.Backup = { param($a, $dir, $stamp) $p = Join-Path $dir ("mock-" + $a.kind + "-" + $stamp + ".json"); (ConvertTo-Json -InputObject @($a.t.rows) -Depth 4 -Compress) | Set-Content -Path $p -Encoding UTF8; $p }
  $a.BackupPattern = { param($a) "mock-" + $a.kind + "-*.json" }
  $a.Save = { param($a) }
  $a.Close = { param($a) }
  return $a
}
function New-Adapter($kind) { if ($Mock) { return New-MockAdapter $kind } else { return New-ComAdapter $kind } }

# ---------------- Upsert ----------------
$ClosedStatus = @('perdu', 'abandonne', 'nogo', 'resilie')
$RecentDays = 183
$BackupDir = Join-Path $Here 'Sauvegardes pont'
$KeepBackups = 3
function Is-Blank($v) { return ($null -eq $v -or ([string]$v).Trim() -eq '') }
function Convert-Cell($v) {
  if ($null -eq $v) { return $null }
  if ($v -is [string]) { if ($v.Trim() -eq '') { return $null } return $v }
  if ($v -is [bool]) { return $v }
  if ($v -is [psobject] -and $v.PSObject.Properties['d']) { return [datetime]::ParseExact([string]$v.d, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture) }
  return [double]$v
}
function To-Date($v) {
  if ($null -eq $v) { return $null }
  if ($v -is [datetime]) { return $v }
  if ($v -is [double] -or $v -is [int]) { if ($v -gt 1900 -and $v -lt 2200) { return (Get-Date -Year ([int]$v) -Month 7 -Day 1).Date }; try { return [DateTime]::FromOADate([double]$v) } catch { return $null } }
  $s = ([string]$v).Trim(); $d = [datetime]::MinValue
  if ([datetime]::TryParseExact($s, [string[]]@('dd/MM/yyyy', 'd/M/yyyy', 'yyyy-MM-dd'), [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$d)) { return $d }
  if ($s -match '^\d{4}$') { return (Get-Date -Year ([int]$s) -Month 7 -Day 1).Date }
  return $null
}
function Same-Value($excel, $v) {
  if (Is-Blank $v) { return (Is-Blank $excel) }
  if (Is-Blank $excel) { return $false }
  if ($v -is [datetime]) { $e = To-Date $excel; return ($null -ne $e -and $e.Date -eq $v.Date) }
  if ($v -is [double]) { try { return ([math]::Abs([double]$excel - $v) -lt 1e-6) } catch { return $false } }
  if ($v -is [bool]) { return ([string]$excel).Trim().ToLowerInvariant() -eq ([string]$v).ToLowerInvariant() }
  if (($excel -is [double] -or $excel -is [datetime]) -and $v -is [string]) {
    # a value kept earlier comes back as text: compare it as a date, else as a number
    $dv = To-Date $v; $de = To-Date $excel
    if ($null -ne $dv -and $null -ne $de -and $v -match '/|-') { return ($dv.Date -eq $de.Date) }
    $num = 0.0; if ([double]::TryParse($v.Replace(',', '.'), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$num) -and $excel -is [double]) { return ([math]::Abs($excel - $num) -lt 1e-6) }
  }
  return ([string]$excel).Trim() -eq ([string]$v).Trim()
}
function Show-Value($v) {
  if (Is-Blank $v) { return '' }
  if ($v -is [datetime]) { return $v.ToString('dd/MM/yyyy') }
  return ([string]$v)
}
function Find-Col($a, [string[]]$exact, [string[]]$prefix, [string[]]$contains) {
  for ($c = 0; $c -lt $a.Headers.Count; $c++) { $h = Norm $a.Headers[$c]; if ($exact -contains $h) { return $c + 1 } }
  for ($c = 0; $c -lt $a.Headers.Count; $c++) { $h = Norm $a.Headers[$c]; foreach ($p in $prefix) { if ($p -and $h.StartsWith($p)) { return $c + 1 } } }
  for ($c = 0; $c -lt $a.Headers.Count; $c++) { $h = Norm $a.Headers[$c]; foreach ($p in $contains) { if ($p -and $h.Contains($p)) { return $c + 1 } } }
  return 0
}
function Is-CommentCol($a, $c) { $h = Norm $a.Headers[$c - 1]; return ($h -match 'comment|remarque|observation|particularit') }
function Get-Prop($o, $name) { if ($null -eq $o) { return $null }; $p = $o.PSObject.Properties[[string]$name]; if ($p) { return $p.Value }; return $null }
function Ensure-Backup($a, $state) {
  if ($state.backup) { return }
  if (-not (Test-Path $BackupDir)) { $null = New-Item -ItemType Directory -Path $BackupDir }
  $state.backup = [IO.Path]::GetFileName((& $a.Backup $a $BackupDir (Get-Date -Format 'yyyyMMdd-HHmmss')))
  Get-ChildItem -Path $BackupDir -Filter (& $a.BackupPattern $a) | Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepBackups | Remove-Item -Force -ErrorAction SilentlyContinue
}
$JournalPath = Join-Path $BackupDir 'journal-pont.csv'
function Csv-Field($v) { '"' + ((Show-Value $v) -replace '"', '""' -replace "`r?`n", ' / ') + '"' }
function Write-Journal($a, $kind, $r, $c, $key, $old, $new, $why) {
  if (-not (Test-Path $BackupDir)) { $null = New-Item -ItemType Directory -Path $BackupDir }
  if (-not (Test-Path $JournalPath)) { [IO.File]::WriteAllText($JournalPath, "Date;Fichier;Ligne;Colonne;Centrale;Ancienne valeur;Nouvelle valeur;Pourquoi`r`n", (New-Object Text.UTF8Encoding $true)) }
  $line = (@((Get-Date -Format 'dd/MM/yyyy HH:mm:ss'), $Kinds[$kind].label, (& $a.ExcelRow $a $r), $a.Headers[$c - 1], $key, $old, $new, $why) | ForEach-Object { Csv-Field $_ }) -join ';'
  [IO.File]::AppendAllText($JournalPath, $line + "`r`n", (New-Object Text.UTF8Encoding $true))
}
# the row still holds this plant (and, when given, this business code): checked again right before writing
function Row-Still($a, $r, $keyCols, $keyVals) {
  if ($r -lt 1 -or $r -gt (& $a.RowCount $a)) { return $false }
  for ($j = 0; $j -lt $keyCols.Count; $j++) { if ((Norm (& $a.Get $a $r $keyCols[$j])) -ne $keyVals[$j]) { return $false } }
  return $true
}
function Upsert-Rows($kind, $rows) {
  $a = New-Adapter $kind
  $state = @{ backup = $null }
  try {
    $keyCols = @()
    foreach ($kh in $Kinds[$kind].keys) {
      $i = -1; for ($c = 0; $c -lt $a.Headers.Count; $c++) { if ((Norm $a.Headers[$c]) -eq (Norm $kh)) { $i = $c + 1; break } }
      if ($i -lt 0) { throw "Colonne « $kh » introuvable dans le tableau." }
      $keyCols += $i
    }
    $statusCol = if ($kind -eq 'pipe') { Find-Col $a @('stade', 'stadepipe', 'statut') @('stade') @() } else { Find-Col $a @('statut') @('statut') @() }
    $dateCol = Find-Col $a @() @('dateentree', 'datedentree', 'dateentre') @('entree')
    if ($dateCol -eq 0) { $dateCol = Find-Col $a @('annee') @() @() }
    # BDD: business code (Ref_Watt.ee), a second key that tells two contracts of the same plant apart
    $codeCol = if ($kind -eq 'bdd') { Find-Col $a @('refwattee', 'codeaffaire', 'refwatee') @('refwatt', 'codeaffaire') @() } else { 0 }
    $off = $a.FirstCol - 1
    $results = New-Object System.Collections.ArrayList
    foreach ($row in $rows) {
      # a row is either the plain list of values (older app) or { values, prev, keep, won, force, target }
      $isObj = ($row -isnot [array]) -and ($null -ne $row) -and ($row.PSObject.Properties['values'])
      $vals = if ($isObj) { @($row.values) } else { @($row) }
      $prev = if ($isObj -and $row.prev) { @($row.prev) } else { @() }
      $keep = if ($isObj) { $row.keep } else { $null }
      $force = if ($isObj) { $row.force } else { $null }
      $seen = if ($isObj) { $row.seen } else { $null }
      $won = $isObj -and [bool]$row.won
      $target0 = if ($isObj) { $row.target } else { $null }
      $keyVals = @(); foreach ($kc in $keyCols) { $keyVals += (Norm $vals[$kc + $off - 1]) }
      $keyText = (@($vals[$keyCols[0] + $off - 1], $vals[$keyCols[1] + $off - 1]) -join ' / ')
      $newCode = if ($codeCol) { Norm $vals[$codeCol + $off - 1] } else { '' }
      $prevCode = if ($codeCol -and ($codeCol + $off - 1) -lt $prev.Count) { Norm $prev[$codeCol + $off - 1] } else { '' }
      # a row's code is « ours » when empty, the code sent now, or the code the app wrote there last time
      $codeOk = { param($r) if (-not $codeCol) { return $true }; $rc = Norm (& $a.Get $a $r $codeCol); return ($rc -eq '' -or $rc -eq $newCode -or ($prevCode -ne '' -and $rc -eq $prevCode)) }
      if (($keyVals | Where-Object { $_ -eq '' }).Count -gt 0) { [void]$results.Add(@{ ok = $false; key = $keyText; message = 'Clé incomplète (producteur ou centrale vide) : ligne ignorée.' }); continue }
      $n = & $a.RowCount $a
      $cols = @(); foreach ($kc in $keyCols) { $cols += ,(& $a.Column $a $kc) }
      $found = @()
      for ($r = 1; $r -le $n; $r++) {
        $cur = @(); foreach ($col in $cols) { $cur += (Norm $col[$r]) }
        if ((($cur -join '|') -eq ($keyVals -join '|'))) { $found += $r }
      }
      $info = { param($r) $st = if ($statusCol) { & $a.Get $a $r $statusCol } else { $null }; $dt = if ($dateCol) { To-Date (& $a.Get $a $r $dateCol) } else { $null }
        @{ row = (& $a.ExcelRow $a $r); statut = (Show-Value $st); date = $(if ($dt) { $dt.ToString('dd/MM/yyyy') } else { '' }); closed = ($ClosedStatus -contains (Norm $st)); won = ((Norm $st) -eq 'gagne'); dt = $dt; r = $r;
           code = $(if ($codeCol) { Show-Value (& $a.Get $a $r $codeCol) } else { '' }); codeOk = (& $codeOk $r) } }
      $target = 0; $isNew = $false; $note = ''; $question = $null
      if ($target0) {
        if ([string]$target0 -eq 'new') { $isNew = $true; $note = 'Nouvelle ligne, comme demandé.' }
        else {
          $want = [int]$target0
          foreach ($r in $found) { if ((& $a.ExcelRow $a $r) -eq $want) { $target = $r } }
          if (-not $target) { [void]$results.Add(@{ ok = $false; key = $keyText; message = "La ligne $want ne correspond plus à cette centrale (le tableau a changé) : renvoie l'affaire." }); continue }
        }
      } else {
        $infos = @(); foreach ($r in $found) { $infos += (& $info $r) }
        $usable = @($infos | Where-Object { -not $_.closed -and (-not $_.won -or $won) })
        # several open lines: the one with this business code wins
        if ($usable.Count -gt 1 -and $newCode -ne '') { $same = @($usable | Where-Object { $_.code -ne '' -and $_.codeOk }); if ($same.Count -eq 1) { $usable = $same } }
        if ($usable.Count -gt 1) {
          $question = @{ type = 'duplicate'; rows = @($usable | ForEach-Object { @{ row = $_.row; statut = $_.statut; date = $_.date; code = $_.code } }) }
        } elseif ($usable.Count -eq 1 -and -not $usable[0].codeOk) {
          # the only open line carries another business code (another contract, written by someone else): ask
          $question = @{ type = 'other-contract'; code = (Show-Value $vals[$codeCol + $off - 1]); rows = @($usable | ForEach-Object { @{ row = $_.row; statut = $_.statut; date = $_.date; code = $_.code } }) }
        } elseif ($usable.Count -eq 1) {
          $target = $usable[0].r
        } else {
          $recent = @($infos | Where-Object { $_.closed -and ($null -eq $_.dt -or ((Get-Date) - $_.dt).TotalDays -lt $RecentDays) })
          if ($recent.Count -gt 0) {
            $question = @{ type = 'recent-closed'; rows = @($recent | ForEach-Object { @{ row = $_.row; statut = $_.statut; date = $_.date } }) }
          } else {
            $isNew = $true
            $closedOld = @($infos | Where-Object { $_.closed }); $wonRows = @($infos | Where-Object { $_.won })
            if ($wonRows.Count) { $note = 'Contrat gagné conservé (ligne ' + $wonRows[0].row + ') ; nouvelle ligne pour la nouvelle offre.' }
            elseif ($closedOld.Count) { $note = 'Ancienne ligne ' + $closedOld[0].statut.ToLowerInvariant() + ' conservée (ligne ' + $closedOld[0].row + $(if ($closedOld[0].date) { ', ' + $closedOld[0].date } else { '' }) + ') ; nouvelle ligne.' }
          }
        }
      }
      if ($question) {
        [void]$results.Add(@{ ok = $true; action = 'en attente'; key = $keyText; question = $question; cells = 0; written = @(); mine = @(); conflicts = @() })
        Write-Info ("$($Kinds[$kind].label) : question posée (" + $keyText + ')') 'Yellow'
        continue
      }
      $action = 'mise à jour'
      if ($isNew) {
        $action = 'ajoutée'
        # reuse a completely empty row at the end of the table, else extend the table
        $n = & $a.RowCount $a
        if ($n -ge 1 -and (& $a.RowEmpty $a $n)) {
          $first = $n; while ($first -gt 1 -and (& $a.RowEmpty $a ($first - 1))) { $first-- }
          $target = $first
        } else { Ensure-Backup $a $state; $target = & $a.AddRow $a }
      }
      $written = New-Object System.Collections.ArrayList; $mine = New-Object System.Collections.ArrayList; $conflicts = New-Object System.Collections.ArrayList
      $rowCodeOk = $isNew -or (& $codeOk $target)
      $moved = $false
      $order = @(); foreach ($kc in $keyCols) { $order += ($kc + $off - 1) }; for ($x = 0; $x -lt $vals.Count; $x++) { if ($order -notcontains $x) { $order += $x } }
      foreach ($i in $order) {
        $c = $i + 1 - $off
        if ($c -lt 1 -or $c -gt $a.Headers.Count) { continue }
        $v = Convert-Cell $vals[$i]
        if ($null -eq $v) { continue }
        if (& $a.HasFormula $a $target $c) { continue }
        $e = & $a.Get $a $target $c
        $toWrite = $null
        if (Is-Blank $e) { $toWrite = $v }
        elseif (Same-Value $e $v) { [void]$mine.Add($i); continue }
        else {
          $f = [string](Get-Prop $force $i)
          $k = Get-Prop $keep $i
          $p = if ($i -lt $prev.Count) { Convert-Cell $prev[$i] } else { $null }
          $sv = Get-Prop $seen $i
          $stillSeen = ($null -eq $sv) -or (Same-Value $e (Convert-Cell $sv))   # « Remplacer » only replaces the value the user saw
          if ($f -eq 'replace' -and $stillSeen) { $toWrite = $v }
          elseif ($f -eq 'merge' -and $stillSeen -and (Is-CommentCol $a $c)) { $es = Show-Value $e; $vs = Show-Value $v; $toWrite = $(if ($es.Contains($vs)) { $es } else { $es + "`n" + $vs + ' (' + (Get-Date -Format 'dd/MM/yyyy') + ')' }) }
          elseif ($null -ne $k -and (Same-Value $e (Convert-Cell $k))) { continue }   # already chosen: keep the Excel value
          elseif ($rowCodeOk -and $null -ne $p -and (Same-Value $e $p)) { $toWrite = $v }   # still what the app wrote last time (on a line of this contract)
          else { [void]$conflicts.Add(@{ i = $i; header = $a.Headers[$c - 1]; excel = (Show-Value $e); app = (Show-Value $v); comment = (Is-CommentCol $a $c) }); continue }
        }
        Ensure-Backup $a $state
        & $a.BeforeWrite $a
        # read the line again: a colleague may have sorted or inserted lines since it was found
        if ($isNew) {
          # a new line: still empty before the first cell, then still holding the cells written so far
          if ($written.Count -eq 0) { if (-not (& $a.RowEmpty $a $target)) { $moved = $true; break } }
          else { foreach ($w in $written) { if (-not (Same-Value (& $a.Get $a $target ($w + 1 - $off)) (Convert-Cell $vals[$w]))) { $moved = $true } }; if ($moved) { break } }
        } elseif (-not (Row-Still $a $target $keyCols $keyVals)) { $moved = $true; break }
        $old = & $a.Get $a $target $c
        if (-not (Same-Value $old $e)) { $moved = $true; break }   # the cell changed under our feet
        & $a.Set $a $target $c $toWrite
        Write-Journal $a $kind $target $c $keyText $old $toWrite $(if (Is-Blank $old) { 'case vide remplie' } elseif ($f -eq 'replace') { 'Remplacer (choisi dans l''app)' } elseif ($f -eq 'merge') { 'Fusionner (choisi dans l''app)' } else { 'valeur écrite par l''app, inchangée depuis' })
        [void]$written.Add($i); [void]$mine.Add($i)
      }
      if ($moved) {
        [void]$results.Add(@{ ok = $false; key = $keyText; message = $(if ($written.Count) { "Le tableau a bougé pendant l'écriture (tri ou insertion par un collègue) : arrêt après " + $written.Count + " case(s), notées dans le journal. Renvoie l'affaire." } else { "Le tableau a bougé (tri ou insertion par un collègue) : rien n'a été écrit sur cette ligne. Renvoie l'affaire." }); written = @($written); mine = @($mine) })
        Write-Info ("$($Kinds[$kind].label) : tableau modifié pendant l'envoi, ligne arrêtée (" + $keyText + ')') 'Yellow'
        continue
      }
      if (-not $isNew -and $written.Count -eq 0 -and $conflicts.Count -eq 0) { $action = 'aucun changement' }
      [void]$results.Add(@{ ok = $true; action = $action; row = (& $a.ExcelRow $a $target); cells = $written.Count; key = $keyText; note = $note; written = @($written); mine = @($mine); conflicts = @($conflicts) })
      Write-Info ("$($Kinds[$kind].label) : ligne $action (" + $keyText + ')' + $(if ($conflicts.Count) { ' — ' + $conflicts.Count + ' case(s) gardée(s)' } else { '' })) 'Green'
    }
    if ($state.backup) { & $a.Save $a }
    return @{ ok = $true; results = $results; backup = $state.backup; fileWasClosed = [bool]$a.WasClosed }
  } finally { & $a.Close $a }
}

# ---------------- Reading (Parc) ----------------
function Read-Sheets($kind) {
  $out = @{}
  if ($Mock) {
    $t = (New-MockAdapter $kind).t
    $rows = New-Object System.Collections.ArrayList
    [void]$rows.Add([object[]]$t.headers)
    foreach ($r in $t.rows) { [void]$rows.Add([object[]]$r) }
    $out[$Kinds[$kind].sheet] = $rows
    return $out
  }
  $book = Open-Book $Config.$kind
  try {
    foreach ($ws in $book.wb.Worksheets) {
      if ($ws.Name -notmatch 'BDD|Dashboard|Pipe') { continue }
      $v = $ws.UsedRange.Value2
      $rows = New-Object System.Collections.ArrayList
      if ($v -is [array]) {
        $nr = $v.GetLength(0); $nc = $v.GetLength(1)
        for ($r = 1; $r -le $nr; $r++) { $line = New-Object object[] $nc; for ($c = 1; $c -le $nc; $c++) { $line[$c - 1] = $v[$r, $c] }; [void]$rows.Add($line) }
      }
      $out[$ws.Name] = $rows
    }
  } finally { if ($book.opened) { $book.wb.Close($false) } }
  return $out
}

# ---------------- Minimal HTTP server on 127.0.0.1 (no admin rights needed) ----------------
function Send-Response($stream, $status, $obj, $origin) {
  $json = if ($null -ne $obj) { ConvertTo-Json -InputObject $obj -Depth 8 -Compress } else { '' }
  $body = [Text.Encoding]::UTF8.GetBytes($json)
  $reason = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 401 = 'Unauthorized'; 403 = 'Forbidden'; 404 = 'Not Found'; 500 = 'Internal Server Error' }[$status]
  $h = "HTTP/1.1 $status $reason`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n"
  if ($origin -and ($AllowedOrigins -contains $origin)) {
    $h += "Access-Control-Allow-Origin: $origin`r`nVary: Origin`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type, X-Bridge-Token`r`nAccess-Control-Allow-Private-Network: true`r`nAccess-Control-Max-Age: 600`r`n"
  }
  $head = [Text.Encoding]::ASCII.GetBytes($h + "`r`n")
  $stream.Write($head, 0, $head.Length)
  if ($body.Length) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}
function Read-Request($stream) {
  $buf = New-Object byte[] 65536; $ms = New-Object IO.MemoryStream; $headerEnd = -1
  while ($headerEnd -lt 0) {
    $n = $stream.Read($buf, 0, $buf.Length); if ($n -le 0) { return $null }
    $ms.Write($buf, 0, $n)
    $all = $ms.ToArray()
    for ($i = [Math]::Max(0, $all.Length - $n - 3); $i -le $all.Length - 4; $i++) { if ($all[$i] -eq 13 -and $all[$i + 1] -eq 10 -and $all[$i + 2] -eq 13 -and $all[$i + 3] -eq 10) { $headerEnd = $i; break } }
    if ($ms.Length -gt 1MB) { return $null }
  }
  $all = $ms.ToArray()
  $lines = [Text.Encoding]::ASCII.GetString($all, 0, $headerEnd) -split "`r`n"
  $parts = $lines[0] -split ' '
  $headers = @{}; foreach ($l in ($lines | Select-Object -Skip 1)) { $j = $l.IndexOf(':'); if ($j -gt 0) { $headers[$l.Substring(0, $j).Trim().ToLowerInvariant()] = $l.Substring($j + 1).Trim() } }
  $len = 0; if ($headers['content-length']) { $len = [int]$headers['content-length'] }
  if ($len -gt 5MB) { return $null }
  $bodyStart = $headerEnd + 4
  $bodyMs = New-Object IO.MemoryStream
  if ($all.Length -gt $bodyStart) { $bodyMs.Write($all, $bodyStart, $all.Length - $bodyStart) }
  while ($bodyMs.Length -lt $len) { $n = $stream.Read($buf, 0, $buf.Length); if ($n -le 0) { break }; $bodyMs.Write($buf, 0, $n) }
  return @{ method = $parts[0]; path = ($parts[1] -split '\?')[0]; headers = $headers; body = [Text.Encoding]::UTF8.GetString($bodyMs.ToArray()) }
}
function Handle($req) {
  $origin = $req.headers['origin']
  if ($origin -and -not ($AllowedOrigins -contains $origin)) { return @(403, @{ ok = $false; message = 'Origine non autorisée.' }) }
  if ($req.method -eq 'OPTIONS') { return @(204, $null) }
  $authorized = ($req.headers['x-bridge-token'] -eq $Config.token)
  if ($req.path -eq '/status') {
    return @(200, @{ ok = $true; version = $Version; authorized = $authorized; mock = [bool]$Mock;
        pipe = @{ name = [IO.Path]::GetFileName([string]$Config.pipe); found = ($Mock -or (Test-Path ([string]$Config.pipe))) };
        bdd = @{ name = [IO.Path]::GetFileName([string]$Config.bdd); found = ($Mock -or (Test-Path ([string]$Config.bdd))) } })
  }
  if (-not $authorized) { return @(401, @{ ok = $false; message = 'Clé du pont incorrecte : recopie la clé affichée dans la fenêtre du pont.' }) }
  if ($req.method -eq 'POST' -and $req.path -match '^/(pipe|bdd)/upsert$') {
    $kind = $Matches[1]
    $data = $req.body | ConvertFrom-Json
    return @(200, (Upsert-Rows $kind @($data.rows)))
  }
  if ($Mock -and $req.method -eq 'POST' -and $req.path -match '^/mock/seed/(pipe|bdd)$') {
    $kind = $Matches[1]; $data = $req.body | ConvertFrom-Json
    $null = New-MockAdapter $kind
    $t = $script:mockTables[$kind]
    if ($data.headers) { $t.headers = @($data.headers | ForEach-Object { [string]$_ }) }
    $t.rows = New-Object System.Collections.ArrayList
    foreach ($r in @($data.rows)) { $line = New-Object object[] $t.headers.Count; $vals = @($r); for ($i = 0; $i -lt $vals.Count -and $i -lt $line.Count; $i++) { $line[$i] = $vals[$i] }; [void]$t.rows.Add($line) }
    $t.formulas = @{}; foreach ($f in @($data.formulas)) { if ($null -ne $f) { $t.formulas[[int]$f] = $true } }
    $t.closed = [bool]$data.closed
    $t.shiftOnWrite = [bool]$data.shiftOnWrite
    return @(200, @{ ok = $true })
  }
  if ($Mock -and $req.method -eq 'GET' -and $req.path -match '^/mock/dump/(pipe|bdd)$') {
    $t = $script:mockTables[$Matches[1]]
    return @(200, @{ ok = $true; headers = $t.headers; rows = @($t.rows | ForEach-Object { ,@($_ | ForEach-Object { Show-Value $_ }) }) })
  }
  if ($req.method -eq 'GET' -and $req.path -match '^/(pipe|bdd)/read$') {
    return @(200, @{ ok = $true; sheets = (Read-Sheets $Matches[1]) })
  }
  return @(404, @{ ok = $false; message = 'Route inconnue.' })
}

$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
try { $listener.Start() } catch { Write-Info "Le port $Port est déjà utilisé : le pont tourne peut-être déjà dans une autre fenêtre." 'Red'; exit 1 }
Write-Host ''
Write-Host "Pont Excel pour Todo v$Version — http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host ('  Pipe : ' + $Config.pipe)
Write-Host ('  BDD  : ' + $Config.bdd)
Write-Host ('  Clé à recopier dans l''app (Réf. & data → Pont Excel) : ' + $Config.token) -ForegroundColor Yellow
Write-Host '  Laisse cette fenêtre ouverte (tu peux la réduire). Ctrl+C pour arrêter.'
Write-Host ''
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 10000
    $stream = $client.GetStream()
    $req = Read-Request $stream
    if ($null -eq $req) { continue }
    $origin = $req.headers['origin']
    try { $res = Handle $req }
    catch {
      $msg = $_.Exception.Message
      if ($msg -match '0x800AC472|0x8001010A|RPC_E_CALL_REJECTED') { $msg = 'Excel est occupé (une cellule est peut-être en cours de saisie) : termine la saisie puis réessaie.' }
      Write-Info ("Erreur : " + $msg) 'Red'
      $res = @(500, @{ ok = $false; message = $msg })
    }
    Send-Response $stream $res[0] $res[1] $origin
  } catch { Write-Info ("Connexion interrompue : " + $_.Exception.Message) 'DarkGray' }
  finally { $client.Close() }
}
