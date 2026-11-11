"""Déchiffre une sauvegarde de la base équipe (fichiers .json.enc du dépôt privé, dossier sauvegardes-equipe/AAAA-MM-JJ/).

Usage (PowerShell ou terminal, Python installé ou non : voir plus bas) :
    python dechiffrer-sauvegarde.py chemin/vers/sauvegardes-equipe/2026-11-14
La phrase secrète (BACKUP_PASSPHRASE) est demandée, rien n'est envoyé nulle part ; les fichiers .json en clair sont écrits
à côté, dans un dossier « dechiffre ». Sans Python : la même commande avec openssl (Git pour Windows l'inclut) :
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in contacts.json.enc -out contacts.json
"""
import getpass, pathlib, subprocess, sys, os

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
out = src / "dechiffre"; out.mkdir(exist_ok=True)
pw = getpass.getpass("Phrase secrète de la sauvegarde : ")
env = dict(os.environ, PASS=pw)
for f in sorted(src.glob("*.json.enc")):
    target = out / f.name[:-4]
    r = subprocess.run(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-pass", "env:PASS", "-in", str(f), "-out", str(target)], env=env, capture_output=True)
    print(("ok    " if r.returncode == 0 else "ÉCHEC ") + f.name + ("" if r.returncode == 0 else " (phrase secrète incorrecte ?)"))
print("Fichiers en clair dans", out, "— à effacer une fois utilisés.")
