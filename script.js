document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib();
  fetchNews();
  fetchRaces();
  fetchAlerts();
  fetchDepartures();

  setInterval(updateDateTime, 10000);
});

function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// WEATHER
async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m,weathercode&timezone=Europe%2FParis");
    const data = await res.json();
    document.getElementById("weather").innerHTML = `<h3>🌤 Météo</h3><p>Température : ${data.current.temperature_2m}°C</p>`;
  } catch (err) {
    document.getElementById("weather").innerHTML = "<p>Erreur météo</p>";
  }
}

// VELIB
async function fetchVelib() {
  try {
    const res = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json");
    const data = await res.json();
    const station = data.data.stations.find(s => s.station_id === "13025");
    document.getElementById("velib").innerHTML = `<h3>🚲 Vélib'</h3><p>Station : ${station.name}</p>`;
  } catch {
    document.getElementById("velib").innerHTML = "<p>Erreur Vélib'</p>";
  }
}

// NEWS
async function fetchNews() {
  try {
    const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent("https://www.francetvinfo.fr/titres.rss"));
    const xml = await res.json();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml.contents, "application/xml");
    const items = doc.querySelectorAll("item");
    const headlines = [...items].slice(0, 5).map(i => i.querySelector("title").textContent).join(" • ");
    document.getElementById("news-ticker").textContent = headlines;
  } catch {
    document.getElementById("news-ticker").textContent = "Actualités indisponibles";
  }
}

// RACES
async function fetchRaces() {
  try {
    const res = await fetch("races.json");
    const data = await res.json();
    document.getElementById("races").innerHTML = `<h3>🏇 Courses</h3>${data.map(r => `<p>${r.date} : ${r.event}</p>`).join("")}`;
  } catch {
    document.getElementById("races").innerHTML = "<p>Pas de données courses</p>";
  }
}

// ALERTES
async function fetchAlerts() {
  try {
    const res = await fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports");
    const data = await res.json();
    const alerts = data.disruptions || [];
    const message = alerts.map(a => `⚠️ ${a.severity.name} : ${a.messages[0].text}`).join(" | ");
    document.getElementById("alertes").innerHTML = message || "✅ Trafic normal";
  } catch {
    document.getElementById("alertes").innerHTML = "Erreur infos trafic";
  }
}

// TRANSPORTS
async function fetchDepartures() {
  const stops = [
    { id: "STIF:StopArea:SP:43135:", label: "🚉 RER A – Joinville", element: "rer-a" },
    { id: "STIF:StopArea:SP:463641:", label: "🚌 Bus – Hippodrome", element: "bus-vincennes" },
    { id: "STIF:StopArea:SP:463644:", label: "🚌 Bus – École du Breuil", element: "bus-breuil" },
    { id: "STIF:StopArea:SP:463640:", label: "🚌 Bus – Joinville", element: "bus-joinville" }
  ];

  for (const stop of stops) {
    const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stop.id}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const visits = json.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit || [];

      if (visits.length === 0) {
        document.getElementById(stop.element).innerHTML = `<h3>${stop.label}</h3><p>🚫 Service terminé – prochain demain</p>`;
        continue;
      }

      const grouped = {};
      visits.forEach(v => {
        const dest = v.MonitoredVehicleJourney.DestinationName[0].value;
        const time = new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime);
        const status = v.MonitoredVehicleJourney.MonitoredCall.DepartureStatus;
        const delay = (new Date(v.RecordedAtTime) - new Date(time)) / 60000;
        const key = dest;
        grouped[key] = grouped[key] || [];
        grouped[key].push({ time, status, delay });
      });

      const html = Object.entries(grouped).map(([dest, arr]) => {
        const li = arr.slice(0, 4).map(d => {
          let badge = "";
          let cls = "";
          if (d.status === "cancelled") {
            badge = "❌ supprimé";
            cls = "alert";
          } else if (d.delay > 2) {
            badge = `⚠️ retardé de ${Math.round(d.delay)} min`;
            cls = "alert";
          } else {
            badge = "🟢 à l'heure";
          }
          return `<li class="${cls}">${d.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} → ${badge}</li>`;
        }).join("");

        return `<div class="destination"><strong>${dest}</strong><ul>${li}</ul></div>`;
      }).join("");

      document.getElementById(stop.element).innerHTML = `<h3>${stop.label}</h3>${html}`;

    } catch (err) {
      document.getElementById(stop.element).innerHTML = `<h3>${stop.label}</h3><p>Erreur données temps réel</p>`;
    }
  }
}
