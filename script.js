const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev/";
const stopAreaJoinville = "STIF:StopArea:SP:70640";

const lines = [
  { id: "C02251", label: "77", destination: "Gare de Lyon" },
  { id: "IDFM:C01219", label: "101", destination: "Camping International" },
  { id: "IDFM:C01220", label: "106", destination: "Villiers-sur-Marne" },
  { id: "IDFM:C01221", label: "108", destination: "Champigny – Jeanne Vacher" },
  { id: "IDFM:C01222", label: "110", destination: "Villiers-sur-Marne" },
  { id: "IDFM:C01223", label: "112", destination: "Château de Vincennes" },
  { id: "IDFM:C01224", label: "112", destination: "La Varenne – Chennevières" },
  { id: "IDFM:C01225", label: "201", destination: "Porte Dorée" },
  { id: "IDFM:C01226", label: "201", destination: "Champigny – Diderot – La Plage" },
  { id: "IDFM:C01227", label: "281", destination: "Créteil-Europarc" },
];

async function fetchDepartures(line) {
  try {
    const url = proxy + "url=" + encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stopAreaJoinville}`
    );
    const res = await fetch(url);
    const data = await res.json();
    return data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit
      ?.filter(visit => visit.MonitoredVehicleJourney?.LineRef?.includes(line.id))
      ?.map(visit => {
        const call = visit.MonitoredVehicleJourney?.MonitoredCall;
        return {
          aimed: call?.AimedDepartureTime,
          expected: call?.ExpectedDepartureTime,
          cancelled: !visit.MonitoredVehicleJourney?.Monitored,
          destination: visit.MonitoredVehicleJourney?.DestinationName?.value || "?"
        };
      }) || [];
  } catch (e) {
    console.error("Erreur API pour", line.label, e);
    return [];
  }
}

async function fetchAlerts(line) {
  try {
    const url = proxy + "url=" + encodeURIComponent(
      `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:${line.id}/line_reports`
    );
    const res = await fetch(url);
    const data = await res.json();
    return data.line_reports || [];
  } catch (e) {
    console.error("Erreur alerte pour", line.label, e);
    return [];
  }
}

function minutesFromNow(time) {
  const t = new Date(time);
  const now = new Date();
  return Math.round((t - now) / 60000);
}

async function displayBusGrid() {
  const grid = document.getElementById("busGrid");

  for (const line of lines) {
    const departures = await fetchDepartures(line);
    const alerts = await fetchAlerts(line);

    const timesHTML = departures.slice(0, 2).map(dep => {
      if (dep.cancelled) return "<span class='tag'>❌ supprimé</span>";
      const mins = minutesFromNow(dep.expected || dep.aimed);
      const isLate = dep.expected && dep.expected !== dep.aimed;
      return `<span>${mins} min${isLate ? " ⚠️" : ""}</span>`;
    }).join("") || "<span class='tag'>❌ service terminé</span>";

    const alertHTML = alerts.length > 0
      ? `<div class='alert'>⚠️ ${alerts[0].messages[0].text}</div>`
      : "";

    const block = document.createElement("div");
    block.className = "bus-block";
    block.innerHTML = `
      <div class="bus-header">
        <span class="line">${line.label}</span>
        <span class="destination">${line.destination}</span>
      </div>
      <div class="bus-times">${timesHTML}</div>
    `;

    grid.appendChild(block);
    if (alertHTML) {
      const alertBlock = document.createElement("div");
      alertBlock.innerHTML = alertHTML;
      grid.appendChild(alertBlock);
    }
  }
}

document.addEventListener("DOMContentLoaded", displayBusGrid);
