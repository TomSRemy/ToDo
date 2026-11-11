====================================================================
 Macro Outlook -> appli ToDo (Boîte mail et Contacts)
====================================================================

Ce que fait la macro, une fois installée dans Outlook (classique) :
- Un drapeau sur un mail ouvre une petite fenêtre « Nouvelle tâche »
  (titre = objet, résumé du mail, client deviné, échéance du drapeau).
  « Créer la tâche » l'envoie dans l'onglet « Boîte mail » de l'appli,
  avec un lien pour rouvrir le mail.
- La catégorie « CRM Contact » sur un mail envoie l'expéditeur (ou, pour
  un mail transféré, la personne présentée dans le mail) dans la file
  « Contacts » de l'appli : l'appli lit la signature et propose le
  contact, tu valides avec « Importer ».

Depuis le 12/11/2026, les propositions vont dans un DOSSIER de ton PC,
par défaut OneDrive\ToDo\boite-mail (un petit fichier par mail), que
le pont Excel (v1.34 ou plus) lit pour l'appli. Plus de jeton GitHub
dans la macro, rien ne part sur Internet. Une proposition prise
(importée ou ignorée) passe dans le sous-dossier « traites » (30 jours).

En secours, l'ancien chemin reste possible : INBOX_MODE = "github" dans
modConfig (dépôt GitHub PRIVÉ des données, data/tasks-inbox.json et
data/contacts-inbox.json, avec un jeton). On ne met JAMAIS ce jeton
dans ce dépôt public.

--------------------------------------------------------------------
 Installation
--------------------------------------------------------------------
1. Outlook > Alt+F11 ouvre l'éditeur VBA.

2. Autoriser les macros : Fichier > Options > Centre de gestion de la
   confidentialité > Paramètres > Paramètres des macros > « Notifications
   pour toutes les macros ». Si c'est grisé, l'informatique l'a bloqué.

3. Importer les sept modules (Fichier > Importer un fichier, un par un) :
     modConfig.bas, modBase64.bas, modJson.bas, modGitHub.bas,
     modFlagHandler.bas, modContactCapture.bas, modLocalInbox.bas

4. Ouvrir modConfig et remplir :
     INBOX_MODE                 : "dossier" (par défaut) ; "github" = l'ancien chemin
     INBOX_FOLDER               : vide = OneDrive\ToDo\boite-mail (le dossier du pont)
     ATTACHMENT_FOLDER          : un dossier dans ton OneDrive
     OWN_DOMAIN                 : le domaine de ton adresse pro
   Seulement en mode "github" : GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN.

5. Construire la fenêtre : suivre frmTaskCapture_instructions.txt.

6. Coller ThisOutlookSession.txt dans le module ThisOutlookSession
   existant (sous « Microsoft Outlook Objects » ; ne pas l'importer).

7. Le curseur dans Application_Startup, appuyer une fois sur F5.

8. Essai : mettre un drapeau sur un mail sans importance, remplir,
   « Créer la tâche », puis regarder l'onglet Boîte mail de l'appli.

--------------------------------------------------------------------
 Si ça ne marche pas
--------------------------------------------------------------------
- Pas de fenêtre : refaire l'étape 7, ou les macros sont bloquées.
- « Écriture dans … impossible » : le dossier n'existe pas ou OneDrive
  n'est pas lancé ; régler INBOX_FOLDER dans modConfig.
- La tâche n'arrive pas dans l'appli : le pont Excel doit tourner
  (v1.34 ou plus) ; un fichier task-….json doit être dans le dossier.
- Mode "github" : « Envoi vers GitHub impossible » = vérifier le jeton,
  le nom du dépôt et que data/tasks-inbox.json existe (contenu : [] ).
- Pièces jointes non enregistrées : vérifier ATTACHMENT_FOLDER.

Mise à jour du 12/11/2026 (sans GitHub) : sur une macro déjà installée
--------------------------------------------------------------------
1. Alt+F11, Fichier > Importer un fichier : modLocalInbox.bas.
2. Dans modConfig, ajouter en haut les deux lignes INBOX_MODE et
   INBOX_FOLDER (copiées depuis modConfig.bas de ce dossier).
3. Dans modFlagHandler, remplacer la ligne
     ok = modGitHub.PushTaskToGitHub(itemJson)
   par
     ok = modLocalInbox.SendInboxItem(itemJson, "task")
4. Dans modContactCapture, remplacer
     If modGitHub.PushItemToGitHubFile(itemJson, CONTACT_INBOX_PATH, "New contact from Outlook") Then
   par
     If modLocalInbox.SendInboxItem(itemJson, "contact") Then
5. Débogage > Compiler, puis enregistrer. Essai sur un mail sans importance.
Si quelque chose cloche : INBOX_MODE = "github" remet l'ancien chemin.

Copie de secours (24/10/2026)
--------------------------------------------------------------------
La macro installée sur ton PC marche : c'est elle la référence, ne la
remplace pas. Cette copie sert à la réinstaller si elle se perd. Elle
reprend le code que tu m'as recollé, avec ces différences (relue, mais
pas encore lancée dans un vrai Outlook : teste-la sur un mail sans
importance avant de t'y fier) :
- la fenêtre recevait 5 informations mais n'en attendait que 3 (erreur
  « nombre d'arguments incorrect ») : elle remplit maintenant la
  description et le client ;
- le module modContactCapture manquait (la catégorie « CRM Contact »
  plantait) : il est ajouté ;
- le résumé du mail s'arrêtait à toute ligne commençant par « le » ou
  « on » : il ne s'arrête plus qu'aux vrais débuts de réponse
  (« Le … a écrit », « De : », signature) ;
- la flèche « → » devenait « ? » dans l'éditeur VBA : remplacée par « -> ».
