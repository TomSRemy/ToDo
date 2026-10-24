Attribute VB_Name = "modContactCapture"
Option Explicit

' Categorie "CRM Contact" sur un mail : propose son expediteur comme contact
' dans l'appli (file "Contacts", bouton "Importer"). Pour un mail transfere
' (TR:, Fwd:...), c'est la personne presentee dans le mail qui compte :
' l'appli lit le texte envoye ("signature") et en tire nom, societe,
' fonction, mail et telephones. Rien n'est cree sans ta validation.
Public Sub ProcessContactCapture(ByVal mail As Outlook.MailItem)
    On Error GoTo Fail

    If InStr(1, mail.Categories, CONTACT_PROCESSED_CATEGORY) > 0 Then Exit Sub

    Dim subj As String
    subj = LCase(Trim(mail.Subject))
    Dim forwarded As Boolean
    forwarded = (InStr(1, subj, "tr:") = 1) Or (InStr(1, subj, "tr :") = 1) Or (InStr(1, subj, "fw:") = 1) _
        Or (InStr(1, subj, "fwd:") = 1) Or (InStr(1, subj, "transf") = 1)

    Dim firstName As String, lastName As String, nm As String
    nm = Trim(mail.SenderName)
    If InStr(nm, ",") > 0 Then
        ' "NOM, Prenom" (annuaire d'entreprise)
        lastName = Trim(Left(nm, InStr(nm, ",") - 1))
        firstName = Trim(Mid(nm, InStr(nm, ",") + 1))
    ElseIf InStr(nm, " ") > 0 Then
        firstName = Trim(Left(nm, InStr(nm, " ") - 1))
        lastName = Trim(Mid(nm, InStr(nm, " ") + 1))
    Else
        firstName = nm
    End If

    Dim itemId As String
    itemId = "ct_" & Format(Now, "yyyymmddhhnnss") & "_" & Left(mail.EntryID, 8)

    Dim itemJson As String
    itemJson = "{" & _
        """id"":""" & modJson.JsonEscape(itemId) & """," & _
        """firstName"":""" & modJson.JsonEscape(IIf(forwarded, "", firstName)) & """," & _
        """lastName"":""" & modJson.JsonEscape(IIf(forwarded, "", lastName)) & """," & _
        """email"":""" & modJson.JsonEscape(IIf(forwarded, "", LCase(modFlagHandler.SenderSmtp(mail)))) & """," & _
        """company"":""" & modJson.JsonEscape(IIf(forwarded, "", modFlagHandler.GuessClientFromSender(mail))) & """," & _
        """role"":""""," & _
        """phone1"":""""," & _
        """forwarded"":" & IIf(forwarded, "true", "false") & "," & _
        """signature"":""" & modJson.JsonEscape(SignaturePart(mail.Body, forwarded)) & """," & _
        """link"":""" & modJson.JsonEscape("outlook:" & mail.EntryID) & """," & _
        """receivedAt"":""" & modJson.JsonEscape(Format(mail.ReceivedTime, "yyyy-mm-dd hh:nn")) & """" & _
        "}"

    If modGitHub.PushItemToGitHubFile(itemJson, CONTACT_INBOX_PATH, "New contact from Outlook") Then
        mail.Categories = modFlagHandler.AddCategory(mail.Categories, CONTACT_PROCESSED_CATEGORY)
        mail.Save
    Else
        MsgBox "Envoi du contact vers GitHub impossible. Verifie la connexion et le jeton dans modConfig.", vbExclamation
    End If
    Exit Sub

Fail:
    MsgBox "Erreur pendant la capture du contact : " & Err.Description, vbExclamation
End Sub

' Le texte ou se trouve la signature : la fin du mail avant la premiere
' reponse citee (mail direct), ou le mail transfere en entier (presentation).
' Limite a 1 500 caracteres.
Private Function SignaturePart(ByVal body As String, ByVal forwarded As Boolean) As String
    Dim s As String
    s = Replace(body, vbCrLf, vbLf)
    If Not forwarded Then
        Dim lines() As String, i As Long, cut As Long
        lines = Split(s, vbLf)
        cut = UBound(lines)
        For i = 0 To UBound(lines)
            If modFlagHandler.IsReplyHeader(LCase(Trim(lines(i)))) Then cut = i - 1: Exit For
        Next i
        Dim outText As String, startAt As Long
        startAt = cut - 14
        If startAt < 0 Then startAt = 0
        For i = startAt To cut
            outText = outText & lines(i) & vbLf
        Next i
        s = outText
    End If
    If Len(s) > 1500 Then s = Left(s, 1500)
    SignaturePart = Trim(s)
End Function
