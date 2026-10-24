Attribute VB_Name = "modConfig"
Option Explicit

' ==== A remplir avant usage ====

' Ton depot GitHub PRIVE des donnees (celui de la synchro de l'appli),
' pas le depot public de l'appli.
Public Const GITHUB_OWNER As String = "TON_COMPTE_GITHUB"
Public Const GITHUB_REPO As String = "TON_DEPOT_DE_DONNEES"
Public Const GITHUB_BRANCH As String = "main"
Public Const GITHUB_FILE_PATH As String = "data/tasks-inbox.json"

' Jeton "fine-grained" limite a CE depot, droit "Contents: Read and write".
' github.com -> Settings -> Developer settings -> Fine-grained tokens
Public Const GITHUB_TOKEN As String = "COLLER_LE_JETON_ICI"

' Dossier local des pieces jointes (de preference dans OneDrive).
Public Const ATTACHMENT_FOLDER As String = "C:\Users\TON_NOM\OneDrive\TodoAttachments\"

' Le domaine de ton adresse pro : les autres expediteurs sont devines comme clients.
Public Const OWN_DOMAIN As String = "TONDOMAINE.fr"

' Categorie ajoutee au mail une fois traite (le drapeau, lui, reste).
Public Const PROCESSED_CATEGORY As String = "Todo-synced"

' ==== Contacts ====
' La categorie a mettre sur un mail pour proposer son expediteur (ou la
' personne presentee dans un mail transfere) comme contact.
Public Const CONTACT_CATEGORY As String = "CRM Contact"
Public Const CONTACT_PROCESSED_CATEGORY As String = "CRM-synced"
Public Const CONTACT_INBOX_PATH As String = "data/contacts-inbox.json"
