// === CONFIGURATION ===
const CORS_PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
const MONITORING_REFS = [
  { id: "STIF:StopArea:SP:43135:", container: "rer-a-passages", update: "rer-a-update", alert: "rer-a-alert" },
  { id: "STIF:StopArea:SP:463641:", container: "bus-77-passages", update: "bus-77-update", alert: "bus-77-alert" },
  { id: "STIF:StopArea:SP:463644:", container: "bus-201-passages", update: "bus-201-update", alert: "bus-201-alert" },
];

// === HORLOGE ===
function updateDateTime() {
  const now = new Date();
  const formatted = now.toLocaleString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  document.getElementById('datetime').textContent = formatted;
  document.getElementById('datetime-footer').textContent = formatted;
}

// === MÉTÉO ===
async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.423&current_weather=true");
    const data = await res.json();
    const w = data.current_weather;
    document.getElementById("weather-summary").innerHTML = getWeatherIcon(w.weathercode) +
      `🌡 ${w.temperature}°C &nbsp;&nbsp;💨 ${w.windspeed} km/h &nbsp;&nbsp;(${w.weathercode})`;
    document.getElementById("weather-update").textContent = "Météo : " + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch {
    document.getElementById("weather-summary").textContent = "❌ Erreur météo";
  }
}

function getWeatherIcon(code) {
  if (code < 3) return "☀️";
  if (code < 45) return "⛅";
  if (code < 60) return "🌧️";
  if (code < 80) return "⛈️";
  return "❓";
}

// === VELIB ===
async function fetchVelib(url, containerId) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    const s = data[0];
    document.getElementById(containerId).innerHTML = `
      <div class="velib-block">
        📍 ${s.name}<br>
        🚲 ${s.numbikesavailable} mécaniques | 🔌 ${s.ebike} électriques<br>
        🅿️ ${s.numdocksavailable} bornes
      </div>`;
    document.getElementById('velib-update').textContent = 'Vélib : ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch {
    document.getElementById(containerId).textContent = "❌ Erreur Vélib’";
  }
}

// === NEWS ===
async function fetchNewsTicker() {
  try {
    const rssUrl = 'https://www.francetvinfo.fr/titres.rss';
    const url = `${CORS_PROXY}${encodeURIComponent(rssUrl)}`;
    const res = await fetch(url);
    const xmlText = await res.text();
    const rss = new DOMParser().parseFromString(xmlText, 'text/xml');
    const items = rss.querySelectorAll('item');
    const titles = Array.from(items).slice(0, 5).map(el => el.querySelector('title').textContent.trim()).join(' • ');
    document.getElementById('newsTicker').innerText = titles;
  } catch (e) {
    console.error('🛑 Erreur flux RSS :', e);
    document.getElementById('newsTicker').innerText = '';
  }
}

// === ALERTES TRAFIC ===
async function fetchAlert(lineCode, containerId) {
  try {
    const url = `${CORS_PROXY}https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/general-message?line_external_code=${lineCode}`;
    const res = await fetch(url);
    const data = await res.json();
    const messages = data.messages || [];
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if (messages.length > 0) {
      messages.forEach(msg => {
        const text = msg.texts?.[0]?.value || "⚠️ Message trafic";
        el.innerHTML += `<div class="alert-banner">⚠️ ${text}</div>`;
      });
    }
  } catch (e) {
    console.warn("Pas d'alerte trafic pour", lineCode);
  }
}

// === PASSAGES ===
async function fetchAndDisplay(url, containerId, updateId) {
  try {
    const res = await fetch(CORS_PROXY + encodeURIComponent(url));
    const data = await res.json();
    const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const now = new Date();
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!visits.length || !visits.some(v => new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) > now)) {
      container.innerHTML = `<div class="aucun-passage">🚫 Service terminé</div>`;
      return;
    }

    const groups = {};
    visits.forEach(v => {
      const dest = v.MonitoredVehicleJourney.DestinationName?.[0]?.value || "Inconnu";
      groups[dest] = groups[dest] || [];
      groups[dest].push(v);
    });

    for (const [dest, group] of Object.entries(groups)) {
      group.sort((a, b) => new Date(a.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) - new Date(b.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime));
      container.innerHTML += `<div class="sens-block"><div class="sens-title">Vers <b>${dest}</b></div>`;
      group.forEach((v, idx) => {
        const mvj = v.MonitoredVehicleJourney;
        const expected = new Date(mvj.MonitoredCall.ExpectedDepartureTime);
        const attente = formatAttente(expected, now);
        const isLast = idx === group.length - 1;
        container.innerHTML += `
          <div class="passage-block">
            🕐 ${expected.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
            (${attente}) ${isLast ? '<span class="dernier-train">Dernier départ</span>' : ''}
          </div>`;
      });
      container.innerHTML += `</div>`;
    }

    if (updateId) {
      document.getElementById(updateId).textContent = "Mise à jour : " + now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    }

  } catch {
    document.getElementById(containerId).textContent = "❌ Erreur chargement passages";
  }
}

function formatAttente(expected, now) {
  const diff = Math.round((expected - now) / 60000);
  if (diff < 0) return "passé";
  if (diff < 2) return "🟢 imminent";
  return `⏳ dans ${diff} min`;
}

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  setInterval(updateDateTime, 60000);

  fetchWeather();
  fetchVelib("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12163)", "velib-vincennes");
  fetchVelib("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12128)", "velib-breuil");

  fetchNewsTicker();

  MONITORING_REFS.forEach(ref => {
    fetchAndDisplay(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${ref.id}`, ref.container, ref.update);
  });

  // === ALERTES PAR LIGNE ===
  fetchAlert("C01742", "rer-a-alert");   // RER A
  fetchAlert("C02251", "bus-77-alert");  // Bus 77
  fetchAlert("C01219", "bus-201-alert"); // Bus 201
});
