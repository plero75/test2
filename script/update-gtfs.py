import zipfile
import pandas as pd
import requests
from io import BytesIO
import os
import json

GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"

TARGET_LINES = [
    "IDFM:C02251",  # Ligne 77
    "IDFM:C01219",  # Ligne 201
    "STIF:Line::C01742:"  # RER A
]

OUTPUT_FILE = "static/gtfs-firstlast.json"

print("📥 Téléchargement du GTFS...")
resp = requests.get(GTFS_URL)
z = zipfile.ZipFile(BytesIO(resp.content))

print("📦 Extraction dans dossier ./gtfs/")
os.makedirs("gtfs", exist_ok=True)
for name in z.namelist():
    with open(f"gtfs/{name}", "wb") as f:
        f.write(z.read(name))

print("📚 Lecture des fichiers nécessaires...")
stop_times = pd.read_csv("gtfs/stop_times.txt", dtype=str)
trips = pd.read_csv("gtfs/trips.txt", dtype=str)
routes = pd.read_csv("gtfs/routes.txt", dtype=str)
calendar = pd.read_csv("gtfs/calendar.txt", dtype=str)

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

print("✅ Fichier généré :", OUTPUT_FILE)
