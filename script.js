
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib();
  fetchNews();
  fetchTransport();

  setInterval(updateDateTime, 10000);
});

// 🕐 Heure et date
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// 🌤️ Météo
async function fetchWeather() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m,weathercode&timezone=Europe%2FParis");
    const data = await res.json();
    document.getElementById("weather").textContent = `🌡️ ${data.current.temperature_2m} °C`;
  } catch {
    document.getElementById("weather").textContent = "🌤️ Météo indisponible.";
  }
}

// 🚲 Vélib
async function fetchVelib() {
  try {
    const [info, status] = await Promise.all([
      fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json").then(r => r.json()),
      fetch("https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json").then(r => r.json())
    ]);
    const ids = ["12123", "21329"];
    const html = ids.map(id => {
      const i = info.data.stations.find(s => s.station_id === id);
      const s = status.data.stations.find(s => s.station_id === id);
      return `🚲 ${i.name} : ${s.num_bikes_available} vélos, ${s.num_docks_available} places`;
    }).join("<br>");
    document.getElementById("velib").innerHTML = html;
  } catch {
    document.getElementById("velib").textContent = "🚲 Vélib’ indisponible.";
  }
}

// 📰 News
async function fetchNews() {
  try {
    const xml = await fetch("https://www.francetvinfo.fr/titres.rss").then(r => r.text());
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, 3);
    const html = items.map(i => `📰 ${i.querySelector("title").textContent}`).join("<br>");
    document.getElementById("news").innerHTML = html;
  } catch {
    document.getElementById("news").textContent = "📰 Actu indisponible.";
  }
}

// 🚍 Transport
async function fetchTransport() {
  const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev";
  const stops = [
    { id: "STIF:StopArea:SP:43135:", target: "rer-a", name: "RER A" },
    { id: "STIF:StopArea:SP:463641:", target: "bus-77", name: "Bus 77" },
    { id: "STIF:StopArea:SP:463644:", target: "bus-201", name: "Bus 201" }
  ];

  for (const stop of stops) {
    const container = document.getElementById(stop.target);
    try {
      const url = proxy + "?url=" + encodeURIComponent("https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=...");
      const res = await fetch(url);
      const data = await res.json();
      const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

      if (!visits || visits.length === 0) {
        container.innerHTML += "<p>❌ Aucun passage prévu.</p>";
        continue;
      }

      for (const visit of visits.slice(0, 4)) {
        const call = visit.MonitoredVehicleJourney.MonitoredCall;
        const aimed = new Date(call.AimedArrivalTime);
        const expected = new Date(call.ExpectedArrivalTime);
        const dest = visit.MonitoredVehicleJourney.DestinationName;
        const status = call.ArrivalStatus;
        const idvj = visit.MonitoredVehicleJourney.VehicleJourneyRef;
        const diff = Math.round((expected - new Date()) / 60000);
        let badge = '<span class="badge">🕐</span>';

        if (status === "cancelled") badge = '<span class="badge red">❌ Supprimé</span>';
        else if (diff < 2) badge = '<span class="badge green">🟢 IMMINENT</span>';
        else if (expected.getTime() !== aimed.getTime()) badge = `<span class="badge orange">⚠️ +${diff} min</span>`;

        const line = `<div>${badge} ${expected.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} → ${dest}</div>`;
        container.innerHTML += line;

        // Liste des arrêts desservis
        fetch(proxy + "/marketplace/vehicle_journeys/" + idvj)
          .then(r => r.json())
          .then(vj => {
            const stops = vj.vehicle_journeys[0].stop_times.map(s => s.stop_point.name).join(" → ");
            container.innerHTML += `<div style="font-size:0.9em;color:#666;">📍 ${stops}</div>`;
          });
      }

      // Alertes trafic
      fetch(proxy + "/marketplace/general-message?LineRef=" + stop.id)
        .then(r => r.json())
        .then(msg => {
          if (msg.Siri.ServiceDelivery.GeneralMessageDelivery[0]?.InfoMessage) {
            container.innerHTML += `<div style="color:darkred;">⚠️ ${msg.Siri.ServiceDelivery.GeneralMessageDelivery[0].InfoMessage[0].Message.Text}</div>`;
          }
        });

    } catch (e) {
      container.innerHTML += "<p>⚠️ Erreur ou API indisponible.</p>";
    }
  }
}
