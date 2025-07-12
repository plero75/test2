import zipfile
import pandas as pd
import requests
from io import BytesIO
import os
import json

GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"

TARGET_LINES = [
    "IDFM:C02251",         # Bus 77
    "IDFM:C01219",         # Bus 201
    "IDFM:C01742"   # RER A
]

OUTPUT_FILE = "static/gtfs_firstlast.json"

print("📥 Téléchargement du GTFS...")
resp = requests.get(GTFS_URL)
z = zipfile.ZipFile(BytesIO(resp.content))

print("📦 Extraction dans ./gtfs/")
os.makedirs("gtfs", exist_ok=True)
for name in z.namelist():
    with open(f"gtfs/{name}", "wb") as f:
        f.write(z.read(name))

print("📚 Lecture des fichiers nécessaires...")
stop_times = pd.read_csv("gtfs/stop_times.txt", dtype=str)
trips = pd.read_csv("gtfs/trips.txt", dtype=str)
routes = pd.read_csv("gtfs/routes.txt", dtype=str)
calendar = pd.read_csv("gtfs/calendar.txt", dtype=str)
stops = pd.read_csv("gtfs/stops.txt", dtype=str)

print("🔍 Filtrage des lignes cibles...")
routes = routes[routes["route_id"].isin(TARGET_LINES)]
trips = trips[trips["route_id"].isin(routes["route_id"])]
merged = stop_times.merge(trips, on="trip_id")
merged["departure_time"] = pd.to_timedelta(merged["departure_time"].fillna("00:00:00"))

# Générer la liste des stops par ligne
line_to_stop_ids = {}
print("\n🔎 Liste des stops disponibles pour chaque ligne :")
for route_id in TARGET_LINES:
    stops_found = merged[merged["route_id"] == route_id]["stop_id"].unique().tolist()
    line_to_stop_ids[route_id] = stops_found
    print(f"🟢 {route_id} → {len(stops_found)} stops")
    print(stops_found[:10])

# Affichage des noms des arrêts disponibles
print("\n🔍 Vérification des stops disponibles avec leur nom :")
for line_id, stop_ids in line_to_stop_ids.items():
    print(f"\n🟢 Ligne {line_id} → {len(stop_ids)} stops")
    noms = stops[stops["stop_id"].isin(stop_ids)][["stop_id", "stop_name"]].drop_duplicates()
    print(noms.to_string(index=False))

print("🕐 Calcul des premiers et derniers passages...")
results = {}
for route_id in TARGET_LINES:
    line_data = merged[merged["route_id"] == route_id]
    if line_data.empty:
        continue
    first = line_data.groupby("stop_id")["departure_time"].min()
    last = line_data.groupby("stop_id")["departure_time"].max()
    results[route_id] = {
        stop: {
            "first": str(first[stop]),
            "last": str(last[stop])
        } for stop in first.index
    }

print("💾 Écriture dans", OUTPUT_FILE)
os.makedirs("static", exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

# Résumé manuel des arrêts cibles
print("\n📍 Résumé des premiers et derniers départs :\n")
labels = {
    "IDFM:C02251": "Bus 77",
    "IDFM:C01805": "Bus 201",
    "STIF:Line::C01742:": "RER A",
}
stops_to_check = {
    "IDFM:C02251": ["IDFM:463644"],  # École du Breuil
    "IDFM:C01805": ["IDFM:463644"],  # École du Breuil
    "STIF:Line::C01742:": ["IDFM:43135"],  # Joinville-le-Pont
}

print("\n🔍 Vérification manuelle de la présence des stop_id dans merged :")
for sid in ["IDFM:463644", "IDFM:43135"]:
    match = merged[merged["stop_id"] == sid]
    print(f"{sid} : {len(match)} occurrences")

for route_id, stop_ids in stops_to_check.items():
    print(f"🚌 {labels.get(route_id, route_id)}")
    for stop_id in stop_ids:
        stop_data = results.get(route_id, {}).get(stop_id)
        if stop_data:
            print(f"  - 🚏 {stop_id} → Premier : {stop_data['first']} / Dernier : {stop_data['last']}")
        else:
            print(f"  - 🚏 {stop_id} → ❌ Données non trouvées")
