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

function log(msg) {
  const logDiv = document.getElementById("log-console");
  if (!logDiv) return;
  const entry = document.createElement("div");
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logDiv.appendChild(entry);
  if (logDiv.children.length > 15) logDiv.removeChild(logDiv.firstChild);
}

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

function fetchLineAlerts(lineCode) {
  const url = PROXY_BASE + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/${lineCode}`);
  console.log(`[fetchLineAlerts] Appel URL : ${url}`);
  fetch(url)
    .then(res => res.json())
    .then(data => {
      console.log("[fetchLineAlerts]", lineCode, data);
      const disruptions = data.disruptions || [];
      const container = document.getElementById("alerts");
      if (!container) return;

      container.innerHTML = "";

      if (disruptions.length === 0) {
        const okDiv = document.createElement("div");
        okDiv.className = "alert-ok";
        okDiv.innerHTML = `✅ Aucun incident signalé`;
        container.appendChild(okDiv);
        return;
      }

disruptions.forEach(d => {
  const message = (Array.isArray(d.messages) && d.messages[0]?.text)
    || d.description
    || d?.impact?.text
    || "ℹ️ Aucune information disponible.";

  const div = document.createElement("div");
  div.className = "alert-item";
  div.innerHTML = `⚠️ ${message}`;
  container.appendChild(div);
});

      });
    })
    .catch(err => console.error("Erreur fetchLineAlerts", lineCode, err));
}

const joinvilleLines = [
  "line:IDFM:C01742",
  "line:IDFM:C02251",
  "line:IDFM:C01219",
  "line:IDFM:C01130",
  "line:IDFM:C01135",
  "line:IDFM:C01137",
  "line:IDFM:C01139",
  "line:IDFM:C01260",
  "line:IDFM:C01399",
  "line:IDFM:C01502",
  "line:IDFM:C01365",
  "line:IDFM:C01644",
  "line:IDFM:C01760"
];
async function fetchJoinvilleBusTimes() {
  const stopId = "STIF:StopArea:SP:43135:";
  const proxyBase = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
  const url = `${proxyBase}/?url=${encodeURIComponent("https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=" + stopId)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

    const byLine = {};

    visits.forEach(v => {
      const lineRef = v.MonitoredVehicleJourney.LineRef.value.split(":").pop(); // ex: C02251
      const dest = v.MonitoredVehicleJourney.DestinationName[0].value;
      const key = `${lineRef}_${dest}`;

      if (!byLine[key]) byLine[key] = [];
      byLine[key].push(v);
    });

    for (const key in byLine) {
      const [code, dest] = key.split("_");
      const elId = {
        "C02251": "times-77",
        "C01130": "times-101",
        "C01135": "times-106",
        "C01137": "times-108",
        "C01399": "times-N33"
      }[code];

      if (!elId) continue;

      const container = document.getElementById(elId);
      if (!container) continue;

      const blocks = byLine[key]
        .slice(0, 2)
        .map(v => {
          const call = v.MonitoredVehicleJourney.MonitoredCall;
          const expected = new Date(call.ExpectedArrivalTime);
          const scheduled = new Date(call.AimedArrivalTime);
          const now = new Date();
          const remaining = Math.round((expected - now) / 60000);
          const delayMin = Math.round((expected - scheduled) / 60000);
          const isCancelled = v.MonitoredVehicleJourney?.VehicleStatus === "cancelled";
          const isImminent = remaining <= 1;
          const isLast = v.Extensions?.IsLastJourneyOfTheDay;

          let html = `<div class="time-block">`;

          html += `<span class="hour">🕒 ${expected.toLocaleTimeString("fr-FR", {hour:'2-digit', minute:'2-digit'})}</span>`;
          html += ` – <span>${remaining} min</span>`;

          if (isCancelled) html += ` ❌`;
          else if (delayMin > 2) html += ` 🔴 +${delayMin} min`;
          else if (isImminent) html += ` 🟢 imminent`;

          if (isLast) html += `<br><span class="notice-block red">Dernier passage</span>`;
          if (v.Extensions?.IsFirstJourneyOfTheDay) html += `<br><span class="notice-block">Premier passage</span>`;

          html += `</div>`;
          return html;
        });

      container.innerHTML = blocks.join("") || `<div class="notice-block">⏳ Pas de passage prochainement</div>`;
    }

  } catch (err) {
    console.error("Erreur fetchJoinvilleBusTimes:", err);
  }
}

// Lancer à l'arrivée de la page
document.addEventListener("DOMContentLoaded", () => {
  fetchJoinvilleBusTimes();
  setInterval(fetchJoinvilleBusTimes, 60 * 1000); // actualise chaque minute
});

function fetchAllJoinvilleAlerts() {
  const container = document.getElementById("alerts");
  if (!container) return;
  container.innerHTML = "";

  let found = false;

  joinvilleLines.forEach(lineCode => {
    const url = PROXY_BASE + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/${lineCode}`);
    console.log(`[fetchAllJoinvilleAlerts] Ligne ${lineCode} → ${url}`);
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const disruptions = data.disruptions || [];
        if (disruptions.length > 0) found = true;

        disruptions.forEach(d => {
          const message = d.messages?.[0]?.text || d.description || "Pas de détail";
          const div = document.createElement("div");
          div.className = "alert-item";
          div.innerHTML = `⚠️ ${message}`;
          container.appendChild(div);
        });
      })
      .catch(err => console.error(`[fetchAllJoinvilleAlerts] ${lineCode}`, err));
  });

  setTimeout(() => {
    if (!found && container.innerHTML.trim() === "") {
      console.log("[fetchAllJoinvilleAlerts] Aucune alerte trouvée");
      const okDiv = document.createElement("div");
      okDiv.className = "alert-ok";
      okDiv.innerHTML = `✅ Aucun incident signalé`;
      container.appendChild(okDiv);
    }
  }, 2000);
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

    document.getElementById(containerId).innerHTML = Object.entries(lines).map(([label, list]) => {
      return `
        <div class="card">
          <strong>${label}</strong><br>
          ${list.map(v => {
            const call = v.MonitoredVehicleJourney.MonitoredCall;
            const planned = new Date(call.AimedArrivalTime);
            const estimated = new Date(call.ExpectedArrivalTime || call.AimedArrivalTime);
            const cancelled = v.MonitoredVehicleJourney.Occupancy === "cancelled";
            const isLate = estimated - planned > 60000;
            const status = cancelled
              ? "❌ Supprimé"
              : isLate
              ? `⚠️ Retardé de +${Math.round((estimated - planned) / 60000)} min`
              : "🟢 À l'heure";

            return `${estimated.toLocaleTimeString("fr-FR", {hour:'2-digit',minute:'2-digit'})} → ${status}`;
          }).join("<br>")}
        </div>`;
    }).join("");

  } catch (err) {
    document.getElementById(containerId).textContent = "❌ Données bus indisponibles";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12163)&timezone=Europe%2FParis', 'velib-vincennes');
  fetchVelib('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12128)&timezone=Europe%2FParis', 'velib-breuil');
  fetchRaces();
  fetchAlerts();
  fetchLineAlerts("line:IDFM:C01742");
  fetchLineAlerts("line:IDFM:C02251");
  fetchLineAlerts("line:IDFM:C01219");
  fetchNews();
  fetchRER();  
  fetchBus("busJoinville", "STIF:StopArea:SP:43135:");
  fetchBus("busHippodrome", "STIF:StopArea:SP:463641:");
  fetchAllJoinvilleAlerts();
  setInterval(updateDateTime, 10000);

  log("🌤 Météo mise à jour");
  log("🚲 Vélib Vincennes mis à jour");
  log("📡 Données RER récupérées");
  log("📰 Actualités France Info mises à jour");
});
