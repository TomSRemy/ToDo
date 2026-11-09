<#
  Raccourci de capture rapide pour Todo — à lancer sur l'ordinateur (Windows PowerShell 5.1, rien à installer :
  ni Node, ni Excel, pas de WebView2, pas de DLL téléchargée).

  Appuyer sur Alt+N, n'importe où sur Windows, ouvre (ou cache si déjà ouverte) une petite fenêtre toujours
  au-dessus des autres, en haut de l'écran, avec le widget de capture de Todo (index.html?widget). C'est Edge
  qui l'affiche, en « mode app » (sans barre d'adresse ni onglets) : le pont ne fait que lancer cette fenêtre
  et la garder au-dessus, par les mêmes API Windows qu'utilise n'importe quel gestionnaire de fenêtres.

  Pas d'équivalent exact à l'encoche d'un Mac : au-dessus d'un jeu en plein écran « exclusif » (DirectX
  ancienne génération), ça peut ne pas passer devant. Au-dessus de tout le reste (navigateur en F11 compris),
  ça marche.

  Lancement : double-clic sur « Lancer-raccourci.bat ». Pour l'avoir à chaque démarrage de Windows, place un
  raccourci vers ce .bat dans le dossier qui s'ouvre avec Win+R puis « shell:startup ».
  Options : -Url (une autre adresse que l'appli publique), -Width, -Height (taille de la fenêtre).
#>
param(
  [string]$Url = 'https://todo-tom.pages.dev/index.html?widget',
  [int]$Width = 620,
  [int]$Height = 260
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

function Write-Info($msg, $color = 'Gray') { Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $msg) -ForegroundColor $color }

# une seule instance à la fois : un deuxième lancement se contente de prévenir et s'arrête (sinon Alt+N
# échouerait silencieusement à s'enregistrer deux fois)
$singleInstance = New-Object System.Threading.Mutex($false, 'Global\TodoRaccourciCapture')
if (-not $singleInstance.WaitOne(0)) {
  Write-Info 'Déjà lancé (vérifie la barre des tâches / la zone de notification). Alt+N fonctionne déjà.' 'Yellow'
  Start-Sleep -Seconds 3
  exit 0
}

# ---------- Le petit bout de Windows qu'il faut vraiment en C# : un raccourci clavier global (RegisterHotKey
# n'existe qu'en API Windows, pas en PowerShell pur) et la fenêtre invisible qui reçoit son signal ----------
Add-Type -Namespace TodoBridge -Name HotkeyWindow -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool RegisterHotKey(System.IntPtr hWnd, int id, uint fsModifiers, uint vk);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool UnregisterHotKey(System.IntPtr hWnd, int id);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool SetWindowPos(System.IntPtr hWnd, System.IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool IsWindow(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool SetForegroundWindow(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool IsWindowVisible(System.IntPtr hWnd);
'@

# fenêtre à la fois invisible (jamais montrée) et messagère : sa seule raison d'être est de recevoir WM_HOTKEY
Add-Type -ReferencedAssemblies System.Windows.Forms -Language CSharp -TypeDefinition @'
using System;
using System.Windows.Forms;
public class TodoHotkeyForm : Form {
  public event EventHandler HotkeyPressed;
  protected override void OnLoad(EventArgs e) { base.OnLoad(e); this.ShowInTaskbar = false; this.WindowState = FormWindowState.Minimized; this.Opacity = 0; }
  protected override void WndProc(ref Message m) {
    const int WM_HOTKEY = 0x0312;
    if (m.Msg == WM_HOTKEY && HotkeyPressed != null) HotkeyPressed(this, EventArgs.Empty);
    base.WndProc(ref m);
  }
}
'@

$HWND_TOPMOST = [System.IntPtr](-1)
$SWP_NOACTIVATE = 0x0010
$SWP_SHOWWINDOW = 0x0040
$SW_HIDE = 0
$SW_SHOW = 5
$MOD_ALT = 0x1
$VK_N = 0x4E

$form = New-Object TodoHotkeyForm
$form.Add_Shown({ $form.Hide() })
$null = $form.Handle   # force la création de la fenêtre (et donc son HWND) sans jamais l'afficher

if (-not [TodoBridge.HotkeyWindow]::RegisterHotKey($form.Handle, 1, $MOD_ALT, $VK_N)) {
  Write-Info "Alt+N est déjà pris par une autre appli. Ferme-la, ou relance avec un autre raccourci (modifie -Width/-Height dans ce script pour -Hotkey plus tard)." 'Red'
  $singleInstance.ReleaseMutex(); exit 1
}
Write-Info ('Prêt. Alt+N ouvre/cache la capture rapide (' + $Url + ').') 'Green'

$script:capHwnd = [System.IntPtr]::Zero
$script:capProc = $null

function Open-Or-Toggle-Capture {
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $x = [int](($screen.Width - $Width) / 2)

  $alive = ($script:capHwnd -ne [System.IntPtr]::Zero) -and [TodoBridge.HotkeyWindow]::IsWindow($script:capHwnd) -and $script:capProc -and -not $script:capProc.HasExited
  if ($alive) {
    if ([TodoBridge.HotkeyWindow]::IsWindowVisible($script:capHwnd)) {
      [TodoBridge.HotkeyWindow]::ShowWindow($script:capHwnd, $SW_HIDE) | Out-Null
      Write-Info 'Capture rapide cachée.'
    } else {
      [TodoBridge.HotkeyWindow]::ShowWindow($script:capHwnd, $SW_SHOW) | Out-Null
      [TodoBridge.HotkeyWindow]::SetWindowPos($script:capHwnd, $HWND_TOPMOST, $x, 0, $Width, $Height, $SWP_SHOWWINDOW) | Out-Null
      [TodoBridge.HotkeyWindow]::SetForegroundWindow($script:capHwnd) | Out-Null
      Write-Info 'Capture rapide affichée.'
    }
    return
  }

  Write-Info 'Ouverture de la capture rapide…' 'Cyan'
  $edge = Get-Command msedge.exe -ErrorAction SilentlyContinue
  $edgePath = if ($edge) { $edge.Source } else { Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe' }
  if (-not (Test-Path $edgePath)) {
    Write-Info "Microsoft Edge est introuvable (" + $edgePath + "). Le widget s'ouvre normalement avec Edge, préinstallé sur Windows 10/11." 'Red'
    return
  }
  $edgeArgs = @('--app=' + $Url, "--window-size=$Width,$Height", "--window-position=$x,0")
  $script:capProc = Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -PassThru

  # la fenêtre d'Edge met un instant à exister : on l'attend, sans bloquer le raccourci plus de quelques secondes
  $tries = 0
  while ($tries -lt 40) {
    Start-Sleep -Milliseconds 150
    $script:capProc.Refresh()
    if ($script:capProc.MainWindowHandle -ne [System.IntPtr]::Zero) { break }
    $tries++
  }
  $script:capHwnd = $script:capProc.MainWindowHandle
  if ($script:capHwnd -eq [System.IntPtr]::Zero) {
    # Edge tourne souvent déjà en arrière-plan et se contente de rouvrir une fenêtre dans ce processus-là :
    # celui que Start-Process a renvoyé s'arrête alors aussitôt, sans jamais avoir de fenêtre. On la retrouve
    # par son titre (celui de la page) parmi tous les msedge.exe en cours.
    Start-Sleep -Milliseconds 300
    $byTitle = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match 'ToDo Agrégation' -and $_.MainWindowHandle -ne [System.IntPtr]::Zero } | Select-Object -First 1
    if ($byTitle) { $script:capProc = $byTitle; $script:capHwnd = $byTitle.MainWindowHandle }
  }
  if ($script:capHwnd -eq [System.IntPtr]::Zero) {
    Write-Info "La fenêtre n'est pas apparue à temps (relance Alt+N pour réessayer)." 'Yellow'
    return
  }
  [TodoBridge.HotkeyWindow]::SetWindowPos($script:capHwnd, $HWND_TOPMOST, $x, 0, $Width, $Height, $SWP_SHOWWINDOW) | Out-Null
  [TodoBridge.HotkeyWindow]::SetForegroundWindow($script:capHwnd) | Out-Null
}

$form.add_HotkeyPressed({ Open-Or-Toggle-Capture })

try {
  [System.Windows.Forms.Application]::Run($form)
} finally {
  [TodoBridge.HotkeyWindow]::UnregisterHotKey($form.Handle, 1) | Out-Null
  $singleInstance.ReleaseMutex()
}
