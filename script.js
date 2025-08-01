// -------------------- PARAMÈTRES -------------------- //
const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev?url=";
const stations = [
  {
    id: "STIF:StopArea:SP:43135:",
    name: "Joinville-le-Pont",
    lines: ["C01742", "C02251", "C01130", "C01135", "C01137", "C01139", "C01141", "C01219", "C01260", "C01399"]
  },
  {
    id: "STIF:StopArea:SP:463641:",
    name: "Hippodrome de Vincennes",
    lines: ["C02251"]
  },
  {
    id: "STIF:StopArea:SP:463644:",
    name: "École du Breuil",
    lines: ["C01219"]
  }
];

// -------------------- DÉMARRAGE -------------------- //
document.addEventListener("DOMContentLoaded", () => {
  stations.forEach(station => {
    getDepartures(station.id, station.name, station.lines);
  });
});

// -------------------- DÉPARTS -------------------- //
async function getDepartures(monitoringRef, stationName, lineList) {
  const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/v2/stop-monitoring?MonitoringRef=${monitoringRef}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const visites = data.Siri.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

    const resultByLine = {};

    visites.forEach(v => {
      const monitored = v.MonitoredVehicleJourney;
      const lineRef = monitored.LineRef;
      const dir = monitored.DestinationName;
      const expected = new Date(monitored.MonitoredCall.ExpectedArrivalTime);
      const aimed = new Date(monitored.MonitoredCall.AimedArrivalTime);
      const delayMin = Math.round((expected - aimed) / 60000);
      const now = new Date();
      const remaining = Math.round((expected - now) / 60000);
      const status = monitored.Delay ? "⚠️ Retardé" : "🟢 À l'heure";
      const stops = monitored.MonitoredCall.StopPointRef || "N/A";

      if (!resultByLine[lineRef]) resultByLine[lineRef] = {};
      if (!resultByLine[lineRef][dir]) resultByLine[lineRef][dir] = [];

      resultByLine[lineRef][dir].push({
        aimed,
        remaining,
        status,
        stops
      });
    });

    renderDepartures(stationName, resultByLine);
  } catch (e) {
    console.error(`Erreur récupération pour ${stationName}`, e);
  }
}

// -------------------- AFFICHAGE -------------------- //
function renderDepartures(stationName, linesData) {
  const container = document.createElement("div");
  container.className = "station-block";

  const title = document.createElement("h2");
  title.innerHTML = `🚉 <span>${stationName}</span>`;
  container.appendChild(title);

  Object.entries(linesData).forEach(([line, dirs]) => {
    Object.entries(dirs).forEach(([dir, passages]) => {
      const dirBlock = document.createElement("div");
      dirBlock.innerHTML = `<strong>${line}</strong> → <strong>${dir}</strong>`;
      passages.slice(0, 4).forEach(p => {
        const row = document.createElement("div");
        row.className = "passage-row";
        row.innerHTML = `🕐 ${p.aimed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ⏳ ${p.remaining} min – ${p.status}`;
        dirBlock.appendChild(row);
      });
      container.appendChild(dirBlock);
    });
  });

  document.body.appendChild(container);
}
