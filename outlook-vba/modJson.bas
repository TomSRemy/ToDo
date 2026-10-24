Attribute VB_Name = "modJson"
Option Explicit

Public Function JsonEscape(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, Chr(34), "\" & Chr(34))
    s = Replace(s, vbCrLf, "\n")
    s = Replace(s, vbLf, "\n")
    s = Replace(s, vbCr, "\n")
    s = Replace(s, vbTab, "\t")
    JsonEscape = s
End Function

' Ajoute un objet JSON (deja ecrit) a la fin d'un tableau JSON, en texte.
' Sans risque ici : seule la macro et l'appli ecrivent ce fichier.
Public Function AppendJsonItem(ByVal existingJsonArray As String, ByVal newItemJson As String) As String
    Dim trimmed As String
    trimmed = Trim(existingJsonArray)
    If Len(trimmed) = 0 Then trimmed = "[]"

    Dim lastBracket As Long
    lastBracket = InStrRev(trimmed, "]")
    If lastBracket = 0 Then
        AppendJsonItem = "[" & newItemJson & "]"
        Exit Function
    End If

    Dim body As String
    body = Trim(Left(trimmed, lastBracket - 1))
    If Left(body, 1) = "[" Then body = Mid(body, 2)
    body = Trim(body)

    If Len(body) = 0 Then
        AppendJsonItem = "[" & newItemJson & "]"
    Else
        AppendJsonItem = "[" & body & "," & newItemJson & "]"
    End If
End Function
