Attribute VB_Name = "modBase64"
Option Explicit

Public Function Base64Encode(ByRef bytes() As Byte) As String
    Dim objNode As Object
    Dim objXML As Object
    Set objXML = CreateObject("MSXML2.DOMDocument")
    Set objNode = objXML.createElement("b64")
    objNode.DataType = "bin.base64"
    objNode.nodeTypedValue = bytes
    Dim raw As String
    raw = objNode.Text
    ' MSXML coupe le base64 tous les 76 caracteres : on retire les retours
    ' a la ligne, sinon le JSON envoye a GitHub est invalide.
    raw = Replace(raw, vbCrLf, "")
    raw = Replace(raw, vbLf, "")
    raw = Replace(raw, vbCr, "")
    Base64Encode = raw
    Set objNode = Nothing
    Set objXML = Nothing
End Function

Public Function Base64Decode(ByVal base64String As String) As Byte()
    Dim objNode As Object
    Dim objXML As Object
    Set objXML = CreateObject("MSXML2.DOMDocument")
    Set objNode = objXML.createElement("b64")
    objNode.DataType = "bin.base64"
    objNode.Text = base64String
    Base64Decode = objNode.nodeTypedValue
    Set objNode = Nothing
    Set objXML = Nothing
End Function

' Chaine VBA -> octets UTF-8 (sans les 3 octets de BOM qu'ajoute ADODB.Stream).
Public Function StringToUtf8Bytes(ByVal s As String) As Byte()
    Dim stream As Object
    Set stream = CreateObject("ADODB.Stream")
    stream.Type = 2
    stream.Mode = 3
    stream.Charset = "utf-8"
    stream.Open
    stream.WriteText s
    stream.Position = 0
    stream.Type = 1
    stream.Position = 3
    StringToUtf8Bytes = stream.Read
    stream.Close
    Set stream = Nothing
End Function

Public Function Utf8BytesToString(ByRef bytes() As Byte) As String
    Dim stream As Object
    Set stream = CreateObject("ADODB.Stream")
    stream.Type = 1
    stream.Mode = 3
    stream.Open
    stream.Write bytes
    stream.Position = 0
    stream.Type = 2
    stream.Charset = "utf-8"
    Utf8BytesToString = stream.ReadText
    stream.Close
    Set stream = Nothing
End Function
