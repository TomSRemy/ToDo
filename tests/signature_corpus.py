"""Email signatures (fictitious people) with the contact a human would create.

Used by tests/extraction_accuracy.py. Scored fields: prenom, nom, qualite, societe, mail, tel (first number,
mobile preferred), tel2. Only fields listed in "expect" are scored.
"""

SIGNATURES = [
    {"name": "Classique 4 lignes", "text": """Pierre Lacombe
Gérant
SCEA LES VERGERS DU LOT
06 71 23 45 89""",
     "expect": {"prenom": "Pierre", "nom": "LACOMBE", "qualite": "Gérant", "societe": "SCEA LES VERGERS DU LOT", "tel": "06 71 23 45 89"}},
    {"name": "Civilité, nom en capitales, adresse, deux téléphones", "text": """M. Jean DUPONT
Président
SAS SOLAIRE DU MIDI
12 route de Pézenas, 34500 Béziers
Tél : 04 67 11 22 33 - Mob. : 06 12 34 56 78
jean.dupont@solairedumidi.fr
www.solairedumidi.fr""",
     "expect": {"prenom": "Jean", "nom": "DUPONT", "qualite": "Président", "societe": "SAS SOLAIRE DU MIDI", "mail": "jean.dupont@solairedumidi.fr",
                "tel": "06 12 34 56 78", "tel2": "04 67 11 22 33"}},
    {"name": "Tout sur une ligne avec barres", "text": "Hugo Faure | Directeur | LUMEN ENERGIE SAS | 04 73 00 00 03 | hugo.faure@lumen-energie.fr",
     "expect": {"prenom": "Hugo", "nom": "FAURE", "qualite": "Directeur", "societe": "LUMEN ENERGIE SAS", "tel": "04 73 00 00 03", "mail": "hugo.faure@lumen-energie.fr"}},
    {"name": "Nom de famille d'abord", "text": """DURAND Pierre
Exploitant agricole
EARL DURAND
03 85 00 11 22""",
     "expect": {"prenom": "Pierre", "nom": "DURAND", "qualite": "Exploitant agricole", "societe": "EARL DURAND", "tel": "03 85 00 11 22"}},
    {"name": "Tout en capitales, nom identifié par le mail", "text": """JEAN-MARC LEROY
DIRECTEUR GÉNÉRAL
ENERGIES NOUVELLES
jm.leroy@energies-nouvelles.com
+33 (0)3 26 45 67 89""",
     "expect": {"prenom": "Jean-Marc", "nom": "LEROY", "qualite": "DIRECTEUR GÉNÉRAL", "societe": "ENERGIES NOUVELLES", "mail": "jm.leroy@energies-nouvelles.com", "tel": "03 26 45 67 89"}},
    {"name": "Libellés Tél / Mob / Email, images Outlook", "text": """[cid:image001.png@01DB2F3A.5E8C2D10]
Camille DUBOIS
Responsable financement de projets
RHÔNE ÉNERGIES SAS
T. 04 75 00 00 06
M. 06 77 00 00 06
E. camille.dubois@rhone-energies.fr
[cid:image002.png@01DB2F3A.5E8C2D10]""",
     "expect": {"prenom": "Camille", "nom": "DUBOIS", "qualite": "Responsable financement de projets", "societe": "RHÔNE ÉNERGIES SAS",
                "tel": "06 77 00 00 06", "tel2": "04 75 00 00 06", "mail": "camille.dubois@rhone-energies.fr"}},
    {"name": "Avertissement légal en dessous", "text": """Nicolas Bernard
Responsable développement
OMBRELIA SAS
05 56 78 90 12
Ce message et toutes les pièces jointes sont confidentiels et établis à l'intention exclusive de ses destinataires. Toute utilisation non conforme à sa destination est interdite.
P Pensez à l'environnement avant d'imprimer ce message.""",
     "expect": {"prenom": "Nicolas", "nom": "BERNARD", "qualite": "Responsable développement", "societe": "OMBRELIA SAS", "tel": "05 56 78 90 12"}},
    {"name": "Anglais", "text": """Mark Thompson
Asset Manager
GreenYield Capital
+44 20 7946 0000
m.thompson@greenyield-capital.com""",
     "expect": {"prenom": "Mark", "nom": "THOMPSON", "qualite": "Asset Manager", "societe": "GreenYield Capital", "mail": "m.thompson@greenyield-capital.com"}},
    {"name": "Société avant le nom", "text": """VENTS DE PICARDIE SAS
Valérie Noël
Directrice des opérations
03 44 00 00 08""",
     "expect": {"prenom": "Valérie", "nom": "NOËL", "qualite": "Directrice des opérations", "societe": "VENTS DE PICARDIE SAS", "tel": "03 44 00 00 08"}},
    {"name": "Particule et nom composé", "text": """Marie-Claire de La Tour
Associée
GAEC DE LA TOUR
06 10 20 30 40""",
     "expect": {"prenom": "Marie-Claire", "nom": "DE LA TOUR", "qualite": "Associée", "societe": "GAEC DE LA TOUR", "tel": "06 10 20 30 40"}},
    {"name": "Rôle et société sur la même ligne avec tiret", "text": """Patrick GAY
Gérant - SARL HYDRO SAVOIE
04 79 24 00 11""",
     "expect": {"prenom": "Patrick", "nom": "GAY", "qualite": "Gérant", "societe": "SARL HYDRO SAVOIE", "tel": "04 79 24 00 11"}},
    {"name": "Mobile avec points, fixe en +33", "text": """Sophie Martin-Durand
GAEC du Moulin Blanc
06.45.78.12.90
+33 2 97 00 00 12""",
     "expect": {"prenom": "Sophie", "nom": "MARTIN-DURAND", "societe": "GAEC DU MOULIN BLANC", "tel": "06 45 78 12 90", "tel2": "02 97 00 00 12"}},
    {"name": "Société en casse normale reconnue par le domaine", "text": """Thomas Petit
Chef de projet
Solaire du Midi
thomas.petit@solairedumidi.fr""",
     "expect": {"prenom": "Thomas", "nom": "PETIT", "qualite": "Chef de projet", "societe": "Solaire du Midi", "mail": "thomas.petit@solairedumidi.fr"}},
    {"name": "Lecture OCR bruitée", "text": """Isabelle  Garnier
Chargée de mission énergies renouvelables
Syndicat Départemental d'Énergie 35
Tél.: 02 99 23 15 15
i.garnier@sde35.fr
—
www.sde35.fr""",
     "expect": {"prenom": "Isabelle", "nom": "GARNIER", "qualite": "Chargée de mission énergies renouvelables", "societe": "Syndicat Départemental d'Énergie 35",
                "tel": "02 99 23 15 15", "mail": "i.garnier@sde35.fr"}},
    {"name": "Mairie, élu", "text": """Bernard Collin
Maire de Saint-Julien
Mairie de Saint-Julien
03 84 00 00 05""",
     "expect": {"prenom": "Bernard", "nom": "COLLIN", "qualite": "Maire de Saint-Julien", "societe": "Mairie de Saint-Julien", "tel": "03 84 00 00 05"}},
    {"name": "Ligne directe et standard", "text": """Romain Chevalier
Directeur technique
HELIO OUEST SAS
Ligne directe : 02 41 00 00 01
Standard : 02 41 00 00 00""",
     "expect": {"prenom": "Romain", "nom": "CHEVALIER", "qualite": "Directeur technique", "societe": "HELIO OUEST SAS", "tel": "02 41 00 00 01"}},
    {"name": "Salutation en tête et prénom seul en dessous (signature courte)", "text": """Bien cordialement,
Julie
Julie Lemaire | Chargée d'affaires | Crédit Agricole Transitions & Energies
julie.lemaire@ca-transitions.com""",
     "expect": {"prenom": "Julie", "nom": "LEMAIRE", "qualite": "Chargée d'affaires", "societe": "Crédit Agricole Transitions & Energies", "mail": "julie.lemaire@ca-transitions.com"}},
    {"name": "LinkedIn et site", "text": """Arnaud Morel
Fondateur
AGRISOLAIRE
06 12 45 78 90
linkedin.com/in/arnaudmorel
agrisolaire.fr""",
     "expect": {"prenom": "Arnaud", "nom": "MOREL", "qualite": "Fondateur", "societe": "AGRISOLAIRE", "tel": "06 12 45 78 90"}},
    {"name": "Nom collé au rôle par une virgule", "text": """Agnès Perrin, Gérante
PERRIN ENERGIE EURL
05 63 00 00 11""",
     "expect": {"prenom": "Agnès", "nom": "PERRIN", "qualite": "Gérante", "societe": "PERRIN ENERGIE EURL", "tel": "05 63 00 00 11"}},
    {"name": "Groupe + filiale", "text": """Lucie Robin
Chef de projet éolien
EOLIA CENTRE SAS
Groupe EOLIA
06 01 02 03 04""",
     "expect": {"prenom": "Lucie", "nom": "ROBIN", "qualite": "Chef de projet éolien", "societe": "EOLIA CENTRE SAS", "tel": "06 01 02 03 04"}},
    {"name": "Téléphone collé sans espaces", "text": """Kevin Payet
Ingénieur projet
SOLEIL REUNION SAS
0692112233""",
     "expect": {"prenom": "Kevin", "nom": "PAYET", "qualite": "Ingénieur projet", "societe": "SOLEIL REUNION SAS", "tel": "06 92 11 22 33"}},
    {"name": "Adresse sur deux lignes", "text": """Paul Lambert
Président
LAMBERT SAS
ZA des Prés, 3 rue des Artisans
14000 Caen
02 31 00 00 04""",
     "expect": {"prenom": "Paul", "nom": "LAMBERT", "qualite": "Président", "societe": "LAMBERT SAS", "tel": "02 31 00 00 04"}},
    {"name": "Envoyé depuis mobile", "text": """Yannick Le Gall
Gérant BREIZH SOLAR
Envoyé de mon iPhone""",
     "expect": {"prenom": "Yannick", "nom": "LE GALL", "qualite": "Gérant", "societe": "BREIZH SOLAR"}},
    {"name": "SCIC et coordinateur", "text": """Mathieu Roux
Coordinateur
SCIC ENERGIES CITOYENNES
04 76 00 00 02
m.roux@enercoop-test.fr""",
     "expect": {"prenom": "Mathieu", "nom": "ROUX", "qualite": "Coordinateur", "societe": "SCIC ENERGIES CITOYENNES", "tel": "04 76 00 00 02", "mail": "m.roux@enercoop-test.fr"}},
    {"name": "Initiale du prénom dans le mail", "text": """Claire Fontaine
Responsable d'exploitation
METHA VENDEE
c.fontaine@metha-vendee.fr
02 51 33 44 55""",
     "expect": {"prenom": "Claire", "nom": "FONTAINE", "qualite": "Responsable d'exploitation", "societe": "METHA VENDEE", "mail": "c.fontaine@metha-vendee.fr", "tel": "02 51 33 44 55"}},
]

# Written after tuning, to measure honestly.
SIGNATURES_HELDOUT = [
    {"name": "Titre avant le nom", "text": """Directeur Général
François Morin
SOLARIS INVEST SAS
Mobile : 06 50 60 70 80
f.morin@solaris-invest.fr""",
     "expect": {"prenom": "François", "nom": "MORIN", "qualite": "Directeur Général", "societe": "SOLARIS INVEST SAS", "tel": "06 50 60 70 80", "mail": "f.morin@solaris-invest.fr"}},
    {"name": "Points médians et société en casse normale", "text": "Élodie Vasseur · Head of Energy Sales · Voltalis Energy · +33 6 70 80 90 10",
     "expect": {"prenom": "Élodie", "nom": "VASSEUR", "qualite": "Head of Energy Sales", "tel": "06 70 80 90 10"}},
    {"name": "Nom seul en majuscules et prénom en minuscules", "text": """BERTRAND julien
gérant
EARL BERTRAND
07 11 22 33 44""",
     "expect": {"nom": "BERTRAND", "societe": "EARL BERTRAND", "tel": "07 11 22 33 44"}},
    {"name": "Communauté de communes", "text": """Sylvie Lambert
Chargée de mission Transition énergétique
Communauté de Communes du Pays de Gex
04 50 00 00 13""",
     "expect": {"prenom": "Sylvie", "nom": "LAMBERT", "qualite": "Chargée de mission Transition énergétique", "societe": "Communauté de Communes du Pays de Gex", "tel": "04 50 00 00 13"}},
    {"name": "Ligne avec 'Tél' et 'Fax'", "text": """Gérard Michel
Président
SA ENERGIES DU RHIN
Tél : 03 88 00 00 14 | Fax : 03 88 00 00 15""",
     "expect": {"prenom": "Gérard", "nom": "MICHEL", "qualite": "Président", "societe": "SA ENERGIES DU RHIN", "tel": "03 88 00 00 14", "tel2": ""}},
    {"name": "Prénom composé avec espace", "text": """Anne Sophie Leclerc
Responsable achats énergie
Leclerc Distribution
anne-sophie.leclerc@leclerc-distribution.fr""",
     "expect": {"prenom": "Anne Sophie", "nom": "LECLERC", "qualite": "Responsable achats énergie", "societe": "Leclerc Distribution", "mail": "anne-sophie.leclerc@leclerc-distribution.fr"}},
    {"name": "Signature avec slogan", "text": """Olivier Brun
Gérant
SUDSOL SARL
« L'énergie du soleil, au service des territoires »
04 67 00 00 10""",
     "expect": {"prenom": "Olivier", "nom": "BRUN", "qualite": "Gérant", "societe": "SUDSOL SARL", "tel": "04 67 00 00 10"}},
    {"name": "Numéro au format 06-12-34-56-78", "text": """Laure Fabre
Agricultrice
GAEC FABRE
06-12-34-56-78""",
     "expect": {"prenom": "Laure", "nom": "FABRE", "qualite": "Agricultrice", "societe": "GAEC FABRE", "tel": "06 12 34 56 78"}},
    {"name": "Deux personnes (assistante + responsable)", "text": """Pour M. Henri Blanchard
Christine Roy, Assistante de direction
HYDROWATT SAS
04 76 00 00 16""",
     "expect": {"societe": "HYDROWATT SAS", "tel": "04 76 00 00 16"}},
    {"name": "Adresse avec CEDEX et BP", "text": """Damien Leroux
Responsable patrimoine
SEM ÉNERGIES VENDÉE
BP 123 - 85000 La Roche-sur-Yon CEDEX
02 51 00 00 17""",
     "expect": {"prenom": "Damien", "nom": "LEROUX", "qualite": "Responsable patrimoine", "societe": "SEM ÉNERGIES VENDÉE", "tel": "02 51 00 00 17"}},
]
