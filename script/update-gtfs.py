import requests
import zipfile
import os
import pandas as pd

# Constantes
GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"
ZIP_PATH = "IDFM-gtfs.zip"
EXTRACT_DIR = "gtfs_extract"
OUTPUT_JSON = "gtfs_firstlast.json"
TARGET_LINES = ["A", "77", "201"]

# Télécharger le fichier GTFS
print("Téléchargement en cours...")
resp = requests.get(GTFS_URL)
with open(ZIP_PATH, "wb") as f:
    f.write(resp.content)
print("Téléchargement terminé.")

# Décompression
print("Décompression...")
with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
    zip_ref.extractall(EXTRACT_DIR)
print("Fichiers extraits.")

# Lecture des fichiers nécessaires
routes = pd.read_csv(f"{EXTRACT_DIR}/routes.txt")
trips = pd.read_csv(f"{EXTRACT_DIR}/trips.txt")
stop_times = pd.read_csv(f"{EXTRACT_DIR}/stop_times.txt")
stops = pd.read_csv(f"{EXTRACT_DIR}/stops.txt")

# Filtrage des lignes concernées
routes_filtered = routes[routes["route_short_name"].isin(TARGET_LINES)]
trips_filtered = trips[trips["route_id"].isin(routes_filtered["route_id"])]
stop_times_filtered = stop_times[stop_times["trip_id"].isin(trips_filtered["trip_id"])]
stops_filtered = stops[stops["stop_id"].isin(stop_times_filtered["stop_id"])]

# Fusion des données
merged = stop_times_filtered.merge(trips_filtered, on="trip_id") \
                            .merge(routes_filtered, on="route_id") \
                            .merge(stops_filtered, on="stop_id")

# Conversion des horaires en format lisible
def time_to_minutes(t):
    try:
        h, m, s = map(int, t.split(":"))
        return h * 60 + m + s / 60
    except:
        return None

merged['departure_minutes'] = merged['departure_time'].apply(time_to_minutes)

# Calcul premiers/derniers passages
result = merged.groupby(
