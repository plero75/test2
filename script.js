const CORS_PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

// === Horloge ===
function updateDateTime() {
  const now = new Date();
  const opt = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  document.getElementById('datetime').textContent = now.toLocaleString('fr-FR', opt);
  document.getElementById('datetime-footer').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// === Météo ===
async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.423&current_weather=true");
    const data = await res.json();
    const w = data.current_weather;
    document.getElementById("weather-summary").innerHTML = getWeatherIcon(w.weathercode) + `🌡 ${w.temperature}°C  💨 ${w.windspeed} km/h`;
    document.getElementById("weather-update").textContent = "Météo à " + (new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// === Vélib ===
async function fetchVelib(url, containerId) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    const s = data[0];
    document.getElementById(containerId).innerHTML = `
      📍 ${s.name}<br>
      🚲 ${s.numbikesavailable} mécaniques | 🔌 ${s.ebike} électriques | 🅿️ ${s.numdocksavailable} bornes`;
  } catch {
    document.getElementById(containerId).textContent = "❌ Erreur Vélib’";
  }
}

// === Actus ===
async function fetchNewsTicker() {
  try {
    const rssUrl = 'https://www.francetvinfo.fr/titres.rss';
    const url = `${CORS_PROXY}${encodeURIComponent(rssUrl)}`;
    const res = await fetch(url);
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const titles = [...doc.querySelectorAll("item")].slice(0, 6).map(e => e.querySelector("title").textContent).join(" • ");
    document.getElementById("newsTicker").innerText = titles;
  } catch {
    document.getElementById("newsTicker").innerText = "❌ Erreur flux actu";
  }
}

// === Alertes trafic ===
async function fetchTrafficAlert(lineId, containerId) {
  try {
    const url = `${CORS_PROXY}https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=${lineId}`;
    const res = await fetch(url);
    const data = await res.json();
    const messages = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];

    const alerts = messages.map(msg => msg?.Content?.Message?.[0]?.value).filter(Boolean);
    if (alerts.length) {
      document.getElementById(containerId).innerHTML = `⚠️ ${alerts.join(" • ")}`;
    } else {
      document.getElementById(containerId).innerHTML = "";
    }
  } catch {
    document.getElementById(containerId).innerHTML = "❌ Erreur alerte trafic";
  }
}

// === Horaires / passages ===
async function fetchPassages(stopId, containerId, lineClass) {
  try {
    const url = `${CORS_PROXY}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`;
    const res = await fetch(url);
    const data = await res.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const now = new Date();
    const el = document.getElementById(containerId);
    el.innerHTML = "";

    if (!visits.length) {
      el.innerHTML = `<div class="service-ended">🚫 Service terminé</div>`;
      return;
    }

    const grouped = {};
    visits.forEach(v => {
      const dest = v.MonitoredVehicleJourney.DestinationName?.[0]?.value || "Inconnu";
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push(v);
    });

    for (const [dest, group] of Object.entries(grouped)) {
      group.sort((a, b) =>
        new Date(a.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) -
        new Date(b.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime)
      );
      group.slice(0, 4).forEach(v => {
        const mvj = v.MonitoredVehicleJourney;
        const dep = new Date(mvj.MonitoredCall.ExpectedDepartureTime);
        const delay = Math.round((dep - now) / 60000);
        const isCancelled = mvj.MonitoredCall.DepartureStatus === "cancelled";

        el.innerHTML += `
          <div class="departure-line">
            <span class="icon-line ${lineClass}">${mvj.PublishedLineName}</span>
            <span class="destination">Vers ${dest}</span>
            <span class="time-box">${dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              (${isCancelled ? "❌ supprimé" : delay < 1 ? "🟢 imminent" : `⏳ dans ${delay} min`})
            </span>
          </div>`;
      });
    }
  } catch {
    document.getElementById(containerId).innerHTML = "❌ Erreur passages";
  }
}

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  setInterval(updateDateTime, 60000);

  fetchWeather();
  fetchNewsTicker();
  fetchVelib("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?q=12163", "velib-vincennes");
  fetchVelib("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?q=12128", "velib-breuil");

  fetchPassages("STIF:StopArea:SP:43135:", "rer-a-passages", "rer-a");
  fetchPassages("STIF:StopArea:SP:463641:", "bus-77-passages", "bus-77");
  fetchPassages("STIF:StopArea:SP:463644:", "bus-201-passages", "bus-201");

  fetchTrafficAlert("STIF:Line::C01742:", "rer-a-alert");
  fetchTrafficAlert("STIF:Line::C02251:", "bus-77-alert");
  fetchTrafficAlert("STIF:Line::C01219:", "bus-201-alert");
});
