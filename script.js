const proxyBase = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';
const primBase = 'https://prim.iledefrance-mobilites.fr/marketplace';

// Liste des arrêts à suivre
const stops = [
  {
    id: 'STIF:StopArea:SP:43135:',
    name: 'Joinville-le-Pont',
    line: 'RER A',
    container: 'rer'
  },
  {
    id: 'STIF:StopArea:SP:463641:',
    name: 'Hippodrome de Vincennes',
    line: 'Bus 77',
    container: 'bus77'
  },
  {
    id: 'STIF:StopArea:SP:463644:',
    name: 'École du Breuil',
    line: 'Bus 201',
    container: 'bus201'
  }
];

document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchNews();
  fetchVelibDirect('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12163)&timezone=Europe%2FParis', 'velib-vincennes');
  fetchVelibDirect('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12128)&timezone=Europe%2FParis', 'velib-breuil');
  stops.forEach(fetchStopMonitoring);
  setInterval(updateDateTime, 10000);
});

function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m&timezone=Europe%2FParis");
    const data = await res.json();
    const temp = data.current.temperature_2m;
    document.getElementById("weather").textContent = `🌡️ ${temp} °C`;
  } catch {
    document.getElementById("weather").textContent = '🌡️ Indisponible';
  }
}

async function fetchNews() {
  try {
    const res = await fetch('https://api.allorigins.win/get?url=https://www.francetvinfo.fr/titres.rss');
    const data = await res.json();
    document.getElementById("news").textContent = '📰 Actu chargée';
  } catch {
    document.getElementById("news").textContent = '📰 Actu indisponible.';
  }
}

async function fetchVelibDirect(url, containerId) {
  try {
    const response = await fetch(url);
    const stations = await response.json();
    const s = stations[0];
    document.getElementById(containerId).innerHTML = `
      <div class="velib-block">
        📍 ${s.name}<br>
        🚲 ${s.numbikesavailable} mécaniques | 🔌 ${s.ebike} électriques<br>
        🅿️ ${s.numdocksavailable} bornes
      </div>
    `;
    document.getElementById('velib-update').textContent = 'Mise à jour : ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  } catch {
    document.getElementById(containerId).innerHTML = '❌ Erreur Vélib’';
  }
}

async function fetchStopMonitoring(stop) {
  try {
    const url = `${proxyBase}${encodeURIComponent(`${primBase}/stop-monitoring?MonitoringRef=${stop.id}`)}`;
    const res = await fetch(url);
    const data = await res.json();
    const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;
    const container = document.getElementById(stop.container);
    container.innerHTML = `🚆 ${stop.line} – ${stop.name}`;

    visits.slice(0, 4).forEach(item => {
      const call = item.MonitoredVehicleJourney.MonitoredCall;
      const aimedTime = new Date(call.AimedDepartureTime);
      const now = new Date();
      const minutes = Math.round((aimedTime - now) / 60000);
      const delay = minutes > 0 ? `${minutes} min` : 'IMMINENT';
      const time = aimedTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
      const destination = item.MonitoredVehicleJourney.DestinationName?.[0]?.value || 'Destination inconnue';
      container.innerHTML += `<div>🕐 ${time} → ${destination}</div>`;
    });
  } catch (e) {
    document.getElementById(stop.container).innerHTML = `❌ Erreur ${stop.line}`;
  }
}
