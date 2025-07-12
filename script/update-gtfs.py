import zipfile
import pandas as pd
import requests
from io import BytesIO
import os
import json

GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"

TARGET_LINES = [
    "IDFM:C02251",         # Bus 77
    "IDFM:C01805",         # Bus 201 (corrigé)
    "STIF:Line::C01742:"   # RER A
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

# 🖨️ Résumé explicite
print("\n📍 Résumé des premiers et derniers départs :\n")
labels = {
    "IDFM:C02251": "Bus 77",
    "IDFM:C01805": "Bus 201",
    "STIF:Line::C01742:": "RER A",
}
stops_to_check = {
    "IDFM:C02251": ["IDFM:463644"],  # École du Breuil (77)
    "IDFM:C01805": ["IDFM:463644"],  # École du Breuil (201)
    "STIF:Line::C01742:": ["IDFM:43135"],   # Joinville-le-Pont (RER A)
}
for route_id, stop_ids in stops_to_check.items():
    print(f"🚌 {labels.get(route_id, route_id)}")
    for stop_id in stop_ids:
        stop_data = results.get(route_id, {}).get(stop_id)
        if stop_data:
            print(f"  - 🚏 {stop_id} → Premier : {stop_data['first']} / Dernier : {stop_data['last']}")
        else:
            print(f"  - 🚏 {stop_id} → ❌ Données non trouvées")
