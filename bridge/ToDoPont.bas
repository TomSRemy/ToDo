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
    Dim f As String, n As Long
    f = Dir(Dossier() & "\*.req")
    Do While f <> "" And n < 20
        Traiter Dossier() & "\" & f
        n = n + 1
        f = Dir(Dossier() & "\*.req")
    Loop
suite:
    Planifier
End Sub

Private Sub Traiter(ByVal chemin As String)
    Dim txt As String, id As String, res As String
    txt = LireTexte(chemin)
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
            ElseIf Pareil(c.Value, p(3), Desechapper(p(4))) Then
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
            Set Classeur = Application.Workbooks.Open(chemin)
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
