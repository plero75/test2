const VELIB_IDS = ["35115", "35027", "35028"];
const PROXY_BASE = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";



function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m&timezone=Europe%2FParis");
    const data = await res.json();
    document.getElementById("weather").textContent = `Température : ${data.current.temperature_2m} °C`;
  } catch (err) {
    document.getElementById("weather").textContent = "Météo indisponible";
  }
}

// --- Vélib (2 stations) ---
async function fetchVelib(url, containerId) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const stations = await response.json();
    const s = stations[0];
    document.getElementById(containerId).innerHTML = `
      <div class="velib-block">
        📍 ${s.name}<br>
        🚲 ${s.numbikesavailable} mécaniques&nbsp;|&nbsp;🔌 ${s.ebike} électriques<br>
        🅿️ ${s.numdocksavailable} bornes
      </div>
    `;
    document.getElementById('velib-update').textContent = 'Mise à jour : ' + (new Date()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (err) {
    document.getElementById(containerId).innerHTML = '❌ Erreur Vélib’';
  }
}

 

async function fetchRaces() {
  try {
    const res = await fetch("races.json");
    const data = await res.json();
    document.getElementById("races").innerHTML = data.map(r => `<div class="card">${r.title} – ${r.date}</div>`).join("");
  } catch (err) {
    document.getElementById("races").textContent = "Pas de données courses disponibles (vérifiez le fichier races.json)";
  }
}

async function fetchAlerts() {
  try {
    const url = PROXY_BASE + encodeURIComponent("https://prim.iledefrance-mobilites.fr/marketplace/navitia/general-message");
    const res = await fetch(url);
    const data = await res.json();
    const alerts = data.general_messages || [];
    document.getElementById("alerts").innerHTML = alerts.length
      ? alerts.map(a => `<div class="card">${a.title}</div>`).join("")
      : "✅ Pas d'alerte majeure";
  } catch (err) {
    document.getElementById("alerts").textContent = "Alerte trafic indisponible";
  }
}

async function fetchLineAlerts(lineId, containerId) {
  try {
    const url = PROXY_BASE + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/${lineId}`);
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[fetchLineAlerts] ${lineId}`, data);

    const disruptions = data.disruptions || [];

    const icons = {
      "incident": "🚨",
      "work": "🚧",
      "information": "ℹ️",
      "other": "⚠️"
    };

    document.getElementById(containerId).innerHTML = disruptions.length
      ? disruptions.map(d => {
          const type = d.severity?.effect ?? "other";
          const emoji = icons[type] || "⚠️";
          const title = d.title?.text ?? "Alerte";
          const message = d.message?.text ?? "Pas de détail.";
          return `<div class="card">${emoji} <strong>${title}</strong><br>${message}</div>`;
        }).join("")
      : "✅ Aucun incident signalé";
  } catch (err) {
    console.error(`[fetchLineAlerts] Erreur pour ${lineId}`, err);
    document.getElementById(containerId).textContent = "❌ Erreur de chargement";
  }
}


async function fetchNews() {
  try {
    const res = await fetch("https://api.allorigins.win/get?url=https%3A%2F%2Fwww.francetvinfo.fr%2Ftitres.rss");
    const data = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(data.contents, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, 3);
    document.getElementById("news").innerHTML = items.map(i => `<div class="card">📵️ ${i.querySelector("title").textContent}</div>`).join("");
  } catch (err) {
    document.getElementById("news").textContent = "Actualités indisponibles";
  }
}

async function fetchRER() {
  const stopId = "STIF:StopArea:SP:43135:";
  try {
    const url = PROXY_BASE + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`);
    const res = await fetch(url);
    const data = await res.json();
    const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    document.getElementById("rerA").innerHTML = groupAndRender(visits);
  } catch (err) {
    document.getElementById("rerA").textContent = "Données RER indisponibles";
  }
}

async function fetchBus(containerId, stopId) {
  try {
    const url = PROXY_BASE + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`);
    const res = await fetch(url);
    const data = await res.json();
    const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const lines = {};
    visits.forEach(v => {
      const line = v.MonitoredVehicleJourney.LineRef.value.split(":").pop();
      const dir = v.MonitoredVehicleJourney.DestinationName[0].value;
      const key = `${line} → ${dir}`;
      if (!lines[key]) lines[key] = [];
      if (lines[key].length < 2) lines[key].push(v);
    });
    document.getElementById(containerId).innerHTML = Object.entries(lines).map(([label, list]) => `
      <div class="card">
        <strong>${label}</strong><br>
        ${list.map(v => {
          const time = new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime);
          const delay = v.MonitoredVehicleJourney.Delay;
          const status = delay ? `🔴 Retard ${Math.round(delay / 60)} min` : "🟢 à l'heure";
          return `${time.toLocaleTimeString("fr-FR", {hour:'2-digit',minute:'2-digit'})} → ${status}`;
        }).join("<br>")}
      </div>`).join("");
  } catch (err) {
    document.getElementById(containerId).textContent = "Données bus indisponibles";
  }
}

function groupAndRender(visits, maxItems = 3) {
  const grouped = {};
  visits.forEach(p => {
    const dest = p.MonitoredVehicleJourney.DestinationName[0].value;
    if (!grouped[dest]) grouped[dest] = [];
    if (grouped[dest].length < maxItems) grouped[dest].push(p);
  });
  return Object.entries(grouped).map(([dest, items]) => `
    <div class="card">
      <strong>${dest}</strong><br>
      ${items.map(i => {
        const time = new Date(i.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime);
        const delay = i.MonitoredVehicleJourney.Delay;
        const status = delay ? `🔴 Retard ${Math.round(delay / 60)} min` : "🟢 à l'heure";
        return `${time.toLocaleTimeString("fr-FR", {hour:'2-digit',minute:'2-digit'})} → ${status}`;
      }).join("<br>")}
    </div>`).join("");
}
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12163)&timezone=Europe%2FParis', 'velib-vincennes');
  fetchVelib('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12128)&timezone=Europe%2FParis', 'velib-breuil');
  fetchRaces();
  fetchAlerts();
  fetchLineAlerts("line:IDFM:C01742", "alert-rerA");     // RER A
  fetchLineAlerts("line:IDFM:C02251", "alert-bus77");    // Bus 77
  fetchLineAlerts("line:IDFM:C01219", "alert-bus201");   // Bus 201
  fetchNews();
  fetchRER();
  fetchBus("busJoinville", "STIF:StopArea:SP:43135:");
  fetchBus("busHippodrome", "STIF:StopArea:SP:463641:");
  setInterval(updateDateTime, 10000);
});
