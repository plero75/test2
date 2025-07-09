import zipfile
import pandas as pd
import requests
from io import BytesIO
from datetime import datetime, timedelta
import json
import collections

GTFS_URL = "https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip"

TARGETS = [
    # Nom affiché, parent_station, route_id, code ligne pour l'affichage
    {"nom": "Hippodrome de Vincennes", "parent_station": "IDFM:463642", "route_id": "IDFM:C02251", "ligne": "77"},
    {"nom": "École du Breuil", "parent_station": "IDFM:463645", "route_id": "IDFM:C01219", "ligne": "201"},
    {"nom": "École du Breuil", "parent_station": "IDFM:463645", "route_id": "IDFM:C02251", "ligne": "77"},
    {"nom": "Joinville-le-Pont", "parent_station": "IDFM:70640", "route_id": "STIF:Line::C01742:", "ligne": "RER A"},
]

today = datetime.now().date()
days = [today + timedelta(days=i) for i in range(1)]  # Aujourd'hui uniquement

print("Téléchargement des données GTFS…")
resp = requests.get(GTFS_URL)
z = zipfile.ZipFile(BytesIO(resp.content))

stops = pd.read_csv(z.open("stops.txt"))
stop_times = pd.read_csv(z.open("stop_times.txt"), low_memory=False)
trips = pd.read_csv(z.open("trips.txt"), low_memory=False)
calendar = pd.read_csv(z.open("calendar.txt"))
calendar_dates = pd.read_csv(z.open("calendar_dates.txt")) if "calendar_dates.txt" in z.namelist() else pd.DataFrame()
routes = pd.read_csv(z.open("routes.txt"))

# Initialisation des structures de stockage
rer_horaires = []
bus_data = {
    "77": {"horaires": [], "gares_par_destination": collections.OrderedDict()},
    "201": {"horaires": [], "gares_par_destination": collections.OrderedDict()},
}

for target in TARGETS:
    nom = target["nom"]
    parent_station = target["parent_station"]
    route_id = target["route_id"]
    ligne = target["ligne"]

    # Gestion spéciale pour Joinville → RER A
    if ligne == "RER A":
        stop_ids = stops[stops['stop_name'].str.contains("Joinville", case=False, na=False)]['stop_id'].tolist()
    else:
        stop_ids = stops[stops['parent_station'] == parent_station]['stop_id'].tolist()
        if parent_station in stops['stop_id'].values:
            stop_ids.append(parent_station)

    print(f"[DEBUG] {nom} → stop_ids : {stop_ids}")
    trips_line = trips[trips['route_id'] == route_id]

    for day in days:
        dow = day.weekday()
        active_service_ids = []
        for _, row in calendar.iterrows():
            start = datetime.strptime(str(row['start_date']), "%Y%m%d").date()
            end = datetime.strptime(str(row['end_date']), "%Y%m%d").date()
            if not (start <= day <= end):
                continue
            if dow < 5 and row['monday']: active_service_ids.append(row['service_id'])
            if dow == 5 and row['saturday']: active_service_ids.append(row['service_id'])
            if dow == 6 and row['sunday']: active_service_ids.append(row['service_id'])
        if not calendar_dates.empty:
            today_exceptions = calendar_dates[calendar_dates['date'] == int(day.strftime("%Y%m%d"))]
            for _, ex in today_exceptions.iterrows():
                if ex['exception_type'] == 1 and ex['service_id'] not in active_service_ids:
                    active_service_ids.append(ex['service_id'])
                if ex['exception_type'] == 2 and ex['service_id'] in active_service_ids:
                    active_service_ids.remove(ex['service_id'])

        trips_today = trips_line[trips_line['service_id'].isin(active_service_ids)]
        trip_ids_today = trips_today['trip_id'].tolist()

        for trip_id in trip_ids_today:
            stops_this_trip = stop_times[(stop_times['trip_id'] == trip_id) & (stop_times['stop_id'].isin(stop_ids))]
            for _, st in stops_this_trip.iterrows():
                time_str = st['departure_time'][:5]
                stop_seq = st['stop_sequence']
                dest = trips_today[trips_today['trip_id'] == trip_id]['trip_headsign'].values[0] if 'trip_headsign' in trips_today.columns else "?"
                remaining = stop_times[(stop_times['trip_id'] == trip_id) & (stop_times['stop_sequence'] > stop_seq)]
                remaining_stops = stops[stops['stop_id'].isin(remaining['stop_id'])]['stop_name'].tolist()

                if ligne == "RER A":
                    rer_horaires.append({
                        "time": time_str,
                        "destination": dest,
                        "gares_restantes": remaining_stops
                    })
                else:
                    bus_data[ligne]["horaires"].append({
                        "time": time_str,
                        "destination": dest
                    })
                    if dest not in bus_data[ligne]["gares_par_destination"]:
                        bus_data[ligne]["gares_par_destination"][dest] = remaining_stops

# Construction du JSON final
export_data = {
    "rer": {"horaires": rer_horaires},
    "bus77": bus_data["77"],
    "bus201": bus_data["201"],
    "lastFetch": int(datetime.now().timestamp())
}

with open("static/horaires_export.json", "w", encoding="utf-8") as f:
    json.dump(export_data, f, indent=2, ensure_ascii=False)

print("✅ Horaires GTFS optimisés exportés dans static/horaires_export.json")
