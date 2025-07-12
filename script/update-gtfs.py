import zipfile
import pandas as pd
import requests
from io import BytesIO
import os
import json

GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"

TARGET_LINES = {
    "IDFM:C02251": {  # Bus 77
        "label": "Bus 77",
        "stops": ["IDFM:463643", "IDFM:463646", "IDFM:463640", "IDFM:463647"]
    },
    "IDFM:C01805": {  # Bus 201
        "label": "Bus 201",
        "stops": ["IDFM:463643", "IDFM:463646", "IDFM:463640", "IDFM:463647"]
    },
    "STIF:Line::C01742:": {  # RER A
        "label": "RER A",
        "stops": ["IDFM:monomodalStopPlace:43135"]
    }
}

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

print("🔍 Filtrage des lignes cibles...")
routes = routes[routes["route_id"].isin(TARGET_LINES.keys())]
trips = trips[trips["route_id"].isin(routes["route_id"])]
merged = stop_times.merge(trips, on="trip_id")
merged["departure_time"] = pd.to_timedelta(merged["departure_time"].fillna("00:00:00"))

print("\n🔎 Liste des stops disponibles pour chaque ligne :")
for route_id in TARGET_LINES:
    stops_found = merged[merged["route_id"] == route_id]["stop_id"].unique()
    print(f"🟢 {route_id} → {len(stops_found)} stops")
    print(stops_found[:10])

print("🕐 Calcul des premiers et derniers passages...")
results = {}

for route_id, conf in TARGET_LINES.items():
    data = {}
    line_data = merged[merged["route_id"] == route_id]
    if line_data.empty:
        continue

    for stop_id in conf["stops"]:
        stop_data = line_data[line_data["stop_id"] == stop_id]
        if stop_data.empty:
            continue
        first = stop_data["departure_time"].min()
        last = stop_data["departure_time"].max()
        data[stop_id] = {
            "first": str(first),
            "last": str(last)
        }

    results[route_id] = data

print("💾 Écriture dans", OUTPUT_FILE)
os.makedirs("static", exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("\n📍 Résumé des premiers et derniers départs :")
for route_id, conf in TARGET_LINES.items():
    print(f"\n🚌 {conf['label']}")
    for stop_id in conf["stops"]:
        stop_info = results.get(route_id, {}).get(stop_id)
        if stop_info:
            print(f"  - 🚏 {stop_id} → Premier : {stop_info['first']} / Dernier : {stop_info['last']}")
        else:
            print(f"  - 🚏 {stop_id} → ❌ Données non trouvées")
