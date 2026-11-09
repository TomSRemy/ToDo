' Lance Lancer-raccourci.bat sans ouvrir de fenêtre : à mettre en raccourci dans le dossier Démarrage
' (Win+R, shell:startup) pour que Alt+N soit prêt dès l'ouverture de session, sans rien voir.
Dim fso, dossier, coquille
Set fso = CreateObject("Scripting.FileSystemObject")
dossier = fso.GetParentFolderName(WScript.ScriptFullName)
Set coquille = CreateObject("WScript.Shell")
coquille.Run Chr(34) & dossier & "\Lancer-raccourci.bat" & Chr(34), 0, False
