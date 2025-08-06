document.addEventListener("DOMContentLoaded", async function () {
  const busContainer = document.getElementById("busBlock");
  const rerContainer = document.getElementById("rerGrid");

  const lines = [
    { name: "77", id: "C02251", stopArea: "STIF:StopArea:SP:463641", mode: "bus" },
    { name: "201", id: "C01219", stopArea: "STIF:StopArea:SP:463644", mode: "bus" },
    { name: "RER A", id: "C01742", stopArea: "STIF:StopArea:SP:43135", mode: "rer" }
  ];

  for (const line of lines) {
    try {
      const departures = await fetchDepartures(line.stopArea, line.id);
      const alerts = await fetchAlerts(line.id);
      const container = line.mode === "rer" ? rerContainer : busContainer;

      const block = document.createElement("div");
      block.className = "transport-block";
      block.innerHTML = `
        <div class="line-header">${getIcon(line.mode)} <span class="line-name">${line.name}</span></div>
        <div class="departures">
          ${departures.map(dep => formatDeparture(dep)).join("")}
        </div>
        ${alerts.length > 0 ? `<div class="alerts">⚠️ ${alerts.join("<br>")}</div>` : ""}
      `;

      container.appendChild(block);
    } catch (error) {
      console.error("Erreur récupération données pour", line.name, error);
    }
  }
});

function getIcon(mode) {
  if (mode === "rer") return "🚆";
  if (mode === "bus") return "🚌";
  return "🚍";
}

async function fetchDepartures(stopAreaId, lineId) {
  const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=` +
    encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopAreaId}`);
  const response = await fetch(url);
  const data = await response.json();

  return data.MonitoredStopVisit
    .filter(item => item.MonitoredVehicleJourney.LineRef.endsWith(lineId))
    .slice(0, 4);
}

async function fetchAlerts(lineId) {
  const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=` +
    encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:${lineId}/line_reports`);
  const response = await fetch(url);
  if (!response.ok) return [];

  const data = await response.json();
  return (data.line_reports || []).map(report => report.message.text);
}

function formatDeparture(dep) {
  const aimed = new Date(dep.MonitoredVehicleJourney.MonitoredCall.AimedArrivalTime);
  const expected = new Date(dep.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime);
  const now = new Date();
  const delayMin = Math.round((expected - aimed) / 60000);
  const remainingMin = Math.round((expected - now) / 60000);

  let delayText = delayMin > 1 ? ` (+${delayMin} min)` : "";
  let imminent = remainingMin <= 1 ? "🟢 <strong>Imminent</strong>" : `${remainingMin} min`;

  return `<div class="departure">
    <span class="time">${expected.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    <span class="in">${imminent}</span>${delayText}
  </div>`;
}
