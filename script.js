// script.js

const proxyBase = 'https://ratp-proxy.hippodrome-proxy42.workers.dev';
const PRIM_BASE = 'https://prim.iledefrance-mobilites.fr/marketplace/v2';

// Liste des arrêts à surveiller
const stops = [
  {
    id: 'STIF:StopArea:SP:463641:',
    name: 'Hippodrome de Vincennes',
    lines: ['C02251'],
  },
  {
    id: 'STIF:StopArea:SP:463644:',
    name: 'École du Breuil',
    lines: ['C01219'],
  },
  {
    id: 'STIF:StopArea:SP:43135:',
    name: 'Joinville-le-Pont',
    lines: ['C01742'],
  }
];

// Appels initiaux
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib();
  fetchNews();
  fetchRaces();
  fetchAlerts();
  fetchAllStops();

  setInterval(updateDateTime, 10000);
});

// Date et heure
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// Météo via Open-Meteo
async function fetchWeather() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m&timezone=Europe%2FParis";
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current.temperature_2m;
    document.getElementById("weather").innerHTML = `🌤️ Température actuelle : ${temp} °C`;
  } catch (e) {
    document.getElementById("weather").innerHTML = `⚠️ Météo indisponible`;
  }
}

// Vélib' via API Paris
async function fetchVelib() {
  try {
    const response = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json");
    const stationInfo = await response.json();

    const statusRes = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json");
    const stationStatus = await statusRes.json();

    const ids = [35119, 35016]; // Vincennes & École du Breuil
    const velibDiv = document.getElementById("velib");
    velibDiv.innerHTML = "";

    ids.forEach(id => {
      const info = stationInfo.data.stations.find(s => s.station_id == id);
      const status = stationStatus.data.stations.find(s => s.station_id == id);

      if (info && status) {
        velibDiv.innerHTML += `
          <div><strong>📍 ${info.name}</strong><br>
          🚲 ${status.num_bikes_available_types[0]?.mechanical || 0} méca |
          ⚡ ${status.num_bikes_available_types[1]?.ebike || 0} élec<br>
          🅿️ ${status.num_docks_available || 0} bornes</div><br>
        `;
      }
    });
  } catch (e) {
    document.getElementById("velib").innerHTML = "⚠️ Données Vélib indisponibles";
  }
}

// News France Info
async function fetchNews() {
  try {
    const res = await fetch("https://api.allorigins.win/get?url=https://www.francetvinfo.fr/titres.rss");
    const data = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(data.contents, "text/xml");
    const items = xml.querySelectorAll("item");
    const firstItem = items[0];

    const title = firstItem.querySelector("title").textContent;
    document.getElementById("news").innerHTML = `📰 ${title}`;
  } catch (e) {
    document.getElementById("news").innerHTML = `⚠️ Actus indisponibles`;
  }
}

// Courses hippiques (fichier local races.json)
async function fetchRaces() {
  try {
    const res = await fetch("races.json");
    const data = await res.json();
    const racesDiv = document.getElementById("races");
    racesDiv.innerHTML = data.races.map(r => `<div>🐎 ${r.title} – ${r.time}</div>`).join("");
  } catch (e) {
    const racesDiv = document.getElementById("races");
    if (racesDiv) racesDiv.innerHTML = "⚠️ Erreur de données";
  }
}

// Alertes trafic par ligne (line_reports)
async function fetchAlerts() {
  try {
    const res = await fetch(`${proxyBase}?url=${PRIM_BASE}/navitia/line_reports`);
    const data = await res.json();

    const lines = ["line:IDFM:C01219", "line:IDFM:C02251", "line:IDFM:C01742"];
    const alerts = data.line_reports.filter(report => lines.includes(report.line.id));

    const alertBox = document.getElementById("alerts");
    if (alerts.length === 0) {
      alertBox.innerHTML = `<div class="success">✅ Aucun incident signalé</div>`;
    } else {
      alertBox.innerHTML = alerts.map(a =>
        `<div class="warning">⚠️ ${a.line.name} : ${a.messages[0].text}</div>`
      ).join("");
    }
  } catch (e) {
    document.getElementById("alerts").innerHTML = `<div class="warning">⚠️ Alerte indisponible</div>`;
  }
}

// Prochains passages à chaque arrêt
async function fetchAllStops() {
  stops.forEach(stop => {
    stop.lines.forEach(line => {
      fetch(`${proxyBase}?url=${PRIM_BASE}/navitia/stop_areas/${stop.id}/departures?line=${line}&count=3`)
        .then(res => res.json())
        .then(data => {
          const div = document.getElementById(`stop-${stop.id}-${line}`);
          if (!div) return;
          const passages = data.departures.map(d => {
            const dt = new Date(d.display_informations.departure_date_time);
            return `🕐 ${dt.toLocaleTimeString("fr-FR")} → ${d.display_informations.direction.name}`;
          }).join("<br>");
          div.innerHTML = passages;
        })
        .catch(err => {
          const div = document.getElementById(`stop-${stop.id}-${line}`);
          if (div) div.innerHTML = "⚠️ Erreur de données";
        });
    });
  });
}
