document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib();
  fetchRaces();
  fetchAlerts();
  fetchRER();
  fetchBus("busJoinville", "STIF:StopArea:SP:43135:", "Joinville-le-Pont");
  fetchBus("busHippodrome", "STIF:StopArea:SP:463641:", "Hippodrome de Vincennes");

  setInterval(updateDateTime, 10000);
});

function updateDateTime() {
  const now = new Date();
  const el = document.getElementById("datetime");
  if (el) el.textContent = `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// Météo
async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m&timezone=Europe%2FParis");
    const data = await res.json();
    document.getElementById("weather").textContent = `🌤 Température : ${data.current.temperature_2m}°C`;
  } catch {
    document.getElementById("weather").textContent = "🌥 Météo indisponible";
  }
}

// Vélib
async function fetchVelib() {
  try {
    const res = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json");
    const info = await res.json();
    const stations = info.data.stations.filter(s => ["35115", "35027", "35028"].includes(s.station_id));
    document.getElementById("velib").innerHTML = stations.map(s => `<div class="card">${s.name}</div>`).join("");
  } catch {
    document.getElementById("velib").textContent = "🚲 Vélib indisponible";
  }
}

// Courses
async function fetchRaces() {
  try {
    const res = await fetch("races.json");
    const data = await res.json();
    document.getElementById("races").innerHTML = data.map(r => `<div class="card">${r.title} – ${r.date}</div>`).join("");
  } catch {
    document.getElementById("races").textContent = "🏇 Courses indisponibles";
  }
}

// Alertes
async function fetchAlerts() {
  try {
    const res = await fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/general-message");
    const data = await res.json();
    const alerts = data.general_messages?.filter(msg => msg.severity === "high") || [];
    document.getElementById("alerts").innerHTML = alerts.length
      ? alerts.map(a => `<div class="card">⚠️ ${a.title}</div>`).join("")
      : "✅ Pas d'alerte trafic majeure";
  } catch {
    document.getElementById("alerts").textContent = "⚠️ Données alertes indisponibles";
  }
}

// RER A
async function fetchRER() {
  const stopId = "STIF:StopArea:SP:43135:";
  try {
    const res = await fetch(`https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`);
    const data = await res.json();
    const passages = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

    const grouped = {};
    passages.forEach(p => {
      const dir = p.MonitoredVehicleJourney.DestinationName[0].value;
      if (!grouped[dir]) grouped[dir] = [];
      if (grouped[dir].length < 2) grouped[dir].push(p);
    });

    document.getElementById("rerA").innerHTML = Object.entries(grouped).map(([dest, items]) => `
      <div class="card">
        <strong>🚆 RER A → ${dest}</strong><br>
        ${items.map(i => {
          const t = new Date(i.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime);
          return `${t.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })} – 🟢 à l'heure<br>`;
        }).join("")}
      </div>`).join("");
  } catch {
    document.getElementById("rerA").textContent = "🚆 RER A indisponible";
  }
}

// Bus
async function fetchBus(containerId, stopId, label) {
  try {
    const res = await fetch(`https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`);
    const data = await res.json();
    const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

    const lines = {};
    visits.forEach(v => {
      const line = v.MonitoredVehicleJourney.LineRef.value.split("::")[2].replace(":", "");
      const dir = v.MonitoredVehicleJourney.DestinationName[0].value;
      const key = `${line} → ${dir}`;
      if (!lines[key]) lines[key] = [];
      if (lines[key].length < 2) lines[key].push(v);
    });

    document.getElementById(containerId).innerHTML = `<h3>🚌 ${label}</h3>` + Object.entries(lines).map(([k, arr]) => `
      <div class="card">
        <strong>${k}</strong><br>
        ${arr.map(v => {
          const t = new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime);
          return `${t.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}<br>`;
        }).join("")}
      </div>`).join("");
  } catch {
    document.getElementById(containerId).textContent = `🚌 ${label} indisponible`;
  }
}
