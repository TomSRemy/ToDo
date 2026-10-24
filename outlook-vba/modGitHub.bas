Attribute VB_Name = "modGitHub"
Option Explicit

Private Function ApiUrl(ByVal filePath As String) As String
    ApiUrl = "https://api.github.com/repos/" & GITHUB_OWNER & "/" & GITHUB_REPO & _
             "/contents/" & filePath & "?ref=" & GITHUB_BRANCH
End Function

' Lit data/tasks-inbox.json sur GitHub, ajoute une proposition, le reecrit.
Public Function PushTaskToGitHub(ByVal itemJson As String) As Boolean
    PushTaskToGitHub = PushItemToGitHubFile(itemJson, GITHUB_FILE_PATH, "New task from Outlook")
End Function

' Meme chose pour un autre fichier tableau JSON (la file des contacts).
Public Function PushItemToGitHubFile(ByVal itemJson As String, ByVal filePath As String, ByVal commitMsg As String) As Boolean
    On Error GoTo ErrHandler

    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")

    ' 1) lire le fichier actuel (son "sha" et son contenu)
    http.Open "GET", ApiUrl(filePath), False
    http.SetRequestHeader "Authorization", "Bearer " & GITHUB_TOKEN
    http.SetRequestHeader "Accept", "application/vnd.github+json"
    http.Send
    If http.Status <> 200 Then
        MsgBox "GitHub, lecture : " & http.Status & vbCrLf & http.ResponseText
        PushItemToGitHubFile = False
        Exit Function
    End If

    Dim respText As String
    respText = http.ResponseText

    Dim sha As String
    sha = ExtractJsonStringValue(respText, "sha")

    Dim contentB64 As String
    contentB64 = ExtractJsonStringValue(respText, "content")
    contentB64 = Replace(contentB64, "\n", "")

    Dim decodedBytes() As Byte
    decodedBytes = modBase64.Base64Decode(contentB64)
    Dim currentJson As String
    currentJson = modBase64.Utf8BytesToString(decodedBytes)

    ' 2) ajouter la proposition
    Dim newJson As String
    newJson = modJson.AppendJsonItem(currentJson, itemJson)

    Dim newBytes() As Byte
    newBytes = modBase64.StringToUtf8Bytes(newJson)
    Dim newB64 As String
    newB64 = modBase64.Base64Encode(newBytes)

    ' 3) reecrire le fichier
    Dim payload As String
    payload = "{""message"":""" & commitMsg & """," & _
              """content"":""" & newB64 & """," & _
              """sha"":""" & sha & """," & _
              """branch"":""" & GITHUB_BRANCH & """}"

    http.Open "PUT", ApiUrl(filePath), False
    http.SetRequestHeader "Authorization", "Bearer " & GITHUB_TOKEN
    http.SetRequestHeader "Accept", "application/vnd.github+json"
    http.SetRequestHeader "Content-Type", "application/json"
    http.Send payload

    If http.Status = 200 Or http.Status = 201 Then
        PushItemToGitHubFile = True
    Else
        MsgBox "GitHub, ecriture : " & http.Status & vbCrLf & http.ResponseText
        PushItemToGitHubFile = False
    End If
    Exit Function

ErrHandler:
    MsgBox "Erreur VBA " & Err.Number & " : " & Err.Description
    PushItemToGitHubFile = False
End Function

' Lecteur minimal d'une cle texte de premier niveau : suffisant ici, la
' reponse de GitHub donne "sha" et "content" en simples chaines.
Private Function ExtractJsonStringValue(ByVal json As String, ByVal key As String) As String
    Dim marker As String
    marker = """" & key & """:"""
    Dim startPos As Long
    startPos = InStr(json, marker)
    If startPos = 0 Then Exit Function
    startPos = startPos + Len(marker)
    Dim endPos As Long
    endPos = InStr(startPos, json, """")
    If endPos = 0 Then Exit Function
    ExtractJsonStringValue = Mid(json, startPos, endPos - startPos)
End Function
