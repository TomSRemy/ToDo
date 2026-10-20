"""Realistic producer emails (fictitious people and companies) with the fields a human would fill in.

Used by tests/mail_accuracy.py to measure the email reader field by field. Only the fields listed in
"expect" are scored; "tel" is compared on the first number found.
"""

CASES = [
    {
        "name": "CA forward, PV au sol AOS",
        "mail": """Objet : TR: Projet centrale PV - SCEA Les Vergers du Lot

Bonjour,

Je vous transfère la demande d’un de nos clients agriculteurs, qui cherche un agrégateur pour sa future centrale.

Bien cordialement,
Nathalie Vidal
Chargée d’affaires Énergies
Crédit Agricole Pyrénées Gascogne
nathalie.vidal@ca-pyrenees-gascogne.fr

-----Message d’origine-----
De : Pierre Lacombe <p.lacombe@vergersdulot.fr>
Envoyé : lundi 13 octobre 2026 09:42
À : Nathalie Vidal <nathalie.vidal@ca-pyrenees-gascogne.fr>
Objet : Projet centrale PV

Bonjour Madame,

Nous mettrons en service en juin 2027 une centrale photovoltaïque au sol de 2,4 MWc sur notre exploitation à Prayssac (46220), lauréate de l’appel d’offres simplifié de la CRE. Production attendue : environ 3 100 MWh par an.
Nous cherchons un agrégateur pour vendre l’électricité en complément de rémunération, sur un contrat de 3 ans.

Cordialement,
Pierre Lacombe
Gérant
SCEA LES VERGERS DU LOT
06 71 23 45 89""",
        "expect": {"producteur": "SCEA LES VERGERS DU LOT", "prenom": "Pierre", "nom": "LACOMBE", "qualite": "Gérant", "tel": "06 71 23 45 89",
                   "mail": "p.lacombe@vergersdulot.fr", "origine": "Crédit Agricole", "ca": "CR Pyrénées Gascogne", "dept": "46 - Lot",
                   "region": "Occitanie", "install": "PV", "contrat": "AOS CRE", "kwc": "2400", "mwh": "3100", "mesPrev": "Juin 2027", "duree": "3"},
    },
    {
        "name": "Direct, signature M. + Président, adresse complète",
        "mail": """De : Jean Dupont <jean.dupont@solairedumidi.fr>
Objet : Demande d'offre d'agrégation

Bonjour,

Nous développons une centrale solaire de 4,98 MWc à Béziers, mise en service prévue le 15/09/2026, en complément de rémunération (AO CRE PPE2 sol).
Le productible P50 est estimé à 6 900 MWh/an. Pourriez-vous nous faire une offre pour 5 ans ?

Bien à vous,

M. Jean DUPONT
Président
SAS SOLAIRE DU MIDI
12 route de Pézenas, 34500 Béziers
Tél : 04 67 11 22 33 - Mob. : 06 12 34 56 78
www.solairedumidi.fr""",
        "expect": {"producteur": "SAS SOLAIRE DU MIDI", "prenom": "Jean", "nom": "DUPONT", "qualite": "Président", "tel": "06 12 34 56 78",
                   "mail": "jean.dupont@solairedumidi.fr", "origine": "Contact direct", "dept": "34 - Hérault", "region": "Occitanie",
                   "install": "PV", "contrat": "AO CRE CR", "kwc": "4980", "mwh": "6900", "mesPrev": "15/09/2026", "duree": "5"},
    },
    {
        "name": "Signature avec tirets, nom composé, Directeur Général",
        "mail": """De : Jean-Marc Leroy <jm.leroy@energies-nouvelles.com>
Objet : Parc éolien de la Haute-Borne

Madame, Monsieur,

Notre parc éolien de la Haute-Borne (6 éoliennes, 18 MW) dans la Marne sera mis en service en mars 2028. Le productible attendu est de 42 GWh par an.
Nous sommes lauréats de l'appel d'offres éolien terrestre et souhaitons une offre d'agrégation sur 3 ans.

Cordialement,
--
Jean-Marc Leroy
Directeur Général
ENERGIES NOUVELLES SARL
+33 (0)3 26 45 67 89""",
        "expect": {"producteur": "ENERGIES NOUVELLES SARL", "prenom": "Jean-Marc", "nom": "LEROY", "qualite": "Directeur Général",
                   "tel": "03 26 45 67 89", "mail": "jm.leroy@energies-nouvelles.com", "origine": "Contact direct", "dept": "51 - Marne",
                   "region": "Grand Est", "install": "Eolien", "contrat": "AO CRE", "kwc": "18000", "mwh": "42000", "mesPrev": "Mars 2028",
                   "duree": "3", "centrale": "Parc éolien de la Haute-Borne"},
    },
    {
        "name": "BOAMP, commune",
        "mail": """Objet : BOAMP - Avis de marché - Achat de l'électricité produite par les centrales photovoltaïques de la commune

Avis de marché n° 26-123456
Commune de Pau
Objet du marché : agrégation et achat de l'électricité produite par 3 centrales photovoltaïques en toiture (puissance totale 750 kWc), sortie d'obligation d'achat.
Département de publication : 64
Date limite de réception des offres : 14/11/2026
Contact : service énergie, energie@ville-pau.fr, 05 59 27 85 80""",
        "expect": {"producteur": "COMMUNE DE PAU", "origine": "BOAMP", "dept": "64 - Pyrénées-Atlantiques", "region": "Nouvelle-Aquitaine",
                   "install": "PV", "contrat": "Sortie d'OA / CR", "kwc": "750", "tel": "05 59 27 85 80", "mail": "energie@ville-pau.fr"},
    },
    {
        "name": "Gmail forward, signature sans formule",
        "mail": """---------- Forwarded message ---------
De : Sophie Martin-Durand <sophie.martindurand@gmail.com>
Date: mar. 7 oct. 2026 à 18:02
Subject: Centrale toiture GAEC
To: <contact@selfee.fr>

Bonjour,
Je suis associée du GAEC du Moulin Blanc dans le Morbihan. Nous avons 500 kWc sur nos hangars, en service depuis 2012 sous obligation d'achat, qui se termine en décembre 2026. Que pouvez-vous nous proposer ?
Merci par avance
Sophie Martin-Durand
GAEC du Moulin Blanc
06.45.78.12.90""",
        "expect": {"producteur": "GAEC DU MOULIN BLANC", "prenom": "Sophie", "nom": "MARTIN-DURAND", "tel": "06 45 78 12 90",
                   "mail": "sophie.martindurand@gmail.com", "origine": "Contact direct", "dept": "56 - Morbihan", "region": "Bretagne",
                   "install": "PV", "contrat": "Sortie d'OA / CR", "kwc": "500"},
    },
    {
        "name": "Crédit Agricole Toulouse 31 en clair, T3",
        "mail": """De : Marc Rouanet <marc.rouanet@ca-toulouse31.fr>
Objet : Mise en relation - EARL Bastide

Bonjour,
Mon client l'EARL Bastide (Haute-Garonne) met en service au T3 2027 une ombrière photovoltaïque de 1 200 kWc. Il souhaite être contacté.
Ses coordonnées : Laurent Bastide, 06 78 90 12 34, earl.bastide@orange.fr

Cordialement,
Marc Rouanet
Chargé d'affaires Agri
Crédit Agricole Toulouse 31""",
        "expect": {"producteur": "EARL BASTIDE", "prenom": "Laurent", "nom": "BASTIDE", "tel": "06 78 90 12 34", "mail": "earl.bastide@orange.fr",
                   "origine": "Crédit Agricole", "ca": "CR Toulouse 31", "dept": "31 - Haute-Garonne", "region": "Occitanie", "install": "PV",
                   "kwc": "1200", "mesPrev": "T3 2027"},
    },
    {
        "name": "Hydro, débit, sortie OA",
        "mail": """De : Patrick Gay <patrick.gay@hydro-savoie.fr>
Objet : Microcentrale - fin d'OA

Bonjour,

Notre microcentrale hydroélectrique de 800 kW à Moûtiers (73600) sort de son contrat d'obligation d'achat le 31/03/2027. Production moyenne 3,2 GWh/an.
Nous cherchons une solution de vente sur le marché.

Salutations,
Patrick GAY
Gérant - SARL HYDRO SAVOIE
04 79 24 00 11""",
        "expect": {"producteur": "SARL HYDRO SAVOIE", "prenom": "Patrick", "nom": "GAY", "qualite": "Gérant", "tel": "04 79 24 00 11",
                   "mail": "patrick.gay@hydro-savoie.fr", "dept": "73 - Savoie", "region": "Auvergne-Rhône-Alpes", "install": "Hydro",
                   "contrat": "Sortie d'OA / CR", "kwc": "800", "mwh": "3200"},
    },
    {
        "name": "Biogaz / méthanisation",
        "mail": """De : Claire Fontaine <c.fontaine@metha-vendee.fr>
Objet : Unité de méthanisation - cogénération

Bonjour,
Nous exploitons une unité de méthanisation avec cogénération (puissance électrique 1,5 MW) en Vendée. Production électrique annuelle 11 500 MWh.
Merci de me recontacter au 02 51 33 44 55.

Bien cordialement,
Claire Fontaine
Responsable d'exploitation
SAS METHA VENDEE""",
        "expect": {"producteur": "SAS METHA VENDEE", "prenom": "Claire", "nom": "FONTAINE", "qualite": "Responsable d'exploitation",
                   "tel": "02 51 33 44 55", "mail": "c.fontaine@metha-vendee.fr", "dept": "85 - Vendée", "region": "Pays de la Loire",
                   "install": "BIOGAZ", "kwc": "1500", "mwh": "11500"},
    },
    {
        "name": "Productible en kWh/kWc (ne pas prendre pour un volume)",
        "mail": """De : Thomas Petit <thomas@petit-energies.fr>
Objet : Offre agrégation 3 MWc

Bonjour,
Centrale au sol de 3 MWc, productible 1 350 kWh/kWc, raccordement prévu fin 2027, en Dordogne (24).
Merci.
Thomas Petit
Président, PETIT ENERGIES SAS
07 81 22 33 44""",
        "expect": {"prenom": "Thomas", "nom": "PETIT", "tel": "07 81 22 33 44", "mail": "thomas@petit-energies.fr", "dept": "24 - Dordogne",
                   "region": "Nouvelle-Aquitaine", "install": "PV", "kwc": "3000", "mesPrev": "fin 2027", "producteur": "PETIT ENERGIES SAS"},
    },
    {
        "name": "Mail court, téléphone collé, PPA",
        "mail": """De : Arnaud Morel <arnaud.morel@agrisolaire.fr>
Objet : PPA

Bonjour, nous cherchons un PPA pour 2 centrales (total 5 MWc) dans le Gers. Rappelez-moi au 0612457890.
Arnaud Morel
AGRISOLAIRE""",
        "expect": {"prenom": "Arnaud", "nom": "MOREL", "tel": "06 12 45 78 90", "mail": "arnaud.morel@agrisolaire.fr", "dept": "32 - Gers",
                   "region": "Occitanie", "contrat": "PPA Spot", "kwc": "5000", "producteur": "AGRISOLAIRE"},
    },
    {
        "name": "Outlook RE:, réponse en haut, prospect plus bas",
        "mail": """De : Paul Guérin <paul.guerin@selfee.fr>
Envoyé : jeudi 9 octobre 2026 10:15
À : Hélène Roussel <h.roussel@sem-energies-loire.fr>
Objet : RE: Centrales de la SEM

Bonjour Madame Roussel, je vous rappelle demain.

De : Hélène Roussel <h.roussel@sem-energies-loire.fr>
Envoyé : mercredi 8 octobre 2026 17:40
À : Paul Guérin <paul.guerin@selfee.fr>
Objet : Centrales de la SEM

Bonjour,
La SEM Energies Loire souhaite consulter pour l'agrégation de 4 centrales photovoltaïques en toiture (1,8 MWc au total), situées à Saint-Étienne (42000), en complément de rémunération.
Cordialement,
Hélène Roussel
Directrice
SEM ENERGIES LOIRE
04 77 12 34 56""",
        "expect": {"producteur": "SEM ENERGIES LOIRE", "prenom": "Hélène", "nom": "ROUSSEL", "qualite": "Directrice", "tel": "04 77 12 34 56",
                   "mail": "h.roussel@sem-energies-loire.fr", "dept": "42 - Loire", "region": "Auvergne-Rhône-Alpes", "install": "PV", "kwc": "1800"},
    },
    {
        "name": "Nom en majuscules d'abord (DURAND Pierre)",
        "mail": """De : DURAND Pierre <pdurand@ferme-durand.fr>
Objet : contrat agrégation

Bonjour, notre installation PV de 250 kWc à Chalon-sur-Saône (71100) est en service depuis 2019. Nous voulons changer d'agrégateur au 1er janvier 2027.
Cordialement
DURAND Pierre
Exploitant agricole
EARL DURAND
03 85 00 11 22""",
        "expect": {"producteur": "EARL DURAND", "prenom": "Pierre", "nom": "DURAND", "tel": "03 85 00 11 22", "mail": "pdurand@ferme-durand.fr",
                   "dept": "71 - Saône-et-Loire", "region": "Bourgogne-Franche-Comté", "install": "PV", "kwc": "250"},
    },
    {
        "name": "Signature avec Mme et syndicat d'énergie",
        "mail": """De : Isabelle Garnier <i.garnier@sde35.fr>
Objet : Consultation agrégation - SDE 35

Madame, Monsieur,
Le Syndicat Départemental d'Énergie 35 lance une consultation pour l'agrégation de la production de 12 centrales photovoltaïques (2,6 MWc) en Ille-et-Vilaine, pour une durée de 2 ans à compter du 1er janvier 2027.
Je vous prie d'agréer mes salutations distinguées.
Mme Isabelle Garnier
Chargée de mission énergies renouvelables
Syndicat Départemental d'Énergie 35
02 99 23 15 15""",
        "expect": {"prenom": "Isabelle", "nom": "GARNIER", "tel": "02 99 23 15 15", "mail": "i.garnier@sde35.fr", "dept": "35 - Ille-et-Vilaine",
                   "region": "Bretagne", "install": "PV", "kwc": "2600", "duree": "2", "producteur": "SYNDICAT DÉPARTEMENTAL D'ÉNERGIE 35"},
    },
    {
        "name": "Corse, code postal 20",
        "mail": """De : Antoine Santoni <a.santoni@corsica-sole.fr>
Objet : Centrale Ajaccio

Bonjour, centrale PV de 900 kWc à Ajaccio (20090), MES janvier 2027, AO CRE bâtiment.
Antoine Santoni
Gérant
CORSICA SOLE SARL
06 22 33 44 55""",
        "expect": {"producteur": "CORSICA SOLE SARL", "prenom": "Antoine", "nom": "SANTONI", "qualite": "Gérant", "tel": "06 22 33 44 55",
                   "dept": "2A - Corse-du-Sud", "region": "Corse", "install": "PV", "kwc": "900", "mesPrev": "Janvier 2027", "contrat": "AO CRE"},
    },
    {
        "name": "Réunion (974)",
        "mail": """De : Kevin Payet <kevin.payet@soleil-reunion.re>
Objet : Projet agrivoltaïque

Bonjour, projet agrivoltaïque de 1,1 MWc à Saint-Pierre (97410), mise en service 2028.
Kevin Payet, Ingénieur projet, SOLEIL REUNION SAS, 06 92 11 22 33""",
        "expect": {"prenom": "Kevin", "nom": "PAYET", "tel": "06 92 11 22 33", "dept": "974 - La Réunion", "region": "La Réunion",
                   "install": "PV", "kwc": "1100", "mesPrev": "2028"},
    },
    {
        "name": "Signature 'Cordialement,' puis nom avec titre sur la même ligne",
        "mail": """De : Nicolas Bernard <nbernard@ombrelia.fr>
Objet : Ombrières parking

Bonjour,
Nous installons des ombrières photovoltaïques sur le parking du centre commercial de Mérignac (33700) : 2 MWc, mise en service été 2027. Nous cherchons un contrat d'agrégation de 3 ans.
Cordialement,
Nicolas Bernard – Responsable développement
OMBRELIA SAS
05 56 78 90 12""",
        "expect": {"producteur": "OMBRELIA SAS", "prenom": "Nicolas", "nom": "BERNARD", "tel": "05 56 78 90 12", "mail": "nbernard@ombrelia.fr",
                   "dept": "33 - Gironde", "region": "Nouvelle-Aquitaine", "install": "PV", "kwc": "2000", "mesPrev": "été 2027", "duree": "3"},
    },
    {
        "name": "CAT&E (Crédit Agricole Transitions & Énergies)",
        "mail": """De : Julie Lemaire <julie.lemaire@ca-transitions.com>
Objet : Opportunité agrégation - portefeuille éolien

Bonjour,
CA Transitions & Energies accompagne la société VENTS DU NORD SAS (parc éolien de 12 MW dans la Somme, MES décembre 2026).
Le contact côté client est M. Hugo Lefebvre, hugo.lefebvre@ventsdunord.fr, 06 33 44 55 66.
Bien cordialement,
Julie Lemaire
Chargée d'affaires
Crédit Agricole Transitions & Energies""",
        "expect": {"origine": "Crédit Agricole", "ca": "CAT&E", "mail": "hugo.lefebvre@ventsdunord.fr", "tel": "06 33 44 55 66",
                   "dept": "80 - Somme", "region": "Hauts-de-France", "install": "Eolien", "kwc": "12000", "mesPrev": "Décembre 2026",
                   "producteur": "VENTS DU NORD SAS", "prenom": "Hugo", "nom": "LEFEBVRE"},
    },
    {
        "name": "Plusieurs centrales en liste",
        "mail": """De : Romain Chevalier <r.chevalier@helio-ouest.fr>
Objet : Consultation 3 centrales

Bonjour,
Voici les 3 centrales à agréger (toutes en complément de rémunération, AO CRE) :
- Centrale de Cholet (49) : 1,2 MWc, MES 03/2027
- Centrale de Saumur (49) : 800 kWc, MES 06/2027
- Centrale d'Angers (49) : 2,5 MWc, MES 09/2027
Cordialement,
Romain Chevalier
Directeur technique
HELIO OUEST SAS
02 41 00 00 01""",
        "expect": {"producteur": "HELIO OUEST SAS", "prenom": "Romain", "nom": "CHEVALIER", "qualite": "Directeur technique", "tel": "02 41 00 00 01",
                   "dept": "49 - Maine-et-Loire", "region": "Pays de la Loire", "install": "PV", "kwc": "1200", "contrat": "AO CRE CR",
                   "centrale": "Centrale de Cholet"},
        "installs": [{"centrale": "Centrale de Cholet", "kwc": "1200"}, {"centrale": "Centrale de Saumur", "kwc": "800"}, {"centrale": "Centrale d'Angers", "kwc": "2500"}],
    },
    {
        "name": "Puissance collée à l'unité, 12MW",
        "mail": """De : Lucie Robin <lucie.robin@eolia-centre.fr>
Objet : Parc éolien

Bonjour, parc de 12MW dans l'Indre (36), mise en service prévue en avril 2028, lauréat AO éolien terrestre.
Lucie Robin
Chef de projet
EOLIA CENTRE SAS
06 01 02 03 04""",
        "expect": {"producteur": "EOLIA CENTRE SAS", "prenom": "Lucie", "nom": "ROBIN", "tel": "06 01 02 03 04", "dept": "36 - Indre",
                   "region": "Centre-Val de Loire", "install": "Eolien", "kwc": "12000", "mesPrev": "Avril 2028", "contrat": "AO CRE"},
    },
    {
        "name": "Domaine seul, sans société dans la signature",
        "mail": """De : contact@ferme-solaire-des-pins.fr
Objet : Demande de contact

Bonjour, nous avons une centrale PV de 350 kWc à Mont-de-Marsan (40000). Pouvez-vous nous rappeler ? 05 58 06 07 08
Merci""",
        "expect": {"mail": "contact@ferme-solaire-des-pins.fr", "tel": "05 58 06 07 08", "dept": "40 - Landes", "region": "Nouvelle-Aquitaine",
                   "install": "PV", "kwc": "350", "producteur": "FERME SOLAIRE DES PINS"},
    },
    {
        "name": "ACC (autoconsommation collective)",
        "mail": """De : Mathieu Roux <m.roux@enercoop-test.fr>
Objet : Surplus ACC

Bonjour,
Notre opération d'autoconsommation collective à Grenoble (38000) dispose d'un surplus d'environ 180 MWh par an (centrale de 250 kWc). Nous cherchons un acheteur pour ce surplus.
Mathieu Roux
Coordinateur
SCIC ENERGIES CITOYENNES
04 76 00 00 02""",
        "expect": {"producteur": "SCIC ENERGIES CITOYENNES", "prenom": "Mathieu", "nom": "ROUX", "tel": "04 76 00 00 02", "dept": "38 - Isère",
                   "region": "Auvergne-Rhône-Alpes", "install": "PV", "contrat": "Surplus ACC", "kwc": "250", "mwh": "180"},
    },
    {
        "name": "Date MES écrite '1er trimestre 2027'",
        "mail": """De : Hugo Faure <hugo.faure@lumen-energie.fr>
Objet : Centrale Clermont

Bonjour, centrale au sol de 5 MWc près de Clermont-Ferrand (63000), mise en service au 1er trimestre 2027, lauréate AO PPE2.
Hugo Faure, Directeur, LUMEN ENERGIE SAS, 04 73 00 00 03""",
        "expect": {"prenom": "Hugo", "nom": "FAURE", "tel": "04 73 00 00 03", "dept": "63 - Puy-de-Dôme", "region": "Auvergne-Rhône-Alpes",
                   "install": "PV", "kwc": "5000", "mesPrev": "T1 2027", "contrat": "AO CRE"},
    },
    {
        "name": "Téléphone international +33 6",
        "mail": """De : Emma Girard <emma.girard@girard-agri.fr>
Objet : Hangar PV

Bonjour, hangar photovoltaïque 100 kWc à Niort (79000), en service depuis 2015 (obligation d'achat jusqu'en 2035). Nous voulons juste un renseignement.
Emma Girard
Gérante
EARL GIRARD
+33 6 98 76 54 32""",
        "expect": {"producteur": "EARL GIRARD", "prenom": "Emma", "nom": "GIRARD", "qualite": "Gérante", "tel": "06 98 76 54 32", "dept": "79 - Deux-Sèvres",
                   "region": "Nouvelle-Aquitaine", "install": "PV", "kwc": "100"},
    },
    {
        "name": "Signature du transféreur interne seulement (Selfee)",
        "mail": """De : Quentin Ray <quentin.ray@selfee.fr>
Objet : TR: lead salon

Pour info, lead du salon EnerGaïa : SARL SOLEIL D'OC, M. Bruno Vidal (b.vidal@soleil-doc.fr, 06 55 66 77 88), 3 toitures dans l'Aude, 600 kWc au total.
Quentin""",
        "expect": {"mail": "b.vidal@soleil-doc.fr", "tel": "06 55 66 77 88", "dept": "11 - Aude", "region": "Occitanie", "install": "PV", "kwc": "600",
                   "producteur": "SARL SOLEIL D'OC", "prenom": "Bruno", "nom": "VIDAL"},
    },
    {
        "name": "Volume en MWh/an avec espace insécable",
        "mail": """De : Paul Lambert <paul.lambert@lambert-sas.fr>
Objet : Centrale Normandie

Bonjour, centrale PV toiture 1 500 kWc à Caen (14000), production 1 450 MWh/an, en service en octobre 2026.
Paul Lambert, Président, LAMBERT SAS, 02 31 00 00 04""",
        "expect": {"producteur": "LAMBERT SAS", "prenom": "Paul", "nom": "LAMBERT", "tel": "02 31 00 00 04", "dept": "14 - Calvados", "region": "Normandie",
                   "install": "PV", "kwc": "1500", "mwh": "1450", "mesPrev": "Octobre 2026"},
    },
]

# Written after the rules were tuned on CASES, to measure honestly on mails the reader has never seen.
HELDOUT = [
    {
        "name": "Relance courte avec signature Outlook mobile",
        "mail": """De : Yannick Le Gall <ylegall@breizh-solar.bzh>
Objet : Re: votre offre

Bonjour, je reviens vers vous pour nos 2 toitures (420 kWc au total) à Quimper (29000). Le contrat OA se termine fin 2026.
Pouvez-vous m'appeler ?
Yannick Le Gall
Gérant BREIZH SOLAR
Envoyé de mon iPhone""",
        "expect": {"prenom": "Yannick", "nom": "LE GALL", "mail": "ylegall@breizh-solar.bzh", "dept": "29 - Finistère", "region": "Bretagne",
                   "install": "PV", "kwc": "420", "contrat": "Sortie d'OA / CR", "producteur": "BREIZH SOLAR", "origine": "Contact direct"},
    },
    {
        "name": "CA Alpes Provence, prospect en pièce jointe décrite",
        "mail": """De : Sandrine Blanc <sandrine.blanc@ca-alpesprovence.fr>
Objet : Projet solaire - Domaine des Oliviers

Bonjour,
Je vous mets en relation avec M. Olivier Mercier, gérant de la SCEA Domaine des Oliviers à Aix-en-Provence (13100), qui étudie une centrale agrivoltaïque de 3,2 MWc (MES visée mi-2028).
Contact : olivier.mercier@domaine-oliviers.fr – 06 11 22 33 44
Bonne journée,
Sandrine Blanc
Conseillère Énergie
Crédit Agricole Alpes Provence""",
        "expect": {"origine": "Crédit Agricole", "ca": "CR Alpes Provence", "prenom": "Olivier", "nom": "MERCIER", "mail": "olivier.mercier@domaine-oliviers.fr",
                   "tel": "06 11 22 33 44", "dept": "13 - Bouches-du-Rhône", "region": "Provence-Alpes-Côte d'Azur", "install": "PV", "kwc": "3200",
                   "producteur": "SCEA DOMAINE DES OLIVIERS"},
    },
    {
        "name": "Anglais / investisseur",
        "mail": """From: Mark Thompson <m.thompson@greenyield-capital.com>
Subject: Aggregation services for French PV portfolio

Hello,
We own a 15 MWp ground-mounted PV plant near Toulouse (31) commissioned in 2023 under a CRE tender (CR). We are looking for a new aggregator from January 2027.
Best regards,
Mark Thompson
Asset Manager
GreenYield Capital
+44 20 7946 0000""",
        "expect": {"prenom": "Mark", "nom": "THOMPSON", "mail": "m.thompson@greenyield-capital.com", "dept": "31 - Haute-Garonne", "region": "Occitanie",
                   "install": "PV", "qualite": "Asset Manager", "origine": "Contact direct"},
    },
    {
        "name": "Mairie, élu",
        "mail": """De : Bernard Collin <maire@mairie-saint-julien.fr>
Objet : Centrale photovoltaïque communale

Bonjour,
La commune de Saint-Julien (Jura, 39) possède une centrale photovoltaïque de 180 kWc sur l'école, mise en service en 2011. Le contrat d'obligation d'achat arrive à échéance en juillet 2031.
Cordialement,
Bernard Collin
Maire de Saint-Julien
03 84 00 00 05""",
        "expect": {"prenom": "Bernard", "nom": "COLLIN", "tel": "03 84 00 00 05", "dept": "39 - Jura", "region": "Bourgogne-Franche-Comté",
                   "install": "PV", "kwc": "180", "qualite": "Maire de Saint-Julien"},
    },
    {
        "name": "Signature tableau Outlook (une info par ligne, avec libellés)",
        "mail": """De : Camille Dubois <camille.dubois@rhone-energies.fr>
Objet : Demande de cotation

Bonjour,
Pour notre centrale au sol de Montélimar (26200), 7,5 MWc, P50 9 800 MWh, mise en service prévue le 01/06/2027, AO CRE PPE2 en CR, nous souhaitons une cotation sur 3 et 5 ans.
Cordialement,
Camille DUBOIS
Responsable financement de projets
RHÔNE ÉNERGIES SAS
T. 04 75 00 00 06
M. 06 77 00 00 06""",
        "expect": {"prenom": "Camille", "nom": "DUBOIS", "tel": "06 77 00 00 06", "dept": "26 - Drôme", "region": "Auvergne-Rhône-Alpes", "install": "PV",
                   "kwc": "7500", "mwh": "9800", "mesPrev": "01/06/2027", "contrat": "AO CRE CR", "producteur": "RHÔNE ÉNERGIES SAS",
                   "qualite": "Responsable financement de projets"},
    },
    {
        "name": "Particulier sans société",
        "mail": """De : jean.michel.roche@wanadoo.fr
Objet : panneaux solaires

Bonjour, j'ai 36 kWc sur le toit de ma grange à Aurillac (15000), je voudrais vendre mon électricité autrement qu'en OA. Merci de me dire si c'est possible. Jean-Michel Roche 06 31 00 00 07""",
        "expect": {"mail": "jean.michel.roche@wanadoo.fr", "tel": "06 31 00 00 07", "dept": "15 - Cantal", "region": "Auvergne-Rhône-Alpes", "install": "PV", "kwc": "36"},
    },
    {
        "name": "Éolien repowering, puissance en MW et nombre de machines",
        "mail": """De : Valérie Noël <v.noel@vents-de-picardie.fr>
Objet : Repowering parc de Bray

Bonjour,
Le parc éolien de Bray (Oise) va être renouvelé : 4 machines de 4,2 MW, soit 16,8 MW, mise en service en septembre 2028, complément de rémunération (AO éolien terrestre).
Valérie Noël
Directrice des opérations
VENTS DE PICARDIE SAS
03 44 00 00 08""",
        "expect": {"prenom": "Valérie", "nom": "NOËL", "tel": "03 44 00 00 08", "dept": "60 - Oise", "region": "Hauts-de-France", "install": "Eolien",
                   "mesPrev": "Septembre 2028", "contrat": "AO CRE CR", "producteur": "VENTS DE PICARDIE SAS", "centrale": "Parc éolien de Bray"},
    },
    {
        "name": "Collègue interne transfère un mail client complet",
        "mail": """De : Pauline Garcia <pauline.garcia@selfee.fr>
Objet : TR: contrat agrégation hydro

Pour toi, c'est dans ton secteur.

De : Gilles Vasseur <gilles.vasseur@moulin-hydro.fr>
Objet : contrat agrégation hydro

Bonjour, notre moulin hydroélectrique (250 kW) à Pontarlier (25300) cherche un agrégateur, notre contrat actuel se termine au 31/12/2026.
Cordialement,
Gilles Vasseur
SARL MOULIN HYDRO
06 44 00 00 09""",
        "expect": {"prenom": "Gilles", "nom": "VASSEUR", "mail": "gilles.vasseur@moulin-hydro.fr", "tel": "06 44 00 00 09", "dept": "25 - Doubs",
                   "region": "Bourgogne-Franche-Comté", "install": "Hydro", "kwc": "250", "producteur": "SARL MOULIN HYDRO", "origine": "Contact direct"},
    },
    {
        "name": "Code postal dans l'adresse de signature seulement, autre ville dans le texte",
        "mail": """De : Olivier Brun <obrun@sudsol.fr>
Objet : Centrale de Narbonne

Bonjour, notre centrale de Narbonne (2 MWc) sera mise en service en novembre 2027.
Olivier Brun
Gérant
SUDSOL SARL
5 avenue de la Gare, 34000 Montpellier
04 67 00 00 10""",
        "expect": {"prenom": "Olivier", "nom": "BRUN", "tel": "04 67 00 00 10", "install": "PV", "kwc": "2000", "mesPrev": "Novembre 2027",
                   "producteur": "SUDSOL SARL", "qualite": "Gérant"},
    },
    {
        "name": "Nombres avec points comme séparateur de milliers",
        "mail": """De : Agnès Perrin <agnes.perrin@perrin-energie.fr>
Objet : Offre

Bonjour, centrale PV de 1.250 kWc à Albi (81000), production 1.600 MWh/an, MES 15 mars 2027.
Agnès Perrin, Gérante, PERRIN ENERGIE EURL, 05 63 00 00 11""",
        "expect": {"prenom": "Agnès", "nom": "PERRIN", "tel": "05 63 00 00 11", "dept": "81 - Tarn", "region": "Occitanie", "install": "PV",
                   "kwc": "1250", "mwh": "1600", "mesPrev": "15/03/2027", "producteur": "PERRIN ENERGIE EURL"},
    },
]

# Harder formats (replies, quotes, tables pasted in the body), written before any change to the reader.
HARD = [
    {
        "name": "Réponse Gmail « a écrit : » avec citation >",
        "mail": """Bonjour Paul,
Oui, je vous confirme la date : mise en service en mai 2027. La centrale fait 3,6 MWc, à Lectoure (32700).
Bien à vous,
Arnaud Morel
Fondateur - AGRISOLAIRE
06 12 45 78 90

Le jeu. 9 oct. 2026 à 11:02, Paul Guérin <paul.guerin@selfee.fr> a écrit :
> Bonjour Monsieur Morel,
> Pouvez-vous me confirmer la date de mise en service ?
> Paul Guérin
> Selfee - 01 00 00 00 00""",
        "expect": {"prenom": "Arnaud", "nom": "MOREL", "qualite": "Fondateur", "producteur": "AGRISOLAIRE", "tel": "06 12 45 78 90", "dept": "32 - Gers",
                   "kwc": "3600", "mesPrev": "Mai 2027", "origine": "Contact direct"},
    },
    {
        "name": "Tableau collé depuis Excel (tabulations)",
        "mail": """De : Romain Chevalier <r.chevalier@helio-ouest.fr>
Objet : Liste des centrales

Bonjour, voici nos centrales :
Centrale\tDépartement\tPuissance (kWc)\tP50 (MWh)\tMES
Cholet\t49\t1200\t1450\t03/2027
Saumur\t49\t800\t950\t06/2027
Cordialement,
Romain Chevalier
HELIO OUEST SAS
02 41 00 00 01""",
        "expect": {"prenom": "Romain", "nom": "CHEVALIER", "producteur": "HELIO OUEST SAS", "tel": "02 41 00 00 01", "dept": "49 - Maine-et-Loire", "kwc": "1200"},
        "installs": [{"centrale": "Cholet", "kwc": "1200"}, {"centrale": "Saumur", "kwc": "800"}],
    },
    {
        "name": "Outlook anglais avec avertissement et images",
        "mail": """From: Mark Thompson <m.thompson@greenyield-capital.com>
Sent: Thursday, October 9, 2026 4:12 PM
To: Paul Guérin <paul.guerin@selfee.fr>
Subject: RE: Aggregation offer

Hi Paul,
Our plant near Albi (81000) is 9.5 MWp, COD March 2027, P50 12,400 MWh.
Best regards,
Mark Thompson
Asset Manager | GreenYield Capital
+44 20 7946 0000
[cid:image001.png@01DB2F3A.5E8C2D10]
This e-mail and any attachments are confidential and intended solely for the addressee. If you have received it in error, please notify the sender.""",
        "expect": {"prenom": "Mark", "nom": "THOMPSON", "qualite": "Asset Manager", "producteur": "GREENYIELD CAPITAL", "mail": "m.thompson@greenyield-capital.com",
                   "dept": "81 - Tarn", "kwc": "9500", "mwh": "12400", "mesPrev": "Mars 2027"},
    },
    {
        "name": "Signature au-dessus de l'historique, relais CA en dessous",
        "mail": """De : Laurent Bastide <earl.bastide@orange.fr>
Objet : RE: Mise en relation

Bonjour,
Suite au message de Mme Marty, voici les infos : ombrière de 1 200 kWc, mise en service au T3 2027.
Cordialement
Laurent Bastide
EARL Bastide
06 78 90 12 34

De : Claire Marty <claire.marty@ca-toulouse31.fr>
Objet : Mise en relation

Bonjour M. Bastide, je vous présente Selfee, agrégateur partenaire.
Claire Marty
Crédit Agricole Toulouse 31""",
        "expect": {"prenom": "Laurent", "nom": "BASTIDE", "producteur": "EARL BASTIDE", "tel": "06 78 90 12 34", "mail": "earl.bastide@orange.fr",
                   "origine": "Crédit Agricole", "ca": "CR Toulouse 31", "kwc": "1200", "mesPrev": "T3 2027"},
    },
    {
        "name": "Adresses en mailto et numéro en lien",
        "mail": """De : Claire Fontaine <c.fontaine@metha-vendee.fr<mailto:c.fontaine@metha-vendee.fr>>
Objet : Méthanisation

Bonjour, notre cogénération de 1,5 MW à Luçon (85400) produit 11 500 MWh/an.
Claire Fontaine
Responsable d'exploitation
METHA VENDEE
Tél : 02 51 33 44 55<tel:0251334455>""",
        "expect": {"prenom": "Claire", "nom": "FONTAINE", "mail": "c.fontaine@metha-vendee.fr", "tel": "02 51 33 44 55", "dept": "85 - Vendée",
                   "install": "BIOGAZ", "kwc": "1500", "mwh": "11500", "producteur": "METHA VENDEE"},
    },
    {
        "name": "Tableau avec barres verticales (copié d'un PDF)",
        "mail": """De : Hélène Roussel <h.roussel@sem-energies-loire.fr>
Objet : Centrales SEM

Bonjour,
| Site | Puissance | Production |
| Gymnase Jean Moulin | 250 kWc | 280 MWh |
| École des Tilleuls | 100 kWc | 110 MWh |
| Centre technique | 450 kWc | 500 MWh |
Hélène Roussel, Directrice, SEM ENERGIES LOIRE, 04 77 12 34 56""",
        "expect": {"prenom": "Hélène", "nom": "ROUSSEL", "qualite": "Directrice", "producteur": "SEM ENERGIES LOIRE", "tel": "04 77 12 34 56", "kwc": "250"},
        "installs": [{"centrale": "Gymnase Jean Moulin", "kwc": "250"}, {"centrale": "École des Tilleuls", "kwc": "100"}, {"centrale": "Centre technique", "kwc": "450"}],
    },
]

# Real layout (names changed): an installer asks for three plants owned by three different companies,
# Outlook bullets "Owner à COMMUNE à CP : power – notes", short names in the subject.
HARD.append({
    "name": "Installateur, 3 centrales de 3 propriétaires (puces Outlook)",
    "mail": """Bonjour Monsieur MARTIN,
Merci pour votre retour, je suis disponible le 5/11 à partir de 10hr.
A bientôt.
 <https://www.example-install.fr/logo.png>
\tJean-Noël MARCHAL
 <https://www.example-install.fr/appel.png>  06 00 00 00 38
 <https://www.example-install.fr/courrier.png>  jn.marchal@install-lorraine.fr <mailto:jn.marchal@install-lorraine.fr>
________________________________
INSTALL LORRAINE
 <https://www.example-install.fr/appel.png>  03 00 00 00 74
 <https://www.example-install.fr/emplacement.png>  8 rue des Lilas, 54000 Nancy
SIRET : 91000000000015– RCS : 910 000 000 R.C.S. Nancy
________________________________
De : Prénom Nom <prenom.nom@exemple.fr>
Objet : TR: INSTALL LORRAINE - Demande d'accompagnement agrégateur – Projets photovoltaïques FAVIER, KORVAL et MERCADIER

Bonjour Monsieur Marchal, je vous propose un échange en visio.
Prénom NOM
Responsable Commercial

De : Jean-Noël Marchal <jn.marchal@install-lorraine.fr <mailto:jn.marchal@install-lorraine.fr> >
Envoyé : vendredi 2 octobre 2026 08:30
Objet : INSTALL LORRAINE - Demande d'accompagnement agrégateur – Projets photovoltaïques FAVIER, KORVAL et MERCADIER

Bonjour,
Nous avons actuellement trois projets concernés par cette démarche :
*\tKORVAL à SAINT-MIHIEL à 55300 : 150 kWc – Autoconsommation prévisionnelle de 15 %, à confirmer.
*\tSOCIÉTÉ D'EXPLOITATION DES ÉTABLISSEMENTS JULES MERCADIER à SARREBOURG 57400 : 220 kWc – Injection totale.
*\tFAVIER LUCIEN à LUNÉVILLE 54300 : 390 kWc – Autoconsommation prévisionnelle de 35 %, à confirmer.
Soit une puissance totale installée de 760 kWc.
A bientôt.
\tJean-Noël MARCHAL
 <https://www.example-install.fr/appel.png>  06 00 00 00 38
________________________________
INSTALL LORRAINE
 <https://www.example-install.fr/appel.png>  03 00 00 00 74
SIRET : 91000000000015– RCS : 910 000 000 R.C.S. Nancy""",
    "expect": {"prenom": "Jean-Noël", "nom": "MARCHAL", "tel": "06 00 00 00 38", "mail": "jn.marchal@install-lorraine.fr", "producteur": "INSTALL LORRAINE",
               "origine": "Contact direct", "install": "PV", "centrale": "KORVAL", "kwc": "150"},
    "installs": [{"centrale": "KORVAL", "kwc": "150", "spv": "KORVAL", "commune": "SAINT-MIHIEL", "cp": "55300", "dept": "55 - Meuse",
                  "particularites": "Autoconsommation prévisionnelle de 15 %, à confirmer"},
                 {"centrale": "MERCADIER", "kwc": "220", "spv": "SOCIÉTÉ D'EXPLOITATION DES ÉTABLISSEMENTS JULES MERCADIER", "commune": "SARREBOURG", "cp": "57400",
                  "dept": "57 - Moselle", "particularites": "Injection totale"},
                 {"centrale": "FAVIER", "kwc": "390", "spv": "FAVIER LUCIEN", "commune": "LUNÉVILLE", "cp": "54300", "dept": "54 - Meurthe-et-Moselle",
                  "particularites": "Autoconsommation prévisionnelle de 35 %, à confirmer"}],
})
