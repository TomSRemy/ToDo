Attribute VB_Name = "ToDoPont"
' ==========================================================================================
'  Complément « ToDo » pour Excel : écrit dans le Pipe / le Suivi ce que le pont Excel demande.
'  Installé dans le classeur de macros personnelles (PERSONAL.XLSB) : rien n'est ajouté au
'  Pipe ni au Suivi, qui restent des .xlsx.
'
'  Règles :
'   - n'écrit QUE dans le tableau de l'onglet demandé (Pipe agrégation, BDD Agrégation, Contacts),
'     jamais ailleurs, jamais dans un autre onglet ni un autre fichier ;
'   - une case n'est écrite que si elle contient encore la valeur que le pont a vue : sinon elle
'     est laissée telle quelle (un collègue l'a changée) et le pont le signale ;
'   - une nouvelle ligne est ajoutée au tableau comme une saisie (au-dessus de la ligne Total) ;
'   - rien n'est jamais supprimé.
'  Échanges : dossier %LOCALAPPDATA%\TodoPontExcel\excel (demandes *.req, réponses *.res).
' ==========================================================================================
Option Explicit

' le temps depuis la dernière frappe ou le dernier clic (Windows) : le complément te laisse finir avant d'écrire
Private Type DERNIERE_ACTION
    cbSize As Long
    dwTime As Long
End Type
#If VBA7 Then
Private Declare PtrSafe Function GetLastInputInfo Lib "user32" (ByRef info As DERNIERE_ACTION) As Long
Private Declare PtrSafe Function GetTickCount Lib "kernel32" () As Long
#Else
Private Declare Function GetLastInputInfo Lib "user32" (ByRef info As DERNIERE_ACTION) As Long
Private Declare Function GetTickCount Lib "kernel32" () As Long
#End If
Private Const PAUSE_SECONDES As Long = 20   ' attendre que tu fasses une pause de 20 s dans le fichier visé…
Private Const ATTENTE_MAX As Long = 40      ' …mais jamais plus de 40 s (le pont attend la réponse)

' les cases écrites au dernier passage, avec leur contenu d'avant : Ctrl+Z les remet
Private annulCases As Collection
Private courant As Collection   ' celles du passage en cours

Private prochain As Date
Private actif As Boolean
Private tours As Long

Public Sub Auto_Open()
    ToDo_Demarrer
End Sub

' lance l'écoute (toutes les secondes, quand Excel est libre)
Public Sub ToDo_Demarrer()
    If actif Then Exit Sub
    actif = True
    CreerDossier
    Planifier
End Sub

Public Sub ToDo_Arreter()
    actif = False
    On Error Resume Next
    Application.OnTime prochain, "'" & ThisWorkbook.Name & "'!ToDo_Tour", , False
    Kill Dossier() & "\alive.txt"
End Sub

Private Sub Planifier()
    prochain = Now + TimeSerial(0, 0, 1)
    Application.OnTime prochain, "'" & ThisWorkbook.Name & "'!ToDo_Tour"
End Sub

Private Function Dossier() As String
    Dossier = Environ$("LOCALAPPDATA") & "\TodoPontExcel\excel"
End Function

Private Sub CreerDossier()
    On Error Resume Next
    MkDir Environ$("LOCALAPPDATA") & "\TodoPontExcel"
    MkDir Dossier()
End Sub

Public Sub ToDo_Tour()
    If Not actif Then Exit Sub
    On Error GoTo suite
    tours = tours + 1
    If tours Mod 10 = 1 Then EcrireTexte Dossier() & "\alive.txt", Format$(Now, "yyyy-mm-dd hh:nn:ss")
    Dim f As String, n As Long, ecrit As Boolean, r As Long
    Set courant = New Collection
    f = Dir(Dossier() & "\*.req")
    Do While f <> "" And n < 20
        r = Traiter(Dossier() & "\" & f)
        If r = 2 Then Exit Do   ' tu travailles dans ce fichier : on attend ta pause (la demande reste là)
        If r = 1 Then ecrit = True
        If r = 0 Then
            On Error Resume Next
            Name Dossier() & "\" & f As Dossier() & "\" & f & ".illisible"
            Kill Dossier() & "\" & f
            On Error GoTo suite
        End If
        n = n + 1
        f = Dir(Dossier() & "\*.req")
    Loop
    ' Ctrl+Z juste après : remet les cases que le complément vient d'écrire
    If courant.Count > 0 Then Set annulCases = courant: Application.OnUndo "Annuler l'écriture ToDo", "'" & ThisWorkbook.Name & "'!ToDo_Annuler"
suite:
    Planifier
End Sub

' 0 illisible, 1 traitée, 2 remise à plus tard (tu es en train de travailler dans le fichier visé)
Private Function Traiter(ByVal chemin As String) As Long
    Dim txt As String, id As String, res As String
    On Error Resume Next
    txt = LireTexte(chemin)
    If Err.Number <> 0 Then Exit Function
    If TuTravaillesDedans(txt) And DateDiff("s", FileDateTime(chemin), Now) < ATTENTE_MAX Then Traiter = 2: Exit Function
    On Error GoTo 0
    On Error Resume Next
    Kill chemin
    On Error GoTo 0
    id = Mid$(chemin, InStrRev(chemin, "\") + 1)
    id = Left$(id, Len(id) - 4)
    res = Executer(txt)
    On Error Resume Next
    Kill Dossier() & "\" & id & ".res"
    EcrireTexte Dossier() & "\" & id & ".tmp", res
    Name Dossier() & "\" & id & ".tmp" As Dossier() & "\" & id & ".res"
    Traiter = 1
End Function

' le fichier visé est la fenêtre active d'Excel et tu as tapé ou cliqué il y a moins de 20 s
Private Function TuTravaillesDedans(ByVal txt As String) As Boolean
    Dim l As Variant, fichier As String, info As DERNIERE_ACTION
    For Each l In Split(Replace(txt, vbCr, ""), vbLf)
        If Left$(l, 5) = "FILE" & vbTab Then fichier = LCase$(Desechapper(Mid$(l, 6))): Exit For
    Next
    If Len(fichier) = 0 Or Application.ActiveWorkbook Is Nothing Then Exit Function
    If LCase$(Application.ActiveWorkbook.Name) <> fichier Then Exit Function
    info.cbSize = Len(info)
    If GetLastInputInfo(info) = 0 Then Exit Function
    TuTravaillesDedans = (GetTickCount() - info.dwTime) < PAUSE_SECONDES * 1000&
End Function

' Ctrl+Z après une écriture du complément : chaque case reprend son contenu d'avant
Public Sub ToDo_Annuler()
    Dim it As Variant
    On Error Resume Next
    If annulCases Is Nothing Then Exit Sub
    For Each it In annulCases
        With Application.Workbooks(it(0)).Worksheets(it(1)).Range(it(2))
            If Len(it(3)) > 0 Then .Formula = it(3) Else .ClearContents
        End With
    Next
    Set annulCases = New Collection
End Sub

' une demande : FILE / PATH / SHEET / HEADER, puis ROW, NEW et SET, une par ligne (séparateur : tabulation)
Private Function Executer(ByVal txt As String) As String
    Dim lignes() As String, p() As String, i As Long, ok As Long
    Dim fichier As String, chemin As String, feuille As String, entete As String
    Dim wb As Workbook, lo As ListObject, lignesTab As Object, c As Range, sortie As String
    Set lignesTab = CreateObject("Scripting.Dictionary")
    On Error GoTo erreur
    lignes = Split(Replace(txt, vbCr, ""), vbLf)
    For i = 0 To UBound(lignes)
        If Len(lignes(i)) = 0 Then GoTo suivante
        p = Split(lignes(i), vbTab)
        Select Case p(0)
        Case "FILE": fichier = Desechapper(p(1))
        Case "PATH": chemin = Desechapper(p(1))
        Case "SHEET": feuille = Desechapper(p(1))
        Case "HEADER"
            entete = Desechapper(p(1))
            Set wb = Classeur(fichier, chemin)
            If wb Is Nothing Then Executer = "ERR" & vbTab & i & vbTab & Echapper("« " & fichier & " » introuvable : ouvre-le dans Excel, puis renvoie depuis l'appli."): Exit Function
            Set lo = Tableau(wb, feuille, entete)
            If lo Is Nothing Then Executer = "ERR" & vbTab & i & vbTab & Echapper("Tableau de l'onglet « " & feuille & " » (colonne « " & entete & " ») introuvable dans « " & wb.Name & " » : rien n'est écrit."): Exit Function
        Case "ROW"
            If lo Is Nothing Then GoTo sansTableau
            Dim r As Range
            Set r = TrouverLigne(lo, p)
            If r Is Nothing Then Executer = sortie & "ERR" & vbTab & i & vbTab & Echapper("Ligne introuvable dans le tableau (" & Desechapper(DernierElement(p)) & ") : elle a peut-être été renommée ou supprimée. Rien n'est écrit pour elle."): Exit Function
            Set lignesTab(p(1)) = r
        Case "NEW"
            If lo Is Nothing Then GoTo sansTableau
            Set lignesTab(p(1)) = lo.ListRows.Add.Range
        Case "SET"
            If lo Is Nothing Then GoTo sansTableau
            Set c = Cellule(lo, lignesTab(p(1)), Desechapper(p(2)))
            If c Is Nothing Then Executer = sortie & "ERR" & vbTab & i & vbTab & Echapper("Colonne « " & Desechapper(p(2)) & " » introuvable dans le tableau : rien n'est écrit."): Exit Function
            If c.HasFormula Then
                ' une formule n'est jamais remplacée
            ElseIf Pareil(c.Value, p(5), Desechapper(p(6))) Then
                ok = ok + 1   ' déjà la bonne valeur (écrite juste avant) : rien à faire
            ElseIf Pareil(c.Value, p(3), Desechapper(p(4))) Then
                If Not courant Is Nothing Then courant.Add Array(wb.Name, c.Worksheet.Name, c.Address, c.Formula)
                Ecrire c, p(5), Desechapper(p(6))
                ok = ok + 1
            Else
                sortie = sortie & "CONFLICT" & vbTab & i & vbTab & Echapper(CStr(c.Text)) & vbTab & Echapper(Desechapper(p(2))) & vbLf
            End If
        End Select
suivante:
    Next i
    ' enregistrement automatique coupé : enregistré ici (le pont relit le fichier sur le disque)
    If Not wb Is Nothing Then
        Dim estAuto As Boolean
        On Error Resume Next
        estAuto = wb.AutoSaveOn
        If Not estAuto Then wb.Save
        On Error GoTo erreur
    End If
    Executer = sortie & "DONE" & vbTab & ok
    Exit Function
sansTableau:
    Executer = "ERR" & vbTab & i & vbTab & Echapper("Demande incomplète (pas de tableau désigné) : rien n'est écrit.")
    Exit Function
erreur:
    Executer = sortie & "ERR" & vbTab & i & vbTab & Echapper("Excel : " & Err.Description)
End Function

Private Function DernierElement(p() As String) As String
    DernierElement = p(UBound(p))
End Function

' le classeur, s'il est ouvert ; sinon ouvert depuis son chemin
Private Function Classeur(ByVal nom As String, ByVal chemin As String) As Workbook
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If LCase$(wb.Name) = LCase$(nom) Then Set Classeur = wb: Exit Function
    Next
    If Len(chemin) > 0 Then
        If Len(Dir(chemin)) > 0 Then
            On Error Resume Next
            Set Classeur = Application.Workbooks.Open(Filename:=chemin, UpdateLinks:=0)
            ' ouvert en lecture seule (déjà ouvert ailleurs, verrouillé) : refermé, rien n'est écrit dans une copie
            If Not Classeur Is Nothing Then
                If Classeur.ReadOnly Then Classeur.Close SaveChanges:=False: Set Classeur = Nothing
            End If
        End If
    End If
End Function

' le tableau de cet onglet seulement, reconnu à sa colonne d'en-tête (jamais un autre onglet)
Private Function Tableau(wb As Workbook, ByVal feuille As String, ByVal entete As String) As ListObject
    Dim ws As Worksheet, lo As ListObject, h As Range
    For Each ws In wb.Worksheets
        If Normer(ws.Name) = Normer(feuille) Then
            For Each lo In ws.ListObjects
                For Each h In lo.HeaderRowRange.Cells
                    If Normer(CStr(h.Value)) = Normer(entete) Then Set Tableau = lo: Exit Function
                Next
            Next
            Exit Function
        End If
    Next
End Function

' ROW <ref> <ligne Excel> EMPTY | KEY <en-tête> <valeur> [<en-tête> <valeur>]
Private Function TrouverLigne(lo As ListObject, p() As String) As Range
    Dim ligne As Long, idx As Long, row As Range, lr As ListRow, trouve As Range, n As Long
    ligne = CLng(p(2))
    If lo.ListRows.Count > 0 Then
        idx = ligne - lo.DataBodyRange.Row + 1
        If idx >= 1 And idx <= lo.ListRows.Count Then Set row = lo.ListRows(idx).Range
    End If
    If p(3) = "EMPTY" Then
        ' une ligne vide prévue par le pont : encore vide, sinon une nouvelle ligne (jamais celle d'un collègue)
        If Not row Is Nothing Then
            If LigneVide(row) Then Set TrouverLigne = row: Exit Function
        End If
        Set TrouverLigne = lo.ListRows.Add.Range
        Exit Function
    End If
    If Not row Is Nothing Then
        If Cle(lo, row, p) Then Set TrouverLigne = row: Exit Function
    End If
    ' la ligne a bougé (tri, insertion) : retrouvée par sa clé, si elle est unique
    For Each lr In lo.ListRows
        If Cle(lo, lr.Range, p) Then Set trouve = lr.Range: n = n + 1
    Next
    If n = 1 Then Set TrouverLigne = trouve
End Function

Private Function Cle(lo As ListObject, row As Range, p() As String) As Boolean
    Dim k As Long, c As Range
    If UBound(p) < 5 Then Exit Function
    For k = 4 To UBound(p) - 1 Step 2
        Set c = Cellule(lo, row, Desechapper(p(k)))
        If c Is Nothing Then Exit Function
        If IsError(c.Value) Then Exit Function
        If LCase$(Trim$(CStr(c.Value))) <> LCase$(Trim$(Desechapper(p(k + 1)))) Then Exit Function
    Next
    Cle = True
End Function

Private Function LigneVide(row As Range) As Boolean
    Dim c As Range
    For Each c In row.Cells
        If Not c.HasFormula Then
            If Not IsEmpty(c.Value) Then
                If VarType(c.Value) = vbBoolean Then
                    If c.Value Then Exit Function
                ElseIf Len(Trim$(CStr(c.Value))) > 0 Then
                    Exit Function
                End If
            End If
        End If
    Next
    LigneVide = True
End Function

Private Function Cellule(lo As ListObject, row As Range, ByVal entete As String) As Range
    Dim h As Range, j As Long
    If row Is Nothing Then Exit Function
    j = 0
    For Each h In lo.HeaderRowRange.Cells
        j = j + 1
        If Normer(CStr(h.Value)) = Normer(entete) Then Set Cellule = row.Cells(1, j): Exit Function
    Next
End Function

' la case contient-elle encore ce que le pont a vu ? (e vide, n nombre, d date, b oui/non, s texte)
Private Function Pareil(ByVal v As Variant, ByVal t As String, ByVal s As String) As Boolean
    If IsError(v) Then Exit Function
    Select Case t
    Case "e"
        Pareil = IsEmpty(v) Or Len(Trim$(CStr(v))) = 0
    Case "n"
        If Not IsEmpty(v) And IsNumeric(v) And VarType(v) <> vbString Then Pareil = Abs(CDbl(v) - Val(s)) < 0.000001
    Case "d"
        If IsDate(v) Or (IsNumeric(v) And Not IsEmpty(v)) Then Pareil = (Int(CDbl(v)) = Int(Val(s)))
    Case "b"
        If VarType(v) = vbBoolean Then Pareil = (v = (s = "1"))
    Case Else
        Pareil = (Trim$(CStr(v)) = Trim$(s))
    End Select
End Function

Private Sub Ecrire(c As Range, ByVal t As String, ByVal s As String)
    Select Case t
    Case "e": c.ClearContents
    Case "n": c.Value = Val(s)
    Case "d": c.Value = CDate(Val(s))
    Case "b": c.Value = (s = "1")
    Case Else
        If Len(s) > 0 And InStr("=+-@", Left$(s, 1)) > 0 Then c.Value = "'" & s Else c.Value = s
    End Select
End Sub

Private Function Normer(ByVal s As String) As String
    s = Replace(Replace(Replace(s, vbCrLf, " "), vbLf, " "), vbCr, " ")
    Do While InStr(s, "  ") > 0: s = Replace(s, "  ", " "): Loop
    Normer = LCase$(Trim$(s))
End Function

Private Function Echapper(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, vbTab, "\t")
    s = Replace(s, vbLf, "\n")
    Echapper = Replace(s, vbCr, "\r")
End Function

Private Function Desechapper(ByVal s As String) As String
    Dim i As Long, ch As String, out As String
    i = 1
    Do While i <= Len(s)
        ch = Mid$(s, i, 1)
        If ch = "\" And i < Len(s) Then
            i = i + 1
            Select Case Mid$(s, i, 1)
            Case "t": out = out & vbTab
            Case "n": out = out & vbLf
            Case "r": out = out & vbCr
            Case Else: out = out & Mid$(s, i, 1)
            End Select
        Else
            out = out & ch
        End If
        i = i + 1
    Loop
    Desechapper = out
End Function

Private Function LireTexte(ByVal chemin As String) As String
    Dim st As Object
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2: st.Charset = "utf-8": st.Open
    st.LoadFromFile chemin
    LireTexte = st.ReadText
    st.Close
End Function

Private Sub EcrireTexte(ByVal chemin As String, ByVal txt As String)
    Dim st As Object
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2: st.Charset = "utf-8": st.Open
    st.WriteText txt
    st.SaveToFile chemin, 2
    st.Close
End Sub


' ==========================================================================================
'  Auto-test : ToDo_AutoTest. Crée un classeur de test (dossier TEMP) qui imite le Suivi (tableau,
'  ligne Total, liste déroulante, mise en forme conditionnelle, colonne calculée, un autre onglet),
'  y fait passer des écritures comme le pont, et vérifie le résultat. Aucun vrai fichier n'est touché.
' ==========================================================================================
Private rapport As String, nOk As Long, nKo As Long

Private Sub Verifier(ByVal nom As String, ByVal cond As Boolean, Optional ByVal detail As String = "")
    If cond Then
        nOk = nOk + 1: rapport = rapport & "OK      " & nom & vbLf
    Else
        nKo = nKo + 1: rapport = rapport & "ECHEC   " & nom
        If Len(detail) > 0 Then rapport = rapport & " (" & Replace(detail, vbLf, " | ") & ")"
        rapport = rapport & vbLf
    End If
End Sub

Private Function Cl(ByVal prod As String, ByVal cent As String) As String
    Cl = "KEY" & vbTab & "Nom_prod" & vbTab & prod & vbTab & "Nom_Installation_prod" & vbTab & cent
End Function

Private Function Ord(ParamArray parts() As Variant) As String
    Dim i As Long, s As String
    For i = LBound(parts) To UBound(parts)
        If i > LBound(parts) Then s = s & vbTab
        s = s & parts(i)
    Next
    Ord = s & vbLf
End Function

Public Sub ToDo_AutoTest()
    Dim wb As Workbook, ws As Worksheet, cst As Worksheet, rp As Worksheet, lo As ListObject
    Dim chemin As String, base As String, res As String, etape As String, l As Variant, i As Long, nCf As Long
    rapport = "Auto-test du complément ToDo - " & Format$(Now, "dd/mm/yyyy hh:nn") & " - Excel " & Application.Version & vbLf
    nOk = 0: nKo = 0
    On Error GoTo plante
    etape = "création du classeur de test"
    Application.ScreenUpdating = False
    Set wb = Application.Workbooks.Add(xlWBATWorksheet)
    Set ws = wb.Worksheets(1): ws.Name = "BDD Agrégation"
    Set cst = wb.Worksheets.Add(After:=ws): cst.Name = "Cst"
    cst.Range("A1").Value = "En attente": cst.Range("A2").Value = "Gagné": cst.Range("A3").Value = "Perdu"
    cst.Range("C1").Value = "ne pas toucher"
    ws.Range("A3").Value = "Titre de bloc"
    ws.Range("A4:G4").Value = Array("Nom_prod", "Nom_Installation_prod", "Statut", "P_installée (KWc)", "Date_fin", "Double", "Commentaire")
    ws.Range("A5:E5").Value = Array("PROD A", "CENTRALE A", "En attente", 100, DateSerial(2030, 12, 31))
    ws.Range("A6:E6").Value = Array("PROD B", "CENTRALE B", "Perdu", 50, DateSerial(2029, 6, 30))
    ws.Range("A7:D7").Value = Array("PROD C", "CENTRALE C", "Gagné", 70)
    ws.Range("G5").Value = "rien": ws.Range("G6").Value = "collègue"
    Set lo = ws.ListObjects.Add(xlSrcRange, ws.Range("A4:G7"), , xlYes)
    lo.ListColumns("Double").DataBodyRange.Formula = "=[@[P_installée (KWc)]]*2"
    lo.ShowTotals = True
    lo.ListColumns("P_installée (KWc)").TotalsCalculation = xlTotalsCalculationSum
    lo.ListColumns("Statut").DataBodyRange.Validation.Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:="=Cst!$A$1:$A$3"
    lo.DataBodyRange.FormatConditions.Add(Type:=xlExpression, Formula1:="=$C5=""Gagné""").Interior.Color = RGB(198, 239, 206)
    nCf = ws.Cells.FormatConditions.Count
    chemin = Environ$("TEMP") & "\ToDo_AutoTest_" & Format$(Now, "yyyymmdd_hhnnss") & ".xlsx"
    Application.DisplayAlerts = False
    wb.SaveAs Filename:=chemin, FileFormat:=xlOpenXMLWorkbook
    Application.DisplayAlerts = True
    base = Ord("FILE", Echapper(wb.Name)) & Ord("PATH", Echapper(chemin)) & Ord("SHEET", "BDD Agrégation") & Ord("HEADER", "Nom_prod")

    etape = "1 mise à jour"
    res = Executer(base & Ord("ROW", "r1", "5", Cl("PROD A", "CENTRALE A")) & Ord("SET", "r1", "P_installée (KWc)", "n", "100", "n", "120") & Ord("SET", "r1", "Statut", "s", "En attente", "s", "Gagné"))
    Verifier "Mise à jour d'une ligne existante (nombre et liste)", ws.Range("D5").Value = 120 And ws.Range("C5").Value = "Gagné" And Left$(res, 4) = "DONE", res

    etape = "2 case changée par un collègue"
    res = Executer(base & Ord("ROW", "r1", "6", Cl("PROD B", "CENTRALE B")) & Ord("SET", "r1", "Commentaire", "s", "autre chose", "s", "nouveau"))
    Verifier "Case changée par un collègue : laissée telle quelle et signalée", ws.Range("G6").Value = "collègue" And InStr(res, "CONFLICT") > 0, res

    etape = "3 ligne déplacée"
    res = Executer(base & Ord("ROW", "r1", "6", Cl("PROD C", "CENTRALE C")) & Ord("SET", "r1", "Commentaire", "e", "", "s", "trouvée"))
    Verifier "Ligne qui a bougé : retrouvée par sa clé", ws.Range("G7").Value = "trouvée" And ws.Range("G6").Value = "collègue", res

    etape = "4 nouvelle ligne"
    res = Executer(base & Ord("NEW", "n1") & Ord("SET", "n1", "Nom_prod", "e", "", "s", "PROD D") & Ord("SET", "n1", "Nom_Installation_prod", "e", "", "s", "CENTRALE D") & _
        Ord("SET", "n1", "P_installée (KWc)", "e", "", "n", "30") & Ord("SET", "n1", "Statut", "e", "", "s", "En attente"))
    Verifier "Nouvelle ligne ajoutée dans le tableau", lo.ListRows.Count = 4 And ws.Range("A8").Value = "PROD D" And ws.Range("D8").Value = 30, res
    Verifier "Ligne Total toujours en dernier, avec sa formule", lo.ShowTotals And InStr(LCase$(ws.Range("D9").Formula), "subtotal") > 0 And ws.Range("D9").Value = 270, ws.Range("D9").Formula & " = " & CStr(ws.Range("D9").Value)
    Verifier "Colonne calculée remplie par Excel sur la nouvelle ligne", ws.Range("F8").HasFormula And ws.Range("F8").Value = 60

    etape = "5 formule"
    res = Executer(base & Ord("ROW", "r1", "5", Cl("PROD A", "CENTRALE A")) & Ord("SET", "r1", "Double", "n", "240", "n", "999"))
    Verifier "Une formule n'est jamais remplacée", ws.Range("F5").HasFormula And ws.Range("F5").Value = 240, res

    etape = "6 texte commençant par ="
    res = Executer(base & Ord("ROW", "r1", "5", Cl("PROD A", "CENTRALE A")) & Ord("SET", "r1", "Commentaire", "s", "rien", "s", Echapper("=pas une formule")))
    Verifier "Texte commençant par = gardé comme texte", ws.Range("G5").Text = "=pas une formule" And Not ws.Range("G5").HasFormula, res

    etape = "7 valeur déjà écrite"
    res = Executer(base & Ord("ROW", "r1", "5", Cl("PROD A", "CENTRALE A")) & Ord("SET", "r1", "P_installée (KWc)", "n", "100", "n", "120"))
    Verifier "Valeur déjà écrite juste avant : pas de faux conflit", InStr(res, "CONFLICT") = 0 And Left$(res, 4) = "DONE", res

    etape = "8 onglet inconnu"
    res = Executer(Replace(base, "BDD Agrégation", "Inexistant") & Ord("ROW", "r1", "5", Cl("PROD A", "CENTRALE A")) & Ord("SET", "r1", "Commentaire", "s", "=pas une formule", "s", "NON"))
    Verifier "Onglet inconnu : refusé, rien écrit", Left$(res, 3) = "ERR" And ws.Range("G5").Text = "=pas une formule", res

    etape = "9 ligne vide prévue mais occupée"
    res = Executer(base & Ord("ROW", "r1", "5", "EMPTY") & Ord("SET", "r1", "Nom_prod", "e", "", "s", "PROD E") & Ord("SET", "r1", "Nom_Installation_prod", "e", "", "s", "CENTRALE E"))
    Verifier "Ligne vide prévue mais remplie entre-temps : nouvelle ligne, l'autre intacte", lo.ListRows.Count = 5 And ws.Range("A5").Value = "PROD A" And ws.Range("A9").Value = "PROD E", res

    etape = "10 annulation"
    Set courant = New Collection
    res = Executer(base & Ord("ROW", "r1", "7", Cl("PROD C", "CENTRALE C")) & Ord("SET", "r1", "P_installée (KWc)", "n", "70", "n", "75"))
    Set annulCases = courant: Set courant = Nothing
    ToDo_Annuler
    Verifier "Ctrl+Z (Annuler l'écriture ToDo) remet la valeur d'avant", ws.Range("D7").Value = 70, CStr(ws.Range("D7").Value)

    etape = "11 reste intact"
    Verifier "Autre onglet et titre hors tableau intacts", cst.Range("C1").Value = "ne pas toucher" And ws.Range("A3").Value = "Titre de bloc"
    Verifier "Liste déroulante toujours là", lo.ListColumns("Statut").DataBodyRange.Cells(1, 1).Validation.Type = xlValidateList
    Verifier "Mise en forme conditionnelle toujours là", ws.Cells.FormatConditions.Count >= nCf And nCf > 0, CStr(ws.Cells.FormatConditions.Count)
    GoTo fin
plante:
    nKo = nKo + 1
    rapport = rapport & "ECHEC   le test s'est arrêté à l'étape « " & etape & " » : " & Err.Description & vbLf
    Resume fin
fin:
    On Error Resume Next
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    rapport = rapport & nOk & " OK, " & nKo & " échec(s)" & vbLf
    If Not wb Is Nothing Then
        Set rp = wb.Worksheets.Add(Before:=wb.Worksheets(1)): rp.Name = "Rapport"
        i = 1
        For Each l In Split(rapport, vbLf)
            rp.Cells(i, 1).Value = "'" & l: i = i + 1
        Next
        rp.Columns(1).ColumnWidth = 110
        rp.Activate
        wb.Save
    End If
    MsgBox nOk & " OK, " & nKo & " échec(s)." & vbLf & vbLf & "Le détail est dans l'onglet « Rapport » du classeur de test ToDo_AutoTest (dans le dossier TEMP, aucun vrai fichier touché) : copie la colonne A et envoie-la à Tom.", IIf(nKo = 0, vbInformation, vbExclamation), "Auto-test ToDo"
End Sub
