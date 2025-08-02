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
  document.getElementById("datetime").textContent = `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// 🌤 Météo via Open-Meteo
async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m&timezone=Europe%2FParis");
    const data = await res.json();
    document.getElementById("weather").textContent = `Température : ${data.current.temperature_2m}°C`;
  } catch {
    document.getElementById("weather").textContent = "Météo indisponible";
  }
}

// 🚲 Vélib’
async function fetchVelib() {
  try {
    const res = await fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json");
    const data = await res.json();
    const stations = data.data.stations.filter(s => ["35027", "35028", "35115"].includes(s.station_id));
    document.getElementById("velib").innerHTML = stations.map(s => `<div class="card">📍 Station ${s.station_id} – 🚲 ${s.num_bikes_available} / 🔒 ${s.num_docks_available}</div>`).join("");
  } catch {
    document.getElementById("velib").textContent = "Données Vélib’ indisponibles";
  }
}

// 🐎 Courses
async function fetchRaces() {
  try {
    const res = await fetch("races.json");
    const data = await res.json();
    if (!data.length) throw new Error();
    document.getElementById("races").innerHTML = data.map(r => `<div class="card">${r.title} – ${r.date}</div>`).join("");
  } catch {
    document.getElementById("races").textContent = "Pas de données courses";
  }
}

// ⚠️ Alertes trafic
async function fetchAlerts() {
  try {
    const res = await fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/general-message");
    const data = await res.json();
    const alerts = data.general_messages.filter(msg => msg.severity === "high");
    document.getElementById("alerts").innerHTML = alerts.length ?
      alerts.map(a => `<div class="card">⚠️ ${a.title}</div>`).join("") :
      "✅ Trafic normal";
  } catch {
    document.getElementById("alerts").textContent = "⚠️ Alerte trafic indisponible";
  }
}

// 🚆 RER A
async function fetchRER() {
  const stopId = "STIF:StopArea:SP:43135:";
  try {
    const res = await fetch(`https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`);
    const data = await res.json();
    const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

    const grouped = {};
    visits.forEach(v => {
      const dir = v.MonitoredVehicleJourney.DestinationName[0].value;
      if (!grouped[dir]) grouped[dir] = [];
      if (grouped[dir].length < 2) grouped[dir].push(v);
    });

    document.getElementById("rerA").innerHTML = Object.entries(grouped).map(([dir, list]) => `
      <div class="card">
        <strong>${dir}</strong><br>
        ${list.map(v => {
          const t = new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime);
          const delay = v.MonitoredVehicleJourney.Delay;
          const status = delay ? `🔴 +${Math.round(delay / 60)} min` : "🟢 à l'heure";
          return `${t.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })} → ${status}`;
        }).join("<br>")}
      </div>
    `).join("");
  } catch {
    document.getElementById("rerA").textContent = "Données RER indisponibles";
  }
}

// 🚌 Bus par arrêt
async function fetchBus(containerId, stopId, label) {
  try {
    const res = await fetch(`https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopId}`);
    const data = await res.json();
    const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

    const grouped = {};
    visits.forEach(v => {
      const line = v.MonitoredVehicleJourney.LineRef.value.split(":").pop();
      const dir = v.MonitoredVehicleJourney.DestinationName[0].value;
      const key = `${line} → ${dir}`;
      if (!grouped[key]) grouped[key] = [];
      if (grouped[key].length < 2) grouped[key].push(v);
    });

    document.getElementById(containerId).innerHTML = Object.entries(grouped).map(([key, list]) => `
      <div class="card">
        <strong>${key}</strong><br>
        ${list.map(v => {
          const t = new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime);
          const delay = v.MonitoredVehicleJourney.Delay;
          const status = delay ? `🔴 +${Math.round(delay / 60)} min` : "🟢 à l'heure";
          return `${t.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })} → ${status}`;
        }).join("<br>")}
      </div>
    `).join("");
  } catch {
    document.getElementById(containerId).textContent = "Données bus indisponibles";
  }
}
