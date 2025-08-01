const proxyBase = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';

// Liste des arrêts à surveiller (StopAreaRef)
const stops = [
  {
    id: 'STIF:StopArea:SP:43135:', // Joinville-le-Pont RER
    name: 'Joinville-le-Pont',
    lines: ['C01742'], // RER A
  },
  {
    id: 'STIF:StopArea:SP:463641:', // Hippodrome
    name: 'Hippodrome de Vincennes',
    lines: ['C02251'], // Bus 77
  },
  {
    id: 'STIF:StopArea:SP:463644:', // École du Breuil
    name: 'École du Breuil',
    lines: ['C01219'], // Bus 201
  }
];

// Chargement après le DOM
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib();
  fetchNews();
  fetchRaces();
  fetchAllTransports();
  fetchAlerts();

  setInterval(updateDateTime, 10000);
  setInterval(fetchAllTransports, 60000); // rafraîchissement toutes les 60 sec
});

// Affichage date & heure
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// --------- MODULE TRANSPORTS ---------
async function fetchAllTransports() {
  stops.forEach(async stop => {
    const bloc = document.getElementById(`bloc-${stop.name.replace(/\s+/g, '')}`);
    if (!bloc) return;

    try {
      const url = `${proxyBase}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stop.id}`;
      const res = await fetch(url);
      const data = await res.json();
      const passages = parseStopMonitoring(data);

      if (passages.length === 0) {
        bloc.innerHTML = `<p>⚠️ Aucun passage à venir</p>`;
        return;
      }

      bloc.innerHTML = `<h3>${stop.name}</h3>` + passages.map(p => `
        <div class="destination">
          <p>🚍 ${p.line} → ${p.destination}</p>
          <ul>
            <li>🕐 ${formatTime(p.expectedTime)} (${p.status})</li>
          </ul>
        </div>
      `).join('');
    } catch (e) {
      bloc.innerHTML = `<p>⚠️ Erreur de données</p>`;
      console.error(`Erreur stop ${stop.name}:`, e);
    }
  });
}

// Parsing des données SIRI
function parseStopMonitoring(data) {
  const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;
  if (!visits || visits.length === 0) return [];

  return visits.slice(0, 4).map(visit => {
    const journey = visit.MonitoredVehicleJourney;
    const line = journey?.LineRef?.value?.split("::")[2]?.replace(/:/g, "") || "???";
    const destination = journey?.MonitoredCall?.DestinationDisplay?.[0]?.value || "???";
    const expectedTime = journey?.MonitoredCall?.ExpectedDepartureTime;
    const status = journey?.DepartureStatus || "inconnu";
    return { line, destination, expectedTime, status };
  });
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --------- MODULE METEO ---------
async function fetchWeather() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m,weathercode&timezone=Europe%2FParis";
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current.temperature_2m;
    document.getElementById("weather").textContent = `🌤️ Température actuelle : ${temp} °C`;
  } catch {
    document.getElementById("weather").textContent = `⚠️ Erreur météo`;
  }
}

// --------- MODULE VELIB ---------
async function fetchVelib() {
  const stations = [
    { id: "21057", name: "Hippodrome Paris-Vincennes" },
    { id: "121018032", name: "Pyramide - École du Breuil" }
  ];

  const bloc = document.getElementById("velib");
  try {
    const res = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json");
    const data = await res.json();
    bloc.innerHTML = "";

    stations.forEach(({ id, name }) => {
      const station = data.data.stations.find(s => s.station_id === id);
      if (!station) return;

      bloc.innerHTML += `
        <p>📍 <strong>${name}</strong><br>
        🚲 ${station.num_bikes_available_types[0]?.mechanical || 0} méca |
        ⚡ ${station.num_bikes_available_types[1]?.ebike || 0} élec<br>
        🅿️ ${station.num_docks_available ?? '??'} bornes</p>`;
    });
  } catch (e) {
    bloc.innerHTML = `<p>⚠️ Erreur Vélib'</p>`;
  }
}

// --------- MODULE NEWS ---------
async function fetchNews() {
  try {
    const res = await fetch("https://www.francetvinfo.fr/titres.rss");
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const items = xml.querySelectorAll("item");
    const newsItems = [...items].slice(0, 5).map(item => item.querySelector("title")?.textContent);
    const ticker = document.getElementById("news-ticker");
    ticker.innerHTML = newsItems.join(" ⚫ ");
  } catch (e) {
    document.getElementById("news-ticker").textContent = "⚠️ Actus indisponibles";
  }
}

// --------- MODULE COURSES ---------
async function fetchRaces() {
  try {
    const res = await fetch("races.json");
    const data = await res.json();
    const bloc = document.getElementById("races");
    bloc.innerHTML = `<ul>${data.slice(0, 3).map(r => `<li>${r.date} – ${r.title}</li>`).join("")}</ul>`;
  } catch {
    document.getElementById("races").innerHTML = `<p>⚠️ Erreur données courses</p>`;
  }
}

// --------- MODULE ALERTES ---------
async function fetchAlerts() {
  const bloc = document.getElementById("alertes");
  try {
    const url = `${proxyBase}https://prim.iledefrance-mobilites.fr/marketplace/v2/general-message`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !data.general_messages || data.general_messages.length === 0) {
      bloc.innerHTML = "✅ Aucun incident signalé";
    } else {
      bloc.innerHTML = data.general_messages.map(msg =>
        `⚠️ ${msg.info_message.text?.fr || "Perturbation"}`
      ).join(" | ");
    }
  } catch (e) {
    bloc.innerHTML = "⚠️ Alerte indisponible";
  }
}