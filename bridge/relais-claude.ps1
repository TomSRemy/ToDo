<#
  Relais Claude pour Todo — à lancer sur l'ordinateur (Windows PowerShell 5.1, rien à installer : utilise la
  CLI Claude Code déjà sur ta machine, couverte par ton abonnement Pro/Max, jamais facturée au token).

  « Compléter avec l'IA » (Portefeuille) peut passer par ici au lieu de Gemini ou du copier-coller manuel :
  l'app envoie le prompt à http://127.0.0.1:8766/ask, ce script le donne à `claude -p` (Claude Code en mode
  non interactif) et renvoie sa réponse. Rien ne sort de ta machine vers un tiers que tu n'utilises pas déjà :
  c'est la même CLI que celle qui fait tourner cette session.

  Lancement : double-clic sur « Lancer-relais-claude.bat ». Au premier lancement, recopie la clé affichée
  dans l'app (Réglages → Pont Excel, section relais local). Laisse la fenêtre ouverte, comme le pont Excel.

  Vérifie d'abord, dans une invite de commandes normale, que « claude --version » répond : ce script a besoin
  que Claude Code soit installé et connecté (claude /login fait une fois suffit).
#>
param([int]$Port = 8766)

$ErrorActionPreference = 'Stop'
$Version = '1.0'
$AllowedOrigins = @('https://tomsremy.github.io', 'https://todo-tom.pages.dev', 'http://localhost:8000', 'http://127.0.0.1:8000')

$cfgDir = Join-Path $env:APPDATA 'Todo Pont Excel'
if (-not (Test-Path $cfgDir)) { $null = New-Item -ItemType Directory -Path $cfgDir }
$ConfigPath = Join-Path $cfgDir 'relais-claude-config.json'

function New-Token {   # 24 caractères du générateur cryptographique du système, comme le pont Excel
  $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ($b | ForEach-Object { 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[$_ % 57] })
}
function Token-Matches($given, $expected) {
  if ($null -eq $given -or $null -eq $expected) { return $false }
  $g = [Text.Encoding]::UTF8.GetBytes([string]$given); $e = [Text.Encoding]::UTF8.GetBytes([string]$expected)
  if ($g.Length -ne $e.Length) { return $false }
  $diff = 0; for ($i = 0; $i -lt $g.Length; $i++) { $diff = $diff -bor ($g[$i] -bxor $e[$i]) }
  return ($diff -eq 0)
}
$Config = if (Test-Path $ConfigPath) { Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null }
if (-not $Config -or -not $Config.token) {
  $Config = [pscustomobject]@{ token = (New-Token) }
  ($Config | ConvertTo-Json) | Out-File -FilePath $ConfigPath -Encoding UTF8
}

function Write-Info($msg, $color = 'Gray') { Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $msg) -ForegroundColor $color }

# ---------------- Claude Code en non-interactif ----------------
function Invoke-ClaudeCli([string]$prompt) {
  $cmd = Get-Command claude -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Claude Code (la commande « claude ») est introuvable. Vérifie, dans une invite de commandes normale, que « claude --version » répond." }
  $src = $cmd.Source
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  if ($src -match '\.(cmd|bat)$') { $psi.FileName = $env:ComSpec; $psi.Arguments = '/c "' + $src + '" -p' }
  else { $psi.FileName = $src; $psi.Arguments = '-p' }
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.WorkingDirectory = $env:TEMP
  $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
  $proc = [System.Diagnostics.Process]::Start($psi)
  $proc.StandardInput.Write($prompt)
  $proc.StandardInput.Close()
  $out = $proc.StandardOutput.ReadToEnd()
  $err = $proc.StandardError.ReadToEnd()
  $done = $proc.WaitForExit(120000)
  if (-not $done) { try { $proc.Kill() } catch {}; throw 'Claude Code n''a pas répondu en 2 minutes.' }
  if ($proc.ExitCode -ne 0) { throw ('Claude Code a échoué : ' + ($(if ($err) { $err.Trim() } else { 'code ' + $proc.ExitCode }))) }
  return $out
}

# ---------------- Serveur HTTP minimal sur 127.0.0.1 (même plomberie que le pont Excel) ----------------
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
  $hostHeader = $req.headers['host']
  if ($hostHeader -and $hostHeader -notmatch ('^(127\.0\.0\.1|localhost):' + $Port + '$')) { return @(403, @{ ok = $false; message = 'Hôte non autorisé.' }) }
  $origin = $req.headers['origin']
  if ($origin -and -not ($AllowedOrigins -contains $origin)) { return @(403, @{ ok = $false; message = 'Origine non autorisée.' }) }
  if ($req.method -eq 'OPTIONS') { return @(204, $null) }
  $authorized = (Token-Matches $req.headers['x-bridge-token'] $Config.token)
  if ($req.path -eq '/status') {
    $claudeFound = [bool](Get-Command claude -ErrorAction SilentlyContinue)
    return @(200, @{ ok = $true; version = $Version; authorized = $authorized; claudeFound = $claudeFound })
  }
  if (-not $authorized) { return @(401, @{ ok = $false; message = 'Clé du relais incorrecte : recopie la clé affichée dans la fenêtre du relais.' }) }
  if ($req.method -eq 'POST' -and $req.path -eq '/ask') {
    $data = $req.body | ConvertFrom-Json
    $text = Invoke-ClaudeCli ([string]$data.prompt)
    return @(200, @{ ok = $true; text = $text })
  }
  return @(404, @{ ok = $false; message = 'Route inconnue.' })
}

$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $Port
$started = $false
try { $listener.Start(); $started = $true } catch { }
if (-not $started) {
  Write-Info ("Le port " + $Port + " est déjà utilisé : soit le relais tourne déjà (Alt+N marche alors sans rien faire de plus), soit ferme l'autre fenêtre qui l'occupe.") 'Yellow'
  exit 1
}
Write-Host ''
Write-Host "Relais Claude pour Todo v$Version — http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host ('  Clé à recopier dans l''app (Réglages → relais local Claude) : ' + $Config.token) -ForegroundColor Yellow
Write-Host '  Laisse cette fenêtre ouverte (tu peux la réduire). Ctrl+C pour arrêter.'
Write-Host ''

while ($true) {
  while (-not $listener.Pending()) { Start-Sleep -Milliseconds 500 }
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 130000
    $stream = $client.GetStream()
    $req = Read-Request $stream
    if ($null -eq $req) { continue }
    $origin = $req.headers['origin']
    $res = $null
    try { $res = Handle $req }
    catch { Write-Info ('Erreur : ' + $_.Exception.Message) 'Red'; $res = @(500, @{ ok = $false; message = $_.Exception.Message }) }
    Send-Response $stream $res[0] $res[1] $origin
  } catch { Write-Info ('Connexion interrompue : ' + $_.Exception.Message) 'DarkGray' }
  finally { $client.Close() }
}
