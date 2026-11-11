Attribute VB_Name = "modLocalInbox"
Option Explicit

' Les mails marques (drapeau, ou categorie "CRM Contact") partent dans un dossier de ce PC,
' par defaut OneDrive\ToDo\boite-mail, que le pont Excel lit pour l'appli : plus de jeton
' GitHub dans la macro, rien ne part sur Internet. Un fichier par mail.
' INBOX_MODE = "github" (dans modConfig) remet l'ancien chemin si besoin.

Public Function InboxFolder() As String
    Dim root As String
    If Len(INBOX_FOLDER) > 0 Then
        InboxFolder = INBOX_FOLDER
    Else
        root = Environ("OneDriveCommercial")
        If Len(root) = 0 Then root = Environ("OneDrive")
        If Len(root) = 0 Then root = CreateObject("WScript.Shell").SpecialFolders("MyDocuments")
        InboxFolder = root & "\ToDo\boite-mail"
    End If
    If Right(InboxFolder, 1) = "\" Then InboxFolder = Left(InboxFolder, Len(InboxFolder) - 1)
End Function

Private Sub EnsureFolder(ByVal folderPath As String)
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If fso.FolderExists(folderPath) Then Exit Sub
    EnsureFolder fso.GetParentFolderName(folderPath)
    fso.CreateFolder folderPath
End Sub

' Ecrit la proposition (texte JSON) dans un nouveau fichier : d'abord sous un nom
' provisoire, puis renomme, pour que le pont ne lise jamais un fichier a moitie ecrit.
Public Function WriteInboxFile(ByVal itemJson As String, ByVal kind As String) As Boolean
    On Error GoTo Fail
    Dim folder As String, fileName As String, tmpPath As String
    folder = InboxFolder()
    EnsureFolder folder
    Randomize
    fileName = kind & "-" & Format(Now, "yyyymmdd-hhnnss") & "-" & Format(Int(Rnd() * 1000000), "000000") & ".json"
    tmpPath = folder & "\" & fileName & ".tmp"
    Dim st As Object
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2
    st.Charset = "utf-8"
    st.Open
    st.WriteText itemJson
    st.SaveToFile tmpPath, 2
    st.Close
    Name tmpPath As folder & "\" & fileName
    WriteInboxFile = True
    Exit Function
Fail:
    MsgBox "Ecriture dans " & InboxFolder() & " impossible : " & Err.Description, vbExclamation
    WriteInboxFile = False
End Function

' Une tache (kind = "task") ou un contact (kind = "contact"), selon INBOX_MODE.
Public Function SendInboxItem(ByVal itemJson As String, ByVal kind As String) As Boolean
    If LCase(INBOX_MODE) = "github" Then
        If kind = "contact" Then
            SendInboxItem = modGitHub.PushItemToGitHubFile(itemJson, CONTACT_INBOX_PATH, "New contact from Outlook")
        Else
            SendInboxItem = modGitHub.PushTaskToGitHub(itemJson)
        End If
    Else
        SendInboxItem = WriteInboxFile(itemJson, kind)
    End If
End Function
