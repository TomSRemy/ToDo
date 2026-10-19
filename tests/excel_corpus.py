"""Producer Excel files (fictitious) as rows per sheet, with the installations a human would read.

Used by tests/extraction_accuracy.py. Dates appear as Excel serial numbers (as in a real .xlsx) or text.
46174 = 01/06/2026, 46539 = 01/06/2027, 46447 = 01/03/2027.
"""

TEMPLATE_LABELS = ["Nom Installation", "Nom SPV", "SIRET SPV", "Adresse", "Département", "Commune", "Altitude", "Latitude", "Longitude",
                   "Nature Projet", "Nature Projet (liste)", "Type d'injection", "Taux d'autoconsommation individuelle", "Taux d'autoconsommation collective",
                   "Date de mise en service", "Nb onduleurs", "Puissance unitaire onduleur (kVA)", "Puissance raccordement (kVA)", "Puissance installée (kWc)",
                   "Gestion heures négatives", "Stockage", "P50 (MWh/an)", "P90 (MWh/an)", "Productible P50 (kWh/kWc/an)"]


def template(*plants):
    rows = [["", *("Centrale %d" % (i + 1) for i in range(len(plants)))]]
    for label in TEMPLATE_LABELS:
        rows.append([label, *(p.get(label, "") for p in plants)])
    return rows


EXCELS = [
    {
        "name": "Une colonne par centrale (simple)",
        "sheets": {"Données": [["", "Centrale 1", "Centrale 2"], ["Nom Installation", "Les Vignes", "Le Moulin"], ["Département", "Lot (46)", "Gers (32)"],
                               ["Puissance installée (kWc)", 2400, 1850.5], ["P50 (MWh/an)", 3100, 2300], ["Date de mise en service", "Juin 2027", "Mars 2028"], ["Type", "PV", "PV"]]},
        "installs": [{"centrale": "Les Vignes", "kwc": "2400", "mwh": "3100", "mesPrev": "Juin 2027", "dept": "46 - Lot"},
                     {"centrale": "Le Moulin", "kwc": "1850.5", "mwh": "2300", "mesPrev": "Mars 2028", "dept": "32 - Gers"}],
    },
    {
        "name": "Modèle Selfee Caractéristiques Centrales",
        "sheets": {"Données": template(
            {"Nom Installation": "CS Bram", "Nom SPV": "BRAM SOLAIRE SAS", "SIRET SPV": "123 456 789 00012", "Adresse": "Lieu-dit La Plaine, 11150 Bram",
             "Département": "Aude (11)", "Commune": "Bram", "Nature Projet": "Centrale au sol", "Type d'injection": "Total", "Date de mise en service": "Avril 2027",
             "Puissance raccordement (kVA)": 4200, "Puissance installée (kWc)": 4986.93, "P50 (MWh/an)": 6650, "P90 (MWh/an)": 6100, "Productible P50 (kWh/kWc/an)": 1333},
            {"Nom Installation": "Toiture Castelnaudary", "Nom SPV": "CASTEL PV SAS", "SIRET SPV": "987 654 321 00034", "Département": "Aude (11)",
             "Commune": "Castelnaudary", "Nature Projet": "Toiture", "Date de mise en service": 46447, "Puissance raccordement (kVA)": 400,
             "Puissance installée (kWc)": 498, "P50 (MWh/an)": 610, "Productible P50 (kWh/kWc/an)": 1225})},
        "installs": [{"centrale": "CS Bram", "kwc": "4986.93", "mwh": "6650", "p90": "6100", "mesPrev": "Avril 2027", "dept": "11 - Aude", "commune": "Bram",
                      "siret": "123 456 789 00012", "spv": "BRAM SOLAIRE SAS", "install": "PV"},
                     {"centrale": "Toiture Castelnaudary", "kwc": "498", "mwh": "610", "mesPrev": "01/03/2027", "dept": "11 - Aude", "commune": "Castelnaudary", "install": "PV"}],
    },
    {
        "name": "Une ligne par centrale, en-têtes en ligne 1",
        "sheets": {"Projets": [["Projet", "Commune", "Dépt", "Technologie", "Puissance (MWc)", "Production P50 (MWh)", "MES prévue"],
                               ["Cholet", "Cholet", 49, "PV sol", 1.2, 1450, 46539],
                               ["Saumur", "Saumur", 49, "PV toiture", 0.8, 900, "T3 2027"],
                               ["Angers Nord", "Angers", 49, "Ombrière", 2.5, 3000, "2028"]]},
        "installs": [{"centrale": "Cholet", "kwc": "1200", "mwh": "1450", "mesPrev": "01/06/2027", "dept": "49 - Maine-et-Loire", "install": "PV"},
                     {"centrale": "Saumur", "kwc": "800", "mwh": "900", "mesPrev": "T3 2027"},
                     {"centrale": "Angers Nord", "kwc": "2500", "mwh": "3000", "mesPrev": "2028"}],
    },
    {
        "name": "Tableau avec titre au-dessus et ligne Total",
        "sheets": {"Synthèse": [["Portefeuille HELIO OUEST — consultation agrégation 2027"], [], ["Liste des centrales"],
                                ["Nom de la centrale", "Code postal", "Puissance crête (kWc)", "P50 (MWh/an)", "Date MSI"],
                                ["Centrale des Prés", "49300", 1200, 1450, "15/03/2027"],
                                ["Centrale du Lac", "49400", 800, 950, "01/06/2027"],
                                ["Total", "", 2000, 2400, ""]]},
        "installs": [{"centrale": "Centrale des Prés", "kwc": "1200", "mwh": "1450", "mesPrev": "15/03/2027", "dept": "49 - Maine-et-Loire", "cp": "49300"},
                     {"centrale": "Centrale du Lac", "kwc": "800", "mwh": "950", "mesPrev": "01/06/2027", "dept": "49 - Maine-et-Loire"}],
    },
    {
        "name": "Valeurs en texte avec unités",
        "sheets": {"Feuil1": [["Site", "Puissance", "Productible", "Mise en service"],
                              ["Ferme de Bel Air", "2,4 MWc", "3 100 MWh/an", "juin 2027"],
                              ["Hangar Nord", "250 kWc", "290 MWh", "septembre 2026"]]},
        "installs": [{"centrale": "Ferme de Bel Air", "kwc": "2400", "mwh": "3100", "mesPrev": "Juin 2027"},
                     {"centrale": "Hangar Nord", "kwc": "250", "mwh": "290", "mesPrev": "Septembre 2026"}],
    },
    {
        "name": "Éolien : machines × puissance unitaire",
        "sheets": {"Parc": [["", "Parc de Bray", "Parc de Gournay"], ["Département", "Oise", "Seine-Maritime"], ["Nombre d'éoliennes", 4, 3],
                            ["Puissance unitaire (MW)", 4.2, 3.6], ["Puissance totale (MW)", 16.8, 10.8], ["Productible P50 (MWh/an)", 41000, 25500],
                            ["Mise en service industrielle", "Septembre 2028", "Mars 2029"], ["Technologie", "Éolien terrestre", "Éolien terrestre"]]},
        "installs": [{"centrale": "Parc de Bray", "kwc": "16800", "mwh": "41000", "mesPrev": "Septembre 2028", "dept": "60 - Oise", "install": "Eolien"},
                     {"centrale": "Parc de Gournay", "kwc": "10800", "mwh": "25500", "mesPrev": "Mars 2029", "dept": "76 - Seine-Maritime", "install": "Eolien"}],
    },
    {
        "name": "Puissance AC et DC : on garde la DC",
        "sheets": {"Caractéristiques": [["Nom", "Puissance AC (kVA)", "Puissance DC (kWc)", "P50 (MWh)", "P90 (MWh)"],
                                        ["Ombrière Leclerc", 900, 1050, 1200, 1100]]},
        "installs": [{"centrale": "Ombrière Leclerc", "kwc": "1050", "mwh": "1200", "p90": "1100"}],
    },
    {
        "name": "Date Excel en nombre dans une colonne par centrale",
        "sheets": {"Centrales": [["Centrale", "Toit A", "Toit B"], ["Puissance installée (kWc)", 99.9, 250], ["Date de mise en service", 46174, 46539]]},
        "installs": [{"centrale": "Toit A", "kwc": "99.9", "mesPrev": "01/06/2026"}, {"centrale": "Toit B", "kwc": "250", "mesPrev": "01/06/2027"}],
    },
    {
        "name": "Plusieurs onglets dont un sans centrale",
        "sheets": {"Lisez-moi": [["Ce fichier présente les caractéristiques de nos centrales."], ["Contact : M. Dupont"]],
                   "Centrales": [["Projet", "Puissance (kWc)", "Productible (MWh/an)"], ["Pézenas 1", 4980, 6900], ["Pézenas 2", 3200, 4400]]},
        "installs": [{"centrale": "Pézenas 1", "kwc": "4980", "mwh": "6900"}, {"centrale": "Pézenas 2", "kwc": "3200", "mwh": "4400"}],
    },
    {
        "name": "Grille de réponse BID (aucune centrale)",
        "sheets": {"Grille": [["Question", "Réponse attendue"], ["Frais d'agrégation (€/MWh)", ""], ["Prix pour la période de test", ""],
                              ["Gestion des prix négatifs", ""], ["Durée proposée", ""]]},
        "installs": [],
    },
    {
        "name": "Noms dans l'en-tête de colonnes, sans ligne Nom",
        "sheets": {"Données": [["Caractéristique", "Centrale du Moulin", "Centrale des Prés"], ["Puissance installée (MWc)", 1.5, 2.2],
                               ["P50 (MWh/an)", 1800, 2600], ["Commune", "Moûtiers", "Albertville"], ["Code postal", "73600", "73200"]]},
        "installs": [{"centrale": "Centrale du Moulin", "kwc": "1500", "mwh": "1800", "dept": "73 - Savoie", "commune": "Moûtiers"},
                     {"centrale": "Centrale des Prés", "kwc": "2200", "mwh": "2600", "dept": "73 - Savoie", "commune": "Albertville"}],
    },
    {
        "name": "Ligne par centrale avec mécanisme de soutien et hydro",
        "sheets": {"Sites": [["Nom du site", "Filière", "Puissance (kW)", "Production moyenne (GWh/an)", "Mécanisme de soutien", "Fin OA"],
                             ["Moulin de Pontarlier", "Hydroélectricité", 250, 1.1, "Obligation d'achat (H16)", "31/12/2026"],
                             ["Seuil de Morteau", "Hydro", 400, 1.9, "Complément de rémunération", ""]]},
        "installs": [{"centrale": "Moulin de Pontarlier", "kwc": "250", "mwh": "1100", "install": "Hydro", "contrat": "Sortie d'OA / CR"},
                     {"centrale": "Seuil de Morteau", "kwc": "400", "mwh": "1900", "install": "Hydro", "contrat": "AO CRE CR"}],
    },
]

# Written after tuning, to measure honestly.
EXCELS_HELDOUT = [
    {
        "name": "Tableau avec unités dans une ligne sous les en-têtes",
        "sheets": {"Liste": [["Centrale", "Département", "Puissance", "Production"], ["", "", "kWc", "MWh/an"],
                             ["Montbazon", "Indre-et-Loire", 3400, 4100], ["Chinon", "37", 2100, 2500]]},
        "installs": [{"centrale": "Montbazon", "kwc": "3400", "mwh": "4100", "dept": "37 - Indre-et-Loire"}, {"centrale": "Chinon", "kwc": "2100", "mwh": "2500", "dept": "37 - Indre-et-Loire"}],
    },
    {
        "name": "Colonne par centrale, libellés en anglais",
        "sheets": {"Sheet1": [["Plant name", "Les Hauts", "La Combe"], ["Installed capacity (MWp)", 5.2, 3.1], ["P50 yield (MWh/y)", 6800, 4000],
                              ["COD", "Q2 2027", "Q4 2027"], ["Location", "Drôme (26)", "Ardèche (07)"]]},
        "installs": [{"centrale": "Les Hauts", "kwc": "5200", "mwh": "6800"}, {"centrale": "La Combe", "kwc": "3100", "mwh": "4000"}],
    },
    {
        "name": "Tableau avec colonne N° et nom en deuxième colonne",
        "sheets": {"Inventaire": [["N°", "Désignation", "Puissance installée (kWc)", "MES"], [1, "Groupe scolaire Jean Monnet", 36, "2011"],
                                  [2, "Gymnase municipal", 100, "2013"], [3, "Centre technique", 250, "2015"]]},
        "installs": [{"centrale": "Groupe scolaire Jean Monnet", "kwc": "36", "mesPrev": "2011"}, {"centrale": "Gymnase municipal", "kwc": "100", "mesPrev": "2013"},
                     {"centrale": "Centre technique", "kwc": "250", "mesPrev": "2015"}],
    },
    {
        "name": "Fiche d'une seule centrale (libellé : valeur)",
        "sheets": {"Fiche": [["Fiche projet"], ["Nom du projet", "Centrale agrivoltaïque de Vic"], ["Commune", "Vic-en-Bigorre"], ["Département", "Hautes-Pyrénées"],
                             ["Puissance crête", "4,2 MWc"], ["Productible P50", "5 300 MWh/an"], ["Mise en service", "Mars 2028"]]},
        "installs": [{"centrale": "Centrale agrivoltaïque de Vic", "kwc": "4200", "mwh": "5300", "mesPrev": "Mars 2028", "dept": "65 - Hautes-Pyrénées", "commune": "Vic-en-Bigorre"}],
    },
    {
        "name": "Puissance en MW sans unité dans la cellule mais dans le titre de colonne",
        "sheets": {"Projets éoliens": [["Parc", "Région", "Puissance (MW)", "Nb de machines", "MSI"], ["Parc des Crêtes", "Grand Est", 21.6, 6, "Octobre 2028"]]},
        "installs": [{"centrale": "Parc des Crêtes", "kwc": "21600", "mesPrev": "Octobre 2028"}],
    },
]
