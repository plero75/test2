
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib();
  fetchTransport();

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
    document.getElementById("weather").textContent = `🌡️ ${data.current.temperature_2m} °C`;
  } catch {
    document.getElementById("weather").textContent = "🌤️ Météo indisponible.";
  }
}

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

async function fetchTransport() {
  const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
  const stops = [
    { id: "STIF:StopArea:SP:43135:", target: "rer-a", name: "RER A" },
    { id: "STIF:StopArea:SP:463641:", target: "bus-77", name: "Bus 77" },
    { id: "STIF:StopArea:SP:463644:", target: "bus-201", name: "Bus 201" }
  ];

  for (const stop of stops) {
    const container = document.getElementById(stop.target);
    try {
      const url = proxy + encodeURIComponent(
        `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stop.id}`
      );
      const res = await fetch(url);
      const data = await res.json();
      const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

      if (!visits || visits.length === 0) {
        container.innerHTML += "<p>❌ Aucun passage prévu.</p>";
        continue;
      }

      for (const visit of visits.slice(0, 4)) {
        const call = visit.MonitoredVehicleJourney.MonitoredCall;
        const aimedRaw = call?.AimedArrivalTime || call?.AimedDepartureTime;
        const expectedRaw = call?.ExpectedArrivalTime || call?.ExpectedDepartureTime;
        const dest = visit.MonitoredVehicleJourney.DestinationName?.value || "Destination inconnue";

        const aimed = new Date(aimedRaw);
        const expected = new Date(expectedRaw);
        const diff = Math.round((expected - new Date()) / 60000);
        const status = call?.ArrivalStatus || "onTime";

        let badge = '<span class="badge">🕐</span>';
        if (status === "cancelled") badge = '<span class="badge red">❌ Supprimé</span>';
        else if (diff < 2) badge = '<span class="badge green">🟢 IMMINENT</span>';
        else if (Math.abs(aimed - expected) > 60000) badge = `<span class="badge orange">⚠️ +${diff} min</span>`;

        if (!isNaN(expected)) {
          container.innerHTML += `<div>${badge} ${expected.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} → ${dest}</div>`;
        }

        // Vérification et affichage des arrêts desservis
        const idvj = visit.MonitoredVehicleJourney.VehicleJourneyRef;
        if (idvj) {
          const vjUrl = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/vehicle_journeys/${idvj}`);
          fetch(vjUrl)
            .then(r => r.json())
            .then(vj => {
              if (vj.vehicle_journeys && vj.vehicle_journeys[0]) {
                const stopsList = vj.vehicle_journeys[0].stop_times.map(s => s.stop_point.name).join(" → ");
                container.innerHTML += `<div style="font-size:0.9em;color:#666;">📍 ${stopsList}</div>`;
              }
            })
            .catch(e => console.warn("Erreur vehicle_journey:", e));
        }
      }
    } catch (e) {
      console.warn(`[Transport] Erreur sur ${stop.name}`, e);
      container.innerHTML += "<p>⚠️ Erreur ou API indisponible.</p>";
    }
  }
}
