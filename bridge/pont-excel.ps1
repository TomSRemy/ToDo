<#
  Pont Excel pour Todo — à lancer sur l'ordinateur (Windows PowerShell 5.1, rien à installer).

  L'app Todo (https://tomsremy.github.io/ToDo/) envoie ses lignes ici, sur http://127.0.0.1:8765.
  Le pont écrit dans les fichiers Excel du dossier synchronisé avec SharePoint. Si quelqu'un a déjà le
  fichier ouvert (toi ou un collègue), le pont écrit dans cette session Excel même, en direct, pour que
  sa prochaine sauvegarde inclue ces changements. Sinon, il écrit le fichier lui-même (sans ouvrir Excel,
  via EPPlus, téléchargé une fois au premier lancement) : plus robuste, mais une toute nouvelle ligne n'est
  pas encore gérée par ce chemin — ouvre le fichier toi-même dans ce cas, et le pont repasse par Excel.
  Dans les deux cas : mise en forme, listes déroulantes et formules sont conservées. OneDrive synchronise ensuite.

  Règles d'écriture (plusieurs personnes travaillent dans les mêmes fichiers) :
   - le pont n'écrit que dans l'onglet « Pipe agrégation » du Pipe et « BDD Agrégation » du Suivi, jamais ailleurs ;
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
   - avant la première écriture du jour, une copie du fichier est gardée dans « Sauvegardes pont » (une par jour,
     les 3 derniers jours, même si le pont est utilisé plusieurs fois le même jour) ;
     et chaque case écrite est notée dans « Sauvegardes pont/journal-pont.csv » avec son ancienne valeur (jamais effacé).

  Lancement : double-clic sur « Lancer-pont-excel.bat ». Au premier lancement, choisir les deux fichiers Excel
  et recopier la clé affichée dans l'app (Réglages → Pont Excel).
  Options : -Reconfigurer (choisir à nouveau les fichiers), -Port 8765, -Mock (test sans Excel).
#>
param([int]$Port = 8765, [switch]$Reconfigurer, [switch]$Mock)

$ErrorActionPreference = 'Stop'
$Version = '1.23'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$LibDir = Join-Path $Here 'lib'
# the settings (the two files, the key) live in the Windows profile, not next to the script: a new download, in any folder,
# finds them again (no new key to copy into the app). An older settings file next to the script is taken over once.
$LegacyConfig = Join-Path $Here 'pont-excel-config.json'
$ConfigPath = $LegacyConfig
if (-not $Mock -and $env:APPDATA) {
  $cfgDir = Join-Path $env:APPDATA 'Todo Pont Excel'
  if (-not (Test-Path $cfgDir)) { $null = New-Item -ItemType Directory -Path $cfgDir }
  $ConfigPath = Join-Path $cfgDir 'pont-excel-config.json'
  if (-not (Test-Path $ConfigPath) -and (Test-Path $LegacyConfig)) { Copy-Item $LegacyConfig $ConfigPath }
}
# the app's addresses: GitHub Pages, and its own Cloudflare Pages address (an address given by hand: "origins" in pont-excel-config.json)
$AllowedOrigins = @('https://tomsremy.github.io', 'https://todo-tom.pages.dev', 'http://localhost:8000', 'http://127.0.0.1:8000')
if ($Mock) { $AllowedOrigins += 'null' }   # pages opened from a file, for tests only
$Kinds = @{
  pipe = @{ label = 'Pipe agrégation'; header = 'Nom Producteur'; keys = @('Nom Producteur', 'Nom Centrale'); sheet = 'Pipe agrégation' }
  bdd  = @{ label = 'BDD Agrégation'; header = 'Nom_prod'; keys = @('Nom_prod', 'Nom_Installation_prod'); sheet = 'BDD Agrégation' }
}
# EPPlus : lit/écrit un .xlsx sans ouvrir Excel, utilisé quand personne n'a le fichier ouvert (sinon, COM, plus bas).
# Téléchargé une fois (paquet NuGet, EPPlus 4.5.3.3 — la dernière version LGPL, un seul fichier .dll, aucune
# dépendance, cible .NET Framework nativement) et gardé dans lib/ à côté du script ; plus besoin ensuite.
$script:eppReady = $false
function Ensure-EPPlus {
  if ($script:eppReady) { return }
  $dllPath = Join-Path $LibDir 'EPPlus.dll'
  if (-not (Test-Path $LibDir)) { $null = New-Item -ItemType Directory -Path $LibDir }
  if (-not (Test-Path $dllPath)) {
    Write-Info 'Téléchargement d''EPPlus (une fois, pour écrire les Excel sans les ouvrir)…' 'Cyan'
    $tmpZip = Join-Path $LibDir 'epplus.nupkg.zip'
    try {
      Invoke-WebRequest -Uri 'https://api.nuget.org/v3-flatcontainer/epplus/4.5.3.3/epplus.4.5.3.3.nupkg' -OutFile $tmpZip -UseBasicParsing
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $zip = [System.IO.Compression.ZipFile]::OpenRead($tmpZip)
      try {
        $entry = $zip.Entries | Where-Object { $_.FullName -eq 'lib/net40/EPPlus.dll' }
        if (-not $entry) { throw "EPPlus.dll introuvable dans le paquet téléchargé (format inattendu)." }
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dllPath, $true)
      } finally { $zip.Dispose() }
    } catch {
      Remove-Item $dllPath -ErrorAction SilentlyContinue
      throw ("Impossible de récupérer EPPlus (" + $_.Exception.Message + ") : vérifie l'accès internet vers nuget.org, ou ouvre toi-même le fichier dans Excel avant d'envoyer (le pont repassera par Excel).")
    } finally { Remove-Item $tmpZip -ErrorAction SilentlyContinue }
  }
  Add-Type -Path $dllPath
  $script:eppReady = $true
}
# le fichier est-il déjà ouvert quelque part (toi ou un collègue) ? Si oui, on écrit dans cette session Excel-là
# (plus bas, les fonctions *-Book) ; sinon, EPPlus écrit le fichier lui-même, sans jamais ouvrir Excel.
function Is-AlreadyOpen($path) { [bool](Find-OpenBook ([IO.Path]::GetFileName($path))) }

function Write-Info($msg, $color = 'Gray') { Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $msg) -ForegroundColor $color }
# a formula that returns a literal text : the reliable way to write a string Excel would otherwise try to parse
function Quote-Formula($s) { '="' + (([string]$s) -replace '"', '""' -replace "`r?`n", '" & CHAR(10) & "') + '"' }
function Norm($s) {
  if ($null -eq $s) { return '' }
  $t = ([string]$s).Normalize([Text.NormalizationForm]::FormD)
  $t = -join ($t.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' })
  return ($t.ToLowerInvariant() -replace '[^a-z0-9]', '')
}
# compares the token byte by byte, without stopping at the first difference, so a wrong guess doesn't leak
# anything through how long the comparison takes (the length check is fine : the token's length is not secret)
function Token-Matches($given, $expected) {
  if ($null -eq $given -or $null -eq $expected) { return $false }
  $g = [Text.Encoding]::UTF8.GetBytes([string]$given); $e = [Text.Encoding]::UTF8.GetBytes([string]$expected)
  if ($g.Length -ne $e.Length) { return $false }
  $diff = 0; for ($i = 0; $i -lt $g.Length; $i++) { $diff = $diff -bor ($g[$i] -bxor $e[$i]) }
  return ($diff -eq 0)
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
# Excel: a workbook already open (in ANY Excel window — several Excel processes can run side by side) is used where it is;
# otherwise the bridge opens it in its own invisible Excel, closes it right after, and quits that Excel when it holds
# nothing more (so no hidden Excel keeps the file open: « … est ouvert dans une autre application »).
$script:xl = $null
function Get-Excel {
  if ($script:xl) { try { $null = $script:xl.Version; return $script:xl } catch { $script:xl = $null } }
  $script:xl = New-Object -ComObject Excel.Application; $script:xl.Visible = $false; $script:xl.DisplayAlerts = $false
  return $script:xl
}
function Release-Excel {
  if (-not $script:xl) { return }
  try { if ($script:xl.Workbooks.Count -eq 0) { $script:xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:xl); $script:xl = $null; [GC]::Collect() } } catch { $script:xl = $null }
}
$script:rotReady = $false
function Find-OpenBook($name) {
  # the Running Object Table lists every open workbook of every Excel, under its path or its SharePoint address
  if (-not $script:rotReady) {
    Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Runtime.InteropServices.ComTypes;
public static class TodoRot {
  [DllImport("ole32.dll")] static extern int GetRunningObjectTable(int r, out IRunningObjectTable t);
  [DllImport("ole32.dll")] static extern int CreateBindCtx(int r, out IBindCtx c);
  public static object Find(string fileName) {
    IRunningObjectTable rot; IEnumMoniker en; IBindCtx ctx;
    if (GetRunningObjectTable(0, out rot) != 0) return null;
    rot.EnumRunning(out en); CreateBindCtx(0, out ctx);
    IMoniker[] m = new IMoniker[1];
    while (en.Next(1, m, IntPtr.Zero) == 0) {
      string n = null; try { m[0].GetDisplayName(ctx, null, out n); } catch { continue; }
      if (n == null) continue;
      string d = Uri.UnescapeDataString(n).Replace('/', '\\');
      if (d.EndsWith("\\" + fileName, StringComparison.OrdinalIgnoreCase)) { object o; if (rot.GetObject(m[0], out o) == 0) return o; }
    }
    return null;
  }
}
"@
    $script:rotReady = $true
  }
  try { return [TodoRot]::Find($name) } catch { return $null }
}
function Open-Book($path) {
  if (-not (Test-Path $path)) { throw "Fichier introuvable : $path" }
  $name = [IO.Path]::GetFileName($path)
  $open = Find-OpenBook $name
  if ($open) {
    try { $null = $open.Worksheets.Count; return @{ wb = $open; opened = $false } } catch { }   # (an entry that is not a workbook: ignored)
  }
  $xl = Get-Excel
  try { $wb = $xl.Workbooks.Open($path) }
  catch {
    Release-Excel
    throw ("« " + $name + " » est ouvert dans un Excel que le pont ne peut pas rejoindre. Ferme ce fichier dans Excel (ou, s'il n'est ouvert nulle part, termine les « Microsoft Excel » restants dans le Gestionnaire des tâches), puis réessaie.")
  }
  if ($wb.ReadOnly) {
    $wb.Close($false); Release-Excel
    throw ("« " + $name + " » ne s'ouvre qu'en lecture seule (ouvert ou verrouillé ailleurs) : rien n'est écrit. Ferme-le dans Excel, puis réessaie.")
  }
  return @{ wb = $wb; opened = $true }
}
# a failed close used to be swallowed silently, with no retry : the file (and the bridge's hidden Excel) could stay
# locked long after the bridge went idle, for no reason visible in its window. A busy Excel is retried, like opening.
function Close-Book($book) {
  if (-not $book.opened) { return }
  for ($try = 1; $try -le 6; $try++) {
    try { $book.wb.Close($false); Release-Excel; return }
    catch {
      $busy = $_.Exception.Message -match '0x800AC472|0x8001010A|RPC_E_CALL_REJECTED|RPC_E_SERVERCALL_RETRYLATER'
      if ($busy -and $try -lt 6) { Start-Sleep -Seconds 2; continue }
      Write-Info ("Le fichier n'a pas pu être refermé proprement (" + $_.Exception.Message + ") : il peut rester verrouillé tant que ce pont tourne.") 'Red'
      Write-ErrorLog ("Fermeture échouée : " + $_.Exception.Message)
      break
    }
  }
  # the close itself didn't just fail, it hung : this Excel no longer answers reliably, and reusing it would make every
  # request after this one fail the same way until someone notices and closes it by hand. Abandon it now instead —
  # the next request starts a fresh Excel.Application. (The orphaned process may still need closing in Task Manager :
  # this only stops the bridge from leaning on it, it doesn't free whatever is wrong with that one.)
  try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($script:xl) } catch { }
  $script:xl = $null
}
# Writing happens in ONE sheet of each workbook, never elsewhere: « Pipe agrégation » in the Pipe, « BDD Agrégation » in
# the Suivi (the other sheets — Tableau de bord, Paramètres, Dashboard… — are never touched). Sheet found by its name
# (accents and case ignored); renamed or missing: nothing is written, the app is told why.
function Find-Table($wb, $kind) {
  $k = $Kinds[$kind]
  $ws = $null
  foreach ($w in $wb.Worksheets) { if ((Norm $w.Name) -eq (Norm $k.sheet)) { $ws = $w; break } }
  if (-not $ws) { throw ("Onglet « " + $k.sheet + " » introuvable dans « " + $(if ($wb.Name) { $wb.Name } else { [IO.Path]::GetFileName([string]$Config.$kind) }) + " » : rien n'est écrit (le pont n'écrit que dans cet onglet).") }
  foreach ($lo in $ws.ListObjects) {
    $h = $lo.HeaderRowRange.Value2
    for ($c = 1; $c -le $lo.ListColumns.Count; $c++) { if ((Norm $h[1, $c]) -eq (Norm $k.header)) { return $lo } }
  }
  throw ("Tableau « " + $k.label + " » introuvable dans l'onglet « " + $k.sheet + " » (colonne « " + $k.header + " ») : rien n'est écrit.")
}
function New-ComAdapter($kind) {
  $path = $Config.$kind
  $book = Open-Book $path
  try { $lo = Find-Table $book.wb $kind } catch { Close-Book $book; throw }   # never leave the file open behind an error
  $hdr = $lo.HeaderRowRange.Value2
  $headers = @(); for ($c = 1; $c -le $lo.ListColumns.Count; $c++) { $headers += [string]$hdr[1, $c] }
  $a = @{ kind = $kind; book = $book; lo = $lo; Headers = $headers; FirstCol = $lo.Range.Column }
  $a.RowCount = { param($a) $a.lo.ListRows.Count }
  $a.Cell = { param($a, $r, $c) $a.lo.DataBodyRange.Cells.Item($r, $c) }
  $a.Get = { param($a, $r, $c) (& $a.Cell $a $r $c).Value2 }
  $a.Column = { param($a, $c) $n = $a.lo.ListRows.Count; $out = New-Object object[] ($n + 1); if ($n -gt 0) { $v = $a.lo.ListColumns.Item($c).DataBodyRange.Value2; if ($n -eq 1) { $out[1] = $v } else { for ($r = 1; $r -le $n; $r++) { $out[$r] = $v[$r, 1] } } }; ,$out }
  $a.HasFormula = { param($a, $r, $c) [bool](& $a.Cell $a $r $c).HasFormula }
  # a Windows/Office update can break Range.Value2 (and sometimes Range.Value) for every cell type at once
  # ("Le cast spécifié n'est pas valide") ; writing the same value as a formula is unaffected, so every
  # type falls back to it rather than only numbers and booleans
  $a.Set = { param($a, $r, $c, $v) $cell = (& $a.Cell $a $r $c); $b = $(if ($v -is [psobject]) { $v.PSObject.BaseObject } else { $v })
    # a text starting with = + - @ is read by Excel as a formula, not as the text itself (a producer's or plant's name can
    # start with « = », by mistake or by nature) : written straight as a formula, it turns a key cell into an error.
    # Writing it as a formula that returns the literal text keeps the text, whichever way it was going to be written.
    if ($b -is [string] -and $b.Length -gt 0 -and '=+-@'.IndexOf($b[0]) -ge 0) { $cell.Formula = Quote-Formula $b; return }
    try { if ($b -is [datetime]) { $cell.Value = $b } else { $cell.Value2 = $b } }
    catch {
      try {
        if ($b -is [double] -or $b -is [int]) { $cell.Formula = ([double]$b).ToString([Globalization.CultureInfo]::InvariantCulture) }
        elseif ($b -is [bool]) { $cell.Formula = $(if ($b) { 'TRUE' } else { 'FALSE' }) }
        elseif ($b -is [datetime]) { $cell.Formula = '=DATE(' + $b.Year + ',' + $b.Month + ',' + $b.Day + ')' }
        else { $cell.Formula = Quote-Formula $b }
      } catch { $cell.Value = $b }   # a cell the formula bar won't accept (e.g. over Excel's 255-character formula-text limit) : last resort
    } }
  $a.BeforeWrite = { param($a) }
  $a.AddRow = { param($a) $null = $a.lo.ListRows.Add(); $a.lo.ListRows.Count }
  $a.ExcelRow = { param($a, $r) $a.lo.DataBodyRange.Row + $r - 1 }
  # empty = every cell that is not a formula is blank (the table's calculated columns fill a new row by themselves)
  $a.RowEmpty = { param($a, $r) $rg = $a.lo.ListRows.Item($r).Range; $v = $rg.Value2; $f = $rg.Formula
    if ($v -is [array]) { $n = $v.GetLength(1); for ($c = 1; $c -le $n; $c++) { if (([string]$f[1, $c]).StartsWith('=')) { continue }; if (-not (Is-EmptyCell $v[1, $c])) { return $false } }; return $true }
    return ((Is-EmptyCell $v) -or ([string]$f).StartsWith('=')) }
  $a.DeleteRow = { param($a, $r) $a.lo.ListRows.Item($r).Delete() }
  $a.DeleteRows = { param($a, $first, $count) $a.lo.DataBodyRange.Rows.Item($first).Resize($count).Delete() }
  $a.WasClosed = [bool]$book.opened
  $a.Backup = { param($a, $dir, $stamp) $n = [IO.Path]::GetFileNameWithoutExtension($a.book.wb.Name); $e = [IO.Path]::GetExtension($a.book.wb.Name); $p = Join-Path $dir ($n + "-" + $stamp + $e); $a.book.wb.SaveCopyAs($p); $p }
  $a.BackupPattern = { param($a) [IO.Path]::GetFileNameWithoutExtension($a.book.wb.Name) + "-*" + [IO.Path]::GetExtension($a.book.wb.Name) }
  $a.Save = { param($a) $a.book.wb.Save() }
  $a.Close = { param($a) Close-Book $a.book }
  return $a
}
# finds the table's sheet and its ListObject-equivalent (an EPPlus ExcelTable) by the same header column as Find-Table,
# without opening Excel. Used only to READ (New-DirectAdapter re-opens its own copy for writing) or to find out there's
# nothing to find — never mutated here.
function Find-DirectTable($pkg, $kind, $fileName) {
  $k = $Kinds[$kind]
  $ws = $null
  foreach ($w in $pkg.Workbook.Worksheets) { if ((Norm $w.Name) -eq (Norm $k.sheet)) { $ws = $w; break } }
  if (-not $ws) { throw ("Onglet « " + $k.sheet + " » introuvable dans « " + $fileName + " » : rien n'est écrit (le pont n'écrit que dans cet onglet).") }
  foreach ($t in $ws.Tables) {
    for ($c = $t.Address.Start.Column; $c -le $t.Address.End.Column; $c++) { if ((Norm $ws.Cells[$t.Address.Start.Row, $c].Text) -eq (Norm $k.header)) { return @{ ws = $ws; table = $t } } }
  }
  throw ("Tableau « " + $k.label + " » introuvable dans l'onglet « " + $k.sheet + " » (colonne « " + $k.header + " ») : rien n'est écrit.")
}
# a genuinely atomic replace (MoveFileEx + MOVEFILE_REPLACE_EXISTING), not Move-Item -Force : on PowerShell 5.1 /
# .NET Framework, Move-Item -Force onto an existing file isn't guaranteed to be one atomic rename under the hood
# (it may delete the destination first, then move) — which would reopen the exact "half-written file" window this
# whole rewrite exists to close. This calls the Win32 API directly instead of trusting that implementation detail.
$script:atomicReady = $false
function Invoke-AtomicReplace($from, $to) {
  if (-not $script:atomicReady) {
    Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class TodoAtomicMove {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool MoveFileEx(string lpExistingFileName, string lpNewFileName, uint dwFlags);
  public static void Replace(string from, string to) {
    if (!MoveFileEx(from, to, 0x1)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
}
"@
    $script:atomicReady = $true
  }
  [TodoAtomicMove]::Replace($from, $to)
}
# the whole file read into memory in one shot, then released immediately : EPPlus's constructor taking a FileInfo
# keeps that file open for as long as the package object lives, which holds the very lock on the real file this
# whole rewrite was meant to shrink (confirmed : it showed Excel's own "fichier ouvert dans une autre application").
# A MemoryStream has no file handle on the real path at all, so nothing is held open past this one quick read.
function Open-DirectPackage($path) {
  $bytes = [IO.File]::ReadAllBytes($path)
  $ms = New-Object IO.MemoryStream (,$bytes)
  @{ pkg = (New-Object OfficeOpenXml.ExcelPackage ($ms)); ms = $ms }
}
# écrit le fichier directement (EPPlus), sans jamais ouvrir Excel : utilisé seulement quand personne n'a le fichier
# ouvert (sinon New-ComAdapter, plus haut, pour écrire dans cette session Excel-là). Jamais testé en conditions
# réelles (pas de Windows ici) : à valider avant de lui faire confiance sur les vrais fichiers.
# Une toute nouvelle ligne (AddRow) n'est PAS gérée ici : étendre le tableau Excel (pas juste la feuille) sans
# API EPPlus fiable vérifiée serait le risquer de corrompre la structure du tableau pour de bon. Le message
# d'erreur dit d'ouvrir le fichier toi-même, ce qui fait repasser la prochaine requête par New-ComAdapter.
function New-DirectAdapter($kind) {
  Ensure-EPPlus
  $path = $Config.$kind
  if (-not (Test-Path $path)) { throw "Fichier introuvable : $path" }
  $opened = Open-DirectPackage $path; $pkg = $opened.pkg; $ms = $opened.ms
  try { $found = Find-DirectTable $pkg $kind ([IO.Path]::GetFileName($path)) } catch { $pkg.Dispose(); $ms.Dispose(); throw }
  $ws = $found.ws; $table = $found.table
  $firstRow = $table.Address.Start.Row; $firstCol = $table.Address.Start.Column; $lastCol = $table.Address.End.Column
  $headers = @(); for ($c = $firstCol; $c -le $lastCol; $c++) { $headers += [string]$ws.Cells[$firstRow, $c].Text }
  $a = @{ kind = $kind; pkg = $pkg; ms = $ms; ws = $ws; table = $table; Headers = $headers; FirstCol = $firstCol; firstRow = $firstRow; lastRow = $table.Address.End.Row; path = $path }
  $a.RowCount = { param($a) $a.lastRow - $a.firstRow }
  $a.Cell = { param($a, $r, $c) $a.ws.Cells[$a.firstRow + $r, $a.FirstCol + $c - 1] }
  $a.Get = { param($a, $r, $c) (& $a.Cell $a $r $c).Value }
  $a.Column = { param($a, $c) $n = & $a.RowCount $a; $out = New-Object object[] ($n + 1); for ($r = 1; $r -le $n; $r++) { $out[$r] = & $a.Get $a $r $c }; ,$out }
  $a.HasFormula = { param($a, $r, $c) [bool](& $a.Cell $a $r $c).Formula }
  # EPPlus's Formula property has no leading « = » (unlike COM's) ; Quote-Formula always returns one, stripped here
  $a.Set = { param($a, $r, $c, $v) $cell = (& $a.Cell $a $r $c)
    if ($v -is [string] -and $v.Length -gt 0 -and '=+-@'.IndexOf($v[0]) -ge 0) { $cell.Formula = (Quote-Formula $v).Substring(1); return }
    if ($v -is [datetime]) { $cell.Value = $v; if ($cell.Style.Numberformat.Format -notmatch '[dmy]') { $cell.Style.Numberformat.Format = 'dd/mm/yyyy' }; return }
    $cell.Value = $v }
  $a.BeforeWrite = { param($a) }
  $a.AddRow = { param($a) throw "Nouvelle ligne : pas encore prise en charge sans Excel ouvert. Ouvre le fichier toi-même dans Excel, puis réessaie." }
  $a.ExcelRow = { param($a, $r) $a.firstRow + $r }
  $a.RowEmpty = { param($a, $r) for ($c = 1; $c -le $a.Headers.Count; $c++) { if (& $a.HasFormula $a $r $c) { continue }; if (-not (Is-EmptyCell (& $a.Get $a $r $c))) { return $false } }; return $true }
  # clears the cells rather than truly removing the worksheet row : removing a row would also need to shrink the
  # Table's own range, which isn't done here for the same reason AddRow doesn't grow it. Harmless : a cleared trailing
  # row still reads as empty (RowEmpty above), so it keeps getting reused/retrimmed, never piling up unnoticed.
  $a.DeleteRow = { param($a, $r) for ($c = 1; $c -le $a.Headers.Count; $c++) { if (-not (& $a.HasFormula $a $r $c)) { (& $a.Cell $a $r $c).Value = $null } } }
  $a.DeleteRows = { param($a, $first, $count) for ($i = 0; $i -lt $count; $i++) { & $a.DeleteRow $a ($first + $i) } }
  $a.WasClosed = $true
  $a.Backup = { param($a, $dir, $stamp) $n = [IO.Path]::GetFileNameWithoutExtension($a.path); $e = [IO.Path]::GetExtension($a.path); $p = Join-Path $dir ($n + "-" + $stamp + $e); Copy-Item $a.path $p; $p }
  $a.BackupPattern = { param($a) [IO.Path]::GetFileNameWithoutExtension($a.path) + "-*" + [IO.Path]::GetExtension($a.path) }
  # written to a temp file, then swapped in with one atomic rename : a reader never sees a half-written file, and
  # the real file is never even touched if something fails before this point
  $a.Save = { param($a) $tmp = $a.path + '.tmp-' + [guid]::NewGuid().ToString('N') + '.xlsx'
    try { $a.pkg.SaveAs([IO.FileInfo]$tmp) } catch { Remove-Item $tmp -ErrorAction SilentlyContinue; throw }
    try { Invoke-AtomicReplace $tmp $a.path } catch { Remove-Item $tmp -ErrorAction SilentlyContinue; throw } }
  $a.Close = { param($a) $a.pkg.Dispose(); $a.ms.Dispose() }
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
  $a.HasFormula = { param($a, $r, $c) [bool]$a.t.formulas[$c] -or (([string]$a.t.rows[$r - 1][$c - 1]).StartsWith('=')) }
  $a.Set = { param($a, $r, $c, $v) $a.t.rows[$r - 1][$c - 1] = $v }
  # test only: a colleague inserts a line at the top just before the bridge writes
  $a.BeforeWrite = { param($a) if ($a.t.shiftOnWrite) { $a.t.shiftOnWrite = $false; $a.t.rows.Insert(0, (New-Object object[] $a.t.headers.Count)) } }
  $a.AddRow = { param($a) $line = New-Object object[] $a.t.headers.Count; foreach ($fc in $a.t.formulas.Keys) { $line[$fc - 1] = 'calculé' }; foreach ($bc in @($a.t.checkboxes)) { if ($bc) { $line[$bc - 1] = $false } }; $null = $a.t.rows.Add($line); $a.t.rows.Count }   # like a calculated column / a checkbox column
  $a.DeleteRow = { param($a, $r) $a.t.rows.RemoveAt($r - 1) }
  $a.DeleteRows = { param($a, $first, $count) $a.t.rows.RemoveRange($first - 1, $count) }
  $a.ExcelRow = { param($a, $r) $r + 1 }
  $a.RowEmpty = { param($a, $r) $line = $a.t.rows[$r - 1]; for ($c = 1; $c -le $line.Count; $c++) { if ($a.t.formulas[$c] -or ([string]$line[$c - 1]).StartsWith('=')) { continue }; if (-not (Is-EmptyCell $line[$c - 1])) { return $false } }; return $true }
  $a.WasClosed = [bool]$t.closed
  $a.Backup = { param($a, $dir, $stamp) $p = Join-Path $dir ("mock-" + $a.kind + "-" + $stamp + ".json"); (ConvertTo-Json -InputObject @($a.t.rows) -Depth 4 -Compress) | Set-Content -Path $p -Encoding UTF8; $p }
  $a.BackupPattern = { param($a) "mock-" + $a.kind + "-*.json" }
  $a.Save = { param($a) }
  $a.Close = { param($a) }
  return $a
}
function New-Adapter($kind) {
  if ($Mock) { return New-MockAdapter $kind }
  if (Is-AlreadyOpen $Config.$kind) { return New-ComAdapter $kind }   # someone has it open : write into that session
  try { return New-DirectAdapter $kind }
  catch { Write-Info ("Écriture directe impossible (" + $_.Exception.Message + ") : on passe par Excel.") 'DarkGray'; return New-ComAdapter $kind }
}

# ---------------- Upsert ----------------
$ClosedStatus = @('perdu', 'abandonne', 'nogo', 'resilie')
$RecentDays = 183
$BackupDir = Join-Path $Here 'Sauvegardes pont'
$KeepBackups = 3   # en jours, pas en nombre de fichiers : plusieurs envois le même jour ne comptent que pour un seul jour
function Is-Blank($v) { return ($null -eq $v -or ([string]$v).Trim() -eq '') }
# a cell of a new line counts as empty when blank or FALSE (an unticked checkbox: Excel fills checkbox columns by itself)
function Is-EmptyCell($v) { return ((Is-Blank $v) -or ($v -is [bool] -and -not $v)) }
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
  $pattern = & $a.BackupPattern $a
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'; $today = $stamp.Substring(0, 8)
  # a snapshot for today already exists (an earlier send today) : no need for another one, so a handful of quick
  # sends in the same day never crowd out yesterday's or the day before's snapshot
  $sameDay = Get-ChildItem -Path $BackupDir -Filter $pattern -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -match "-$today-\d{6}$" }
  if ($sameDay) { $state.backup = $sameDay[0].Name; return }
  $state.backup = [IO.Path]::GetFileName((& $a.Backup $a $BackupDir $stamp))
  # one snapshot kept per calendar day, the last $KeepBackups days : group by the date in the filename, not by file count
  $byDay = Get-ChildItem -Path $BackupDir -Filter $pattern -ErrorAction SilentlyContinue |
    ForEach-Object { if ($_.BaseName -match '-(\d{8})-\d{6}$') { [pscustomobject]@{ file = $_; day = $Matches[1] } } } |
    Group-Object day
  $byDay | Sort-Object Name -Descending | Select-Object -Skip $KeepBackups | ForEach-Object { foreach ($x in $_.Group) { Remove-Item $x.file.FullName -Force -ErrorAction SilentlyContinue } }
}
$JournalPath = Join-Path $BackupDir 'journal-pont.csv'
function Csv-Field($v) { '"' + ((Show-Value $v) -replace '"', '""' -replace "`r?`n", ' / ') + '"' }
function Write-Journal($a, $kind, $r, $c, $key, $old, $new, $why) {
  if (-not (Test-Path $BackupDir)) { $null = New-Item -ItemType Directory -Path $BackupDir }
  if (-not (Test-Path $JournalPath)) { [IO.File]::WriteAllText($JournalPath, "Date;Fichier;Ligne;Colonne;Centrale;Ancienne valeur;Nouvelle valeur;Pourquoi`r`n", (New-Object Text.UTF8Encoding $true)) }
  $line = (@((Get-Date -Format 'dd/MM/yyyy HH:mm:ss'), $Kinds[$kind].label, (& $a.ExcelRow $a $r), $a.Headers[$c - 1], $key, $old, $new, $why) | ForEach-Object { Csv-Field $_ }) -join ';'
  [IO.File]::AppendAllText($JournalPath, $line + "`r`n", (New-Object Text.UTF8Encoding $true))
}
# errors used to live only in the console window, lost on restart ; kept here too so a problem can be diagnosed afterwards
$ErrorLogPath = Join-Path $BackupDir 'erreurs-pont.log'
function Write-ErrorLog($msg) {
  try {
    if (-not (Test-Path $BackupDir)) { $null = New-Item -ItemType Directory -Path $BackupDir }
    [IO.File]::AppendAllText($ErrorLogPath, ('[' + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss') + '] ' + $msg + "`r`n"), (New-Object Text.UTF8Encoding $true))
  } catch { }
}
# the row still holds this plant (and, when given, this business code): checked again right before writing
function Row-Filled($a, $r) {
  $out = @(); for ($c = 1; $c -le $a.Headers.Count -and $out.Count -lt 4; $c++) { if (& $a.HasFormula $a $r $c) { continue }; $v = & $a.Get $a $r $c; if (-not (Is-EmptyCell $v)) { $out += ('« ' + $a.Headers[$c - 1] + ' » = « ' + (Show-Value $v) + ' »') } }
  return ($out -join ', ')
}
function Row-Still($a, $r, $keyCols, $keyVals) {
  if ($r -lt 1 -or $r -gt (& $a.RowCount $a)) { return $false }
  for ($j = 0; $j -lt $keyCols.Count; $j++) { if ((Norm (& $a.Get $a $r $keyCols[$j])) -ne $keyVals[$j]) { return $false } }
  return $true
}
function Upsert-Rows($kind, $rows) {
  $a = New-Adapter $kind
  $state = @{ backup = $null }
  $xlApp = $null; $calc = $null
  if (-not $Mock) { try { $xlApp = $a.book.wb.Application; $calc = $xlApp.Calculation; $xlApp.ScreenUpdating = $false; $xlApp.EnableEvents = $false; $xlApp.Calculation = -4135 } catch { } }
  $restore = { if ($xlApp) { try { if ($null -ne $calc) { $xlApp.Calculation = $calc }; $xlApp.EnableEvents = $true; $xlApp.ScreenUpdating = $true } catch { } } }
  try {
    # empty lines left at the end of the table (by bridges before 1.9, which added a line and saved even when they wrote nothing): removed
    $n = & $a.RowCount $a; $last = $n
    while ($last -ge 2 -and (& $a.RowEmpty $a $last)) { $last-- }
    $trail = $n - $last
    if ($trail -gt 0) {
      Ensure-Backup $a $state
      & $a.DeleteRows $a ($last + 1) $trail
      $state.wrote = $true
      & $a.Save $a   # saved right away : nothing left in Excel's memory only, if the rest of the request fails
      Write-Journal $a $kind ($last + 1) 1 '(fin du tableau)' '' '' ("$trail ligne(s) vide(s) retirée(s) en fin de tableau")
      Write-Info ("$($Kinds[$kind].label) : $trail ligne(s) vide(s) retirée(s) en fin de tableau") 'Cyan'
    }
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
    $keyColCache = $null; $keyColCacheN = -1   # the key columns rarely change row to row within one batch : re-read only when a row was added
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
      if ($n -ne $keyColCacheN) { $keyColCache = @(); foreach ($kc in $keyCols) { $keyColCache += ,(& $a.Column $a $kc) }; $keyColCacheN = $n }
      $cols = $keyColCache
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
      $action = 'mise à jour'; $addedNow = $false
      if ($isNew) {
        $action = 'ajoutée'
        # reuse a completely empty row at the end of the table, else extend the table
        $n = & $a.RowCount $a
        if ($n -ge 1 -and (& $a.RowEmpty $a $n)) {
          $first = $n; while ($first -gt 1 -and (& $a.RowEmpty $a ($first - 1))) { $first-- }
          $target = $first
        } else { Ensure-Backup $a $state; $target = & $a.AddRow $a; $addedNow = $true }
      }
      $written = New-Object System.Collections.ArrayList; $mine = New-Object System.Collections.ArrayList; $conflicts = New-Object System.Collections.ArrayList
      $rowCodeOk = $isNew -or (& $codeOk $target)
      $moved = $false; $why = ''
      if (-not $isNew) { $addedNow = $false }
      $order = @(); foreach ($kc in $keyCols) { $order += ($kc + $off - 1) }; for ($x = 0; $x -lt $vals.Count; $x++) { if ($order -notcontains $x) { $order += $x } }
      foreach ($i in $order) {
        $c = $i + 1 - $off
        if ($c -lt 1 -or $c -gt $a.Headers.Count) { continue }
        $v = Convert-Cell $vals[$i]
        if ($null -eq $v) { continue }
        if (& $a.HasFormula $a $target $c) { continue }
        $e = & $a.Get $a $target $c
        $toWrite = $null
        if ((Is-Blank $e) -or ($isNew -and (Is-EmptyCell $e))) { $toWrite = $v }   # a line just added: its FALSE checkboxes are Excel's, not someone's
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
          if ($written.Count -eq 0) { if (-not (& $a.RowEmpty $a $target)) { $moved = $true; $why = 'la nouvelle ligne ' + (& $a.ExcelRow $a $target) + ' n''est pas vide : ' + (Row-Filled $a $target); break } }
          else { foreach ($w in $written) { $got = & $a.Get $a $target ($w + 1 - $off); if (-not (Same-Value $got (Convert-Cell $vals[$w]))) { $moved = $true; $why = 'colonne « ' + $a.Headers[$w - $off] + ' » : écrit « ' + (Show-Value (Convert-Cell $vals[$w])) + ' », relu « ' + (Show-Value $got) + ' » (' + $(if ($null -eq $got) { 'vide' } else { $got.GetType().Name }) + ')' } }; if ($moved) { break } }
        } elseif (-not (Row-Still $a $target $keyCols $keyVals)) { $moved = $true; $why = 'la ligne ' + (& $a.ExcelRow $a $target) + ' ne porte plus ' + $keyText; break }
        $old = & $a.Get $a $target $c
        if (-not (Same-Value $old $e)) { $moved = $true; $why = 'colonne « ' + $a.Headers[$c - 1] + ' » : « ' + (Show-Value $e) + ' » devenu « ' + (Show-Value $old) + ' »'; break }   # the cell changed under our feet
        & $a.Set $a $target $c $toWrite
        Write-Journal $a $kind $target $c $keyText $old $toWrite $(if (Is-Blank $old) { 'case vide remplie' } elseif ($f -eq 'replace') { 'Remplacer (choisi dans l''app)' } elseif ($f -eq 'merge') { 'Fusionner (choisi dans l''app)' } else { 'valeur écrite par l''app, inchangée depuis' })
        [void]$written.Add($i); [void]$mine.Add($i)
      }
      # a line added then abandoned is removed. It was added at the END of the table: a colleague's insertion higher up only pushes
      # it down, so the last line is the one to look at — removed only if it is empty (never someone's line)
      if ($moved -and $addedNow -and $written.Count -eq 0) { try { $lastRow = & $a.RowCount $a; if ($lastRow -ge 1 -and (& $a.RowEmpty $a $lastRow)) { & $a.DeleteRow $a $lastRow } } catch { } }
      # saved right away, row by row : a crash, or an error further down the same batch, never loses more than the row in progress
      if ($written.Count -gt 0) { $state.wrote = $true; & $a.Save $a }
      if ($moved) {
        [void]$results.Add(@{ ok = $false; key = $keyText; message = ($(if ($written.Count) { "Le tableau a bougé pendant l'écriture (tri ou insertion par un collègue) : arrêt après " + $written.Count + " case(s), notées dans le journal. Renvoie l'affaire." } else { "Le tableau a bougé (tri ou insertion par un collègue) : rien n'a été écrit sur cette ligne. Renvoie l'affaire." }) + $(if ($why) { ' (' + $why + ')' } else { '' })); written = @($written); mine = @($mine) })
        Write-Info ("$($Kinds[$kind].label) : tableau modifié pendant l'envoi, ligne arrêtée (" + $keyText + ')' + $(if ($why) { ' — ' + $why } else { '' })) 'Yellow'
        continue
      }
      # « mise à jour » used to stay even when nothing was actually written (only a cell kept as a conflict) : misleading,
      # since it reads as a successful write. Now it only means a cell really changed in the file.
      if (-not $isNew -and $written.Count -eq 0) { $action = 'aucun changement' }
      [void]$results.Add(@{ ok = $true; action = $action; row = (& $a.ExcelRow $a $target); cells = $written.Count; key = $keyText; note = $note; written = @($written); mine = @($mine); conflicts = @($conflicts) })
      Write-Info ("$($Kinds[$kind].label) : ligne $action (" + $keyText + ')' + $(if ($conflicts.Count) { ' — ' + $conflicts.Count + ' case(s) gardée(s)' } else { '' })) 'Green'
    }
    & $restore
    if ($state.wrote) { & $a.Save $a }   # nothing written: the file is not saved (a line added then abandoned was already removed)
    return @{ ok = $true; results = $results; backup = $state.backup; fileWasClosed = [bool]$a.WasClosed }
  } finally { & $restore; & $a.Close $a }
}

# ---------------- Reading (Parc) ----------------
# same reading, without opening Excel (EPPlus) : used only when nobody has the file open (see Is-AlreadyOpen).
# Reading never writes anything, so there's no corruption risk here even if something about this path is wrong —
# worst case it throws and Read-Sheets falls back to the Excel/COM path below.
function Read-Sheets-Direct($kind) {
  Ensure-EPPlus
  $path = $Config.$kind
  if (-not (Test-Path $path)) { throw "Fichier introuvable : $path" }
  $opened = Open-DirectPackage $path; $pkg = $opened.pkg
  try {
    $out = @{}; $allNames = @($pkg.Workbook.Worksheets | ForEach-Object { $_.Name })
    foreach ($ws in $pkg.Workbook.Worksheets) {
      if ((Norm $ws.Name) -ne (Norm $Kinds[$kind].sheet) -and -not ($kind -eq 'bdd' -and $ws.Name -match 'Dashboard')) { continue }
      $rows = New-Object System.Collections.ArrayList
      $dim = $ws.Dimension
      if ($dim) {
        # absolute columns/rows from 1, not from $dim.Start : the rest of the pont assumes the table starts at A1
        # (like Read-Request's COM path, whose Value2 array is 1-based from wherever the used range itself starts)
        for ($r = 1; $r -le $dim.End.Row; $r++) {
          $line = New-Object object[] $dim.End.Column
          for ($c = 1; $c -le $dim.End.Column; $c++) { $line[$c - 1] = $ws.Cells[$r, $c].Value }
          [void]$rows.Add($line)
        }
      }
      $out[$ws.Name] = $rows
    }
    return @{ sheets = $out; allNames = $allNames }
  } finally { $pkg.Dispose(); $opened.ms.Dispose() }
}
function Read-Sheets($kind) {
  $out = @{}
  if ($Mock) {
    $t = (New-MockAdapter $kind).t
    $rows = New-Object System.Collections.ArrayList
    [void]$rows.Add([object[]]$t.headers)
    foreach ($r in $t.rows) { [void]$rows.Add([object[]]$r) }
    $out[$Kinds[$kind].sheet] = $rows
    return @{ sheets = $out; allNames = @($Kinds[$kind].sheet) }
  }
  if (-not (Is-AlreadyOpen $Config.$kind)) {
    try { return Read-Sheets-Direct $kind } catch { Write-Info ("Lecture directe impossible (" + $_.Exception.Message + ") : on passe par Excel.") 'DarkGray' }
  }
  $book = Open-Book $Config.$kind
  try {
    # every worksheet's name, whether or not it matches : the only way the app can show what's really in the file
    # when the expected one isn't found, instead of a blind "aucun" that doesn't say what was actually there
    $allNames = @($book.wb.Worksheets | ForEach-Object { $_.Name })
    foreach ($ws in $book.wb.Worksheets) {
      # only the sheet the app works with (and the Suivi's Dashboard, for the yearly goals): never another « Pipe … » sheet
      if ((Norm $ws.Name) -ne (Norm $Kinds[$kind].sheet) -and -not ($kind -eq 'bdd' -and $ws.Name -match 'Dashboard')) { continue }
      $v = $ws.UsedRange.Value2
      $rows = New-Object System.Collections.ArrayList
      if ($v -is [array]) {
        $nr = $v.GetLength(0); $nc = $v.GetLength(1)
        for ($r = 1; $r -le $nr; $r++) { $line = New-Object object[] $nc; for ($c = 1; $c -le $nc; $c++) { $line[$c - 1] = $v[$r, $c] }; [void]$rows.Add($line) }
      }
      $out[$ws.Name] = $rows
    }
  } finally { Close-Book $book }
  return @{ sheets = $out; allNames = $allNames }
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
  # defense in depth against DNS-rebinding : a page on another domain whose name briefly resolves to 127.0.0.1
  # would still send Host: 127.0.0.1:<port> or localhost:<port> only if it already knew the port, which the
  # token already guards ; this just closes the one remaining gap for a request sent without a browser's Origin
  $hostHeader = $req.headers['host']
  if ($hostHeader -and $hostHeader -notmatch ('^(127\.0\.0\.1|localhost):' + $Port + '$')) { return @(403, @{ ok = $false; message = 'Hôte non autorisé.' }) }
  $origin = $req.headers['origin']
  if ($origin -and -not ($AllowedOrigins -contains $origin)) { return @(403, @{ ok = $false; message = 'Origine non autorisée.' }) }
  if ($req.method -eq 'OPTIONS') { return @(204, $null) }
  $authorized = (Token-Matches $req.headers['x-bridge-token'] $Config.token)
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
    $t.checkboxes = @($data.checkboxes | ForEach-Object { [int]$_ })
    return @(200, @{ ok = $true })
  }
  if ($Mock -and $req.method -eq 'POST' -and $req.path -match '^/mock/edit/(pipe|bdd)$') {
    $t = $script:mockTables[$Matches[1]]; $d = $req.body | ConvertFrom-Json
    switch ([string]$d.op) {
      'set' { $t.rows[[int]$d.row - 1][[int]$d.col - 1] = $d.value }
      'insert' { $line = New-Object object[] $t.headers.Count; $vals = @($d.values); for ($i = 0; $i -lt $vals.Count -and $i -lt $line.Count; $i++) { $line[$i] = $vals[$i] }; $t.rows.Insert([int]$d.at - 1, $line) }
      'delete' { $t.rows.RemoveAt([int]$d.row - 1) }
      'shift' { $t.shiftOnWrite = $true }   # a colleague will insert a line at the top during the next write
      'unshift' { $t.shiftOnWrite = $false }
      'sort' { $c = [int]$d.col - 1; $sorted = @($t.rows | Sort-Object -Property @{ Expression = { [string]$_[$c] }; Descending = [bool]$d.desc }); $t.rows.Clear(); foreach ($r in $sorted) { [void]$t.rows.Add($r) } }
    }
    return @(200, @{ ok = $true; count = $t.rows.Count; shiftArmed = [bool]$t.shiftOnWrite })
  }
  if ($Mock -and $req.method -eq 'GET' -and $req.path -match '^/mock/dump/(pipe|bdd)$') {
    $t = $script:mockTables[$Matches[1]]
    return @(200, @{ ok = $true; headers = $t.headers; rows = @($t.rows | ForEach-Object { ,@($_ | ForEach-Object { Show-Value $_ }) }) })
  }
  if ($req.method -eq 'GET' -and $req.path -match '^/(pipe|bdd)/read$') {
    $r = Read-Sheets $Matches[1]
    return @(200, @{ ok = $true; sheets = $r.sheets; allNames = $r.allNames })
  }
  return @(404, @{ ok = $false; message = 'Route inconnue.' })
}

$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
$started = $false
try { $listener.Start(); $started = $true } catch { }
if (-not $started) {
  # another bridge (an older window, often) holds the port: say so, and offer to stop it
  $old = $null
  try { $old = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $Port + "/status") -TimeoutSec 3 } catch { }
  if ($old -and $old.version) {
    Write-Info ("Un pont Excel tourne déjà (version " + $old.version + "), dans une autre fenêtre.") 'Yellow'
    $pids = @()
    try { $pids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique) } catch { }
    $pids = @($pids | Where-Object { $_ -and $_ -ne $PID })
    if ($pids.Count -gt 0) {
      $ans = Read-Host "Arrêter l'ancien pont et démarrer celui-ci ? (O/N)"
      if ($ans -match '^\s*[oOyY]') {
        foreach ($p in $pids) { try { Stop-Process -Id $p -Force -ErrorAction Stop } catch { } }
        Start-Sleep -Seconds 1
        try { $listener.Start(); $started = $true } catch { }
      }
    }
  }
  if (-not $started) {
    Write-Info ("Le port " + $Port + " est déjà utilisé : ferme la fenêtre de l'ancien pont (fenêtre noire « Pont Excel - Todo »), puis relance celui-ci.") 'Red'
    exit 1
  }
}
Write-Host ''
Write-Host "Pont Excel pour Todo v$Version — http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host ('  Pipe : ' + $Config.pipe)
Write-Host ('  BDD  : ' + $Config.bdd)
Write-Host ('  Clé à recopier dans l''app (Réglages → Pont Excel) : ' + $Config.token) -ForegroundColor Yellow
Write-Host '  Laisse cette fenêtre ouverte (tu peux la réduire). Ctrl+C pour arrêter.'
Write-Host ''
try {
$lastIdleCheck = [DateTime]::UtcNow
while ($true) {
  # no request pending : a chance to notice and release an Excel left open with nothing in it (a close that failed
  # earlier, or one that never got a next request to retry on), instead of waiting indefinitely for one
  while (-not $listener.Pending()) {
    Start-Sleep -Milliseconds 500
    if (([DateTime]::UtcNow - $lastIdleCheck).TotalMinutes -ge 5) {
      $lastIdleCheck = [DateTime]::UtcNow
      if ($script:xl) { try { if ($script:xl.Workbooks.Count -eq 0) { Release-Excel; Write-Info 'Excel libéré (resté ouvert sans classeur, inactif).' 'DarkGray' } } catch { $script:xl = $null } }
    }
  }
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 10000
    $stream = $client.GetStream()
    $req = Read-Request $stream
    if ($null -eq $req) { continue }
    $origin = $req.headers['origin']
    $res = $null; $tries = 0
    while ($null -eq $res) {
      try { $res = Handle $req }
      catch {
        $msg = $_.Exception.Message
        $busy = $msg -match '0x800AC472|0x8001010A|RPC_E_CALL_REJECTED|RPC_E_SERVERCALL_RETRYLATER'
        $tries++
        # Excel busy (a cell being typed, a dialog open): tried again for about 10 s before giving up
        if ($busy -and $tries -lt 6) { Write-Info 'Excel est occupé, nouvel essai dans 2 s…' 'DarkGray'; Start-Sleep -Seconds 2; continue }
        if ($busy) { $msg = 'Excel est occupé (une cellule en cours de saisie, ou une fenêtre de message ouverte dans Excel) : termine la saisie ou ferme la fenêtre, puis réessaie.' }
        $at = ''; try { $at = ' [pont, ligne ' + $_.InvocationInfo.ScriptLineNumber + ' : ' + ($_.InvocationInfo.Line.Trim() -replace '\s+', ' ').Substring(0, [Math]::Min(90, ($_.InvocationInfo.Line.Trim() -replace '\s+', ' ').Length)) + ']' } catch { }
        Write-Info ("Erreur : " + $msg + $at) 'Red'
        Write-ErrorLog ("Erreur : " + $msg + $at)
        $res = @(500, @{ ok = $false; message = $msg })
      }
    }
    Send-Response $stream $res[0] $res[1] $origin
  } catch { Write-Info ("Connexion interrompue : " + $_.Exception.Message) 'DarkGray' }
  finally { $client.Close() }
}
} finally { if ($script:xl) { try { $script:xl.Quit() } catch { } } ; $listener.Stop() }   # Ctrl+C or window closed: the bridge's own Excel goes too
