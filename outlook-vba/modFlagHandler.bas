Attribute VB_Name = "modFlagHandler"
Option Explicit

Public Sub ProcessFlaggedMail(ByVal mail As Outlook.MailItem)
    On Error GoTo Fail

    ' Deja traite ? (l'evenement se declenche a chaque modification du mail)
    If InStr(1, mail.Categories, PROCESSED_CATEGORY) > 0 Then Exit Sub

    ' Outlook note "pas de date" par le 1/1/4501. Les drapeaux rapides
    ' (Aujourd'hui, Demain...) ecrivent TaskDueDate, pas FlagDueBy.
    Dim dueStr As String
    Dim defaultUrgency As String
    dueStr = ""
    defaultUrgency = "moyenne"

    If mail.TaskDueDate < #1/1/4501# And mail.TaskDueDate > #1/1/1901# Then
        dueStr = Format(mail.TaskDueDate, "yyyy-mm-dd")
        Dim daysAhead As Long
        daysAhead = DateDiff("d", Date, mail.TaskDueDate)
        If daysAhead <= 0 Then
            defaultUrgency = "critique"
        ElseIf daysAhead = 1 Then
            defaultUrgency = "haute"
        ElseIf daysAhead <= 7 Then
            defaultUrgency = "moyenne"
        Else
            defaultUrgency = "basse"
        End If
    End If

    Dim bodyPreview As String
    bodyPreview = ExtractSmartPreview(mail.Body)

    Dim clientGuess As String
    clientGuess = GuessClientFromSender(mail)

    ' La fenetre de saisie
    Dim frm As frmTaskCapture
    Set frm = New frmTaskCapture
    frm.InitFromMail mail.Subject, dueStr, defaultUrgency, bodyPreview, clientGuess
    frm.Show vbModal

    If Not frm.Confirmed Then
        mail.Categories = AddCategory(mail.Categories, PROCESSED_CATEGORY)
        mail.Save
        Unload frm
        Set frm = Nothing
        Exit Sub
    End If

    Dim taskTitle As String, taskDesc As String
    Dim taskClient As String, taskProject As String, taskUrgency As String
    taskTitle = frm.TitleValue
    taskDesc = frm.DescriptionValue
    taskClient = frm.ClientValue
    taskProject = frm.ProjectValue
    taskUrgency = frm.UrgencyValue
    Unload frm
    Set frm = Nothing

    ' Pieces jointes enregistrees en local (de preference dans OneDrive)
    Dim attachNote As String
    attachNote = SaveAttachments(mail)

    Dim descForJson As String
    descForJson = taskDesc
    If Len(attachNote) > 0 Then
        descForJson = descForJson & vbCrLf & "Fichier(s) joint(s) : " & attachNote
    End If

    ' Lien pour rouvrir le mail dans Outlook (classique)
    Dim mailLink As String
    mailLink = "outlook:" & mail.EntryID

    Dim itemId As String
    itemId = "inbox_" & Format(Now, "yyyymmddhhnnss") & "_" & Left(mail.EntryID, 8)

    Dim itemJson As String
    itemJson = "{" & _
        """id"":""" & modJson.JsonEscape(itemId) & """," & _
        """title"":""" & modJson.JsonEscape(taskTitle) & """," & _
        """description"":""" & modJson.JsonEscape(descForJson) & """," & _
        """sender"":""" & modJson.JsonEscape(mail.SenderName) & """," & _
        """client"":""" & modJson.JsonEscape(taskClient) & """," & _
        """project"":""" & modJson.JsonEscape(taskProject) & """," & _
        """urgency"":""" & modJson.JsonEscape(taskUrgency) & """," & _
        """due"":""" & modJson.JsonEscape(dueStr) & """," & _
        """link"":""" & modJson.JsonEscape(mailLink) & """," & _
        """receivedAt"":""" & modJson.JsonEscape(Format(mail.ReceivedTime, "yyyy-mm-dd hh:nn")) & """," & _
        """importedAt"":""" & modJson.JsonEscape(Format(Now, "yyyy-mm-dd hh:nn:ss")) & """" & _
        "}"

    Dim ok As Boolean
    ok = modGitHub.PushTaskToGitHub(itemJson)

    If ok Then
        mail.Categories = AddCategory(mail.Categories, PROCESSED_CATEGORY)
        mail.Save
        MsgBox "Tache envoyee a l'appli : " & taskTitle, vbInformation
    Else
        MsgBox "Envoi vers GitHub impossible. Verifie la connexion et le jeton dans modConfig.", vbExclamation
    End If

    Exit Sub

Fail:
    MsgBox "Erreur pendant le traitement du mail : " & Err.Description, vbExclamation
End Sub

Private Function SaveAttachments(ByVal mail As Outlook.MailItem) As String
    If mail.Attachments.Count = 0 Then
        SaveAttachments = ""
        Exit Function
    End If

    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")

    If Not fso.FolderExists(ATTACHMENT_FOLDER) Then
        fso.CreateFolder ATTACHMENT_FOLDER
    End If

    Dim subFolder As String
    subFolder = ATTACHMENT_FOLDER & Format(Now, "yyyymmdd_hhnnss") & "\"
    fso.CreateFolder subFolder

    Dim names As String
    names = ""

    Dim att As Outlook.Attachment
    Dim i As Long
    For i = 1 To mail.Attachments.Count
        Set att = mail.Attachments(i)
        If Len(att.FileName) > 0 Then
            att.SaveAsFile subFolder & att.FileName
            If Len(names) > 0 Then names = names & ", "
            names = names & att.FileName
        End If
    Next i

    SaveAttachments = names
End Function

' Devine le client d'apres le domaine de l'expediteur : tout ce qui n'est
' ni ton domaine ni une messagerie grand public (Gmail, Orange...).
Public Function GuessClientFromSender(ByVal mail As Outlook.MailItem) As String
    On Error GoTo Fail

    Dim addr As String
    addr = SenderSmtp(mail)
    If Len(addr) = 0 Or InStr(addr, "@") = 0 Then GoTo Fail

    Dim domain As String
    domain = LCase(Mid(addr, InStr(addr, "@") + 1))

    If InStr(domain, LCase(OWN_DOMAIN)) > 0 Then GoTo Fail

    Dim freeProviders As Variant
    freeProviders = Array("gmail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr", _
        "yahoo.com", "yahoo.fr", "free.fr", "orange.fr", "laposte.net", "icloud.com", _
        "live.com", "msn.com", "wanadoo.fr", "sfr.fr", "bbox.fr")
    Dim k As Long
    For k = 0 To UBound(freeProviders)
        If domain = freeProviders(k) Then GoTo Fail
    Next k

    Dim parts() As String
    parts = Split(domain, ".")
    Dim mainPart As String
    If UBound(parts) >= 2 Then
        mainPart = parts(UBound(parts) - 1)
    Else
        mainPart = parts(0)
    End If
    If Len(mainPart) = 0 Then GoTo Fail

    GuessClientFromSender = UCase(Left(mainPart, 1)) & Mid(mainPart, 2)
    Exit Function

Fail:
    GuessClientFromSender = ""
End Function

' L'adresse de l'expediteur en clair (dans une entreprise, Exchange donne
' parfois une adresse interne "/O=..." au lieu de nom@domaine).
Public Function SenderSmtp(ByVal mail As Outlook.MailItem) As String
    On Error Resume Next
    Dim addr As String
    addr = mail.SenderEmailAddress
    If InStr(addr, "@") = 0 Then
        Dim exu As Object
        Set exu = mail.Sender.GetExchangeUser
        If Not exu Is Nothing Then addr = exu.PrimarySmtpAddress
    End If
    SenderSmtp = addr
End Function

Public Function AddCategory(ByVal existing As String, ByVal newCat As String) As String
    If Len(Trim(existing)) = 0 Then
        AddCategory = newCat
    ElseIf InStr(1, existing, newCat) = 0 Then
        AddCategory = existing & "; " & newCat
    Else
        AddCategory = existing
    End If
End Function

' Le debut d'une reponse citee : "De :", "From:", "-----Original",
' "Le lun. 12 oct. ... a ecrit :", "On Mon, ... wrote:".
Public Function IsReplyHeader(ByVal lowerLine As String) As Boolean
    IsReplyHeader = (InStr(1, lowerLine, "-----original") = 1) Or (InStr(1, lowerLine, "de :") = 1) _
        Or (InStr(1, lowerLine, "de:") = 1) Or (InStr(1, lowerLine, "from:") = 1) _
        Or (InStr(1, lowerLine, "envoy") = 1 And InStr(1, lowerLine, ":") > 0 And Len(lowerLine) < 60) _
        Or (InStr(1, lowerLine, "le ") = 1 And InStr(1, lowerLine, "crit") > 0) _
        Or (InStr(1, lowerLine, "on ") = 1 And InStr(1, lowerLine, "wrote") > 0)
End Function

' L'essentiel plutot que tout le mail : la premiere vraie phrase (apres
' "Bonjour,") et, s'il y en a une, la premiere ligne qui demande quelque
' chose. S'arrete a la signature ou au debut d'une reponse citee.
Private Function ExtractSmartPreview(ByVal body As String, Optional ByVal limit As Long = 220) As String
    Dim s As String
    s = Replace(body, vbCrLf, vbLf)
    Dim lines() As String
    lines = Split(s, vbLf)

    Dim greetWords As Variant
    greetWords = Array("bonjour", "cher ", "ch" & ChrW(232) & "re ", "chers ", "salut", "hello", "hi ", "madame", "monsieur", "coucou")

    Dim actionWords As Variant
    actionWords = Array("merci de", "pouvez-vous", "pourriez-vous", "peux-tu", "peux tu", _
        "il faut", "besoin de", "stp", "svp", "urgent", "avant le", "d'ici", _
        "deadline", "action requise", "merci d'avance", "merci beaucoup de")

    Dim stopWords As Variant
    stopWords = Array("cordialement", "bien " & ChrW(224) & " vous", "bien cordialement", _
        "envoy" & ChrW(233) & " de mon", "sent from my")

    Dim gist As String, actionLine As String
    Dim i As Long, j As Long
    Dim trimmedLine As String, lowerLine As String

    For i = 0 To UBound(lines)
        trimmedLine = Trim(lines(i))
        If Len(trimmedLine) = 0 Then GoTo ContinueLoop
        lowerLine = LCase(trimmedLine)

        ' Signature ou reponse citee : on s'arrete
        If IsReplyHeader(lowerLine) Then GoTo Done
        For j = 0 To UBound(stopWords)
            If InStr(1, lowerLine, stopWords(j)) = 1 Then GoTo Done
        Next j

        ' La premiere vraie phrase (pas une salutation)
        If Len(gist) = 0 And Len(trimmedLine) >= 8 Then
            Dim isGreeting As Boolean
            isGreeting = False
            For j = 0 To UBound(greetWords)
                If InStr(1, lowerLine, greetWords(j)) = 1 Then isGreeting = True: Exit For
            Next j
            If Not isGreeting Then gist = trimmedLine
        End If

        ' La premiere ligne qui demande quelque chose
        If Len(actionLine) = 0 Then
            For j = 0 To UBound(actionWords)
                If InStr(1, lowerLine, actionWords(j)) > 0 Then actionLine = trimmedLine: Exit For
            Next j
        End If

        If Len(gist) > 0 And Len(actionLine) > 0 Then GoTo Done
ContinueLoop:
    Next i

Done:
    Dim result As String
    result = gist
    If Len(actionLine) > 0 And actionLine <> gist Then
        If Len(result) > 0 Then result = result & vbCrLf
        result = result & "-> " & actionLine
    End If
    If Len(result) > limit Then result = Left(result, limit) & "..."
    ExtractSmartPreview = result
End Function
