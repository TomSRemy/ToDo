<#
  Pont Excel pour Todo — à lancer sur l'ordinateur (Windows PowerShell 5.1, rien à installer).

  L'app Todo (https://tomsremy.github.io/ToDo/) envoie ses lignes ici, sur http://127.0.0.1:8765.
  Le pont les écrit dans les fichiers Excel du dossier synchronisé avec SharePoint, en passant par
  Excel lui-même : mise en forme, listes déroulantes et formules sont conservées. OneDrive synchronise ensuite.

  Règles d'écriture :
   - une ligne est retrouvée par sa clé (Pipe : Nom Producteur + Nom Centrale ; BDD : Nom_prod + Nom_Installation_prod) ;
     si elle existe elle est mise à jour, sinon elle est ajoutée à la fin du tableau ;
   - seules les valeurs non vides envoyées par l'app sont écrites (rien n'est effacé) ;
   - une cellule qui contient une formule n'est jamais écrasée.

  Lancement : double-clic sur « Lancer-pont-excel.bat ». Au premier lancement, choisir les deux fichiers Excel
  et recopier la clé affichée dans l'app (Réf. & data → Pont Excel).
  Options : -Reconfigurer (choisir à nouveau les fichiers), -Port 8765, -Mock (test sans Excel).
#>
param([int]$Port = 8765, [switch]$Reconfigurer, [switch]$Mock)

$ErrorActionPreference = 'Stop'
$Version = '1.0'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $Here 'pont-excel-config.json'
$AllowedOrigins = @('https://tomsremy.github.io', 'null', 'http://localhost:8000', 'http://127.0.0.1:8000')
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
function New-Token { -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ }) }
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
  $a.AddRow = { param($a) $null = $a.lo.ListRows.Add(); $a.lo.ListRows.Count }
  $a.ExcelRow = { param($a, $r) $a.lo.DataBodyRange.Row + $r - 1 }
  $a.Save = { param($a) $a.book.wb.Save() }
  $a.Close = { param($a) if ($a.book.opened) { $a.book.wb.Close($false) } }
  return $a
}
$script:mockTables = @{}
function New-MockAdapter($kind) {
  if (-not $script:mockTables.ContainsKey($kind)) {
    $n = if ($kind -eq 'pipe') { 37 } else { 91 }
    $h = @(); for ($i = 1; $i -le $n; $i++) { $h += "Col$i" }
    if ($kind -eq 'pipe') { $h[6] = 'Nom Producteur'; $h[19] = 'Nom Centrale' } else { $h[31] = 'Nom_prod'; $h[33] = 'Nom_Installation_prod'; $h[29] = 'Renouvellement' }
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
  $a.AddRow = { param($a) $null = $a.t.rows.Add((New-Object object[] $a.t.headers.Count)); $a.t.rows.Count }
  $a.ExcelRow = { param($a, $r) $r + 1 }
  $a.Save = { param($a) }
  $a.Close = { param($a) }
  return $a
}
function New-Adapter($kind) { if ($Mock) { return New-MockAdapter $kind } else { return New-ComAdapter $kind } }

# ---------------- Upsert ----------------
function Convert-Cell($v) {
  if ($null -eq $v) { return $null }
  if ($v -is [string]) { if ($v.Trim() -eq '') { return $null } return $v }
  if ($v -is [bool]) { return $v }
  if ($v -is [psobject] -and $v.PSObject.Properties['d']) { return [datetime]::ParseExact([string]$v.d, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture) }
  return [double]$v
}
function Upsert-Rows($kind, $rows) {
  $a = New-Adapter $kind
  try {
    $keyCols = @()
    foreach ($kh in $Kinds[$kind].keys) {
      $i = -1; for ($c = 0; $c -lt $a.Headers.Count; $c++) { if ((Norm $a.Headers[$c]) -eq (Norm $kh)) { $i = $c + 1; break } }
      if ($i -lt 0) { throw "Colonne « $kh » introuvable dans le tableau." }
      $keyCols += $i
    }
    $results = New-Object System.Collections.ArrayList
    foreach ($row in $rows) {
      $vals = @($row)
      # app rows start at sheet column A; table columns may start further right
      $off = $a.FirstCol - 1
      $keyVals = @(); foreach ($kc in $keyCols) { $keyVals += (Norm $vals[$kc + $off - 1]) }
      if (($keyVals | Where-Object { $_ -eq '' }).Count -gt 0) { [void]$results.Add(@{ ok = $false; message = 'Clé incomplète (producteur ou centrale vide) : ligne ignorée.' }); continue }
      $n = & $a.RowCount $a
      $cols = @(); foreach ($kc in $keyCols) { $cols += ,(& $a.Column $a $kc) }
      $target = 0; $lastFilled = 0
      for ($r = 1; $r -le $n; $r++) {
        $cur = @(); foreach ($col in $cols) { $cur += (Norm $col[$r]) }
        if (($cur | Where-Object { $_ -ne '' }).Count -gt 0) { $lastFilled = $r }
        if ((($cur -join '|') -eq ($keyVals -join '|'))) { $target = $r; break }
      }
      $action = 'mise à jour'
      if ($target -eq 0) {
        $action = 'ajoutée'
        # reuse an empty row left at the end of the table, else extend the table
        if ($lastFilled -lt $n) { $target = $lastFilled + 1 } else { $target = & $a.AddRow $a }
      }
      $written = 0
      for ($i = 0; $i -lt $vals.Count; $i++) {
        $c = $i + 1 - $off
        if ($c -lt 1 -or $c -gt $a.Headers.Count) { continue }
        $v = Convert-Cell $vals[$i]
        if ($null -eq $v) { continue }
        if (& $a.HasFormula $a $target $c) { continue }
        & $a.Set $a $target $c $v
        $written++
      }
      [void]$results.Add(@{ ok = $true; action = $action; row = (& $a.ExcelRow $a $target); cells = $written; key = (@($vals[$keyCols[0] + $off - 1], $vals[$keyCols[1] + $off - 1]) -join ' / ') })
      Write-Info ("$($Kinds[$kind].label) : ligne $action (" + (@($vals[$keyCols[0] + $off - 1], $vals[$keyCols[1] + $off - 1]) -join ' / ') + ')') 'Green'
    }
    & $a.Save $a
    return @{ ok = $true; results = $results }
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
