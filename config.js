document.addEventListener("DOMContentLoaded", async () => {
  const proxy = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

  const lines = [
    { name: "77", id: "C02251", stopArea: "STIF:StopArea:SP:463641", mode: "bus" },
    { name: "201", id: "C01219", stopArea: "STIF:StopArea:SP:463644", mode: "bus" },
    { name: "RER A", id: "C01742", stopArea: "STIF:StopArea:SP:43135", mode: "rer" }
  ];

  async function fetchDepartures(stopArea, lineId) {
    const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${encodeURIComponent(stopArea)}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Erreur stop-monitoring pour ${lineId}`);
      return [];
    }

    const data = await response.json();
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

    return visits
      .filter(v => v.MonitoredVehicleJourney?.LineRef?.includes(lineId))
      .map(v => {
        const mj = v.MonitoredVehicleJourney;
        const call = mj.MonitoredCall;
        return {
          destination: mj.DestinationName,
          expected: call?.ExpectedArrivalTime,
          aimed: call?.AimedArrivalTime,
          status: mj.ProgressStatus,
          vehicleJourneyId: mj.VehicleJourneyRef
        };
      });
  }

  async function fetchAlerts(lineId) {
    const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/line:${lineId}/line_reports`;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return data.line_reports.map(r => r.message).join(" – ");
    } catch {
      return null;
    }
  }

  function formatDelay(aimed, expected) {
    if (!aimed || !expected) return "";
    const delay = new Date(expected) - new Date(aimed);
    if (delay >= 90000) return `⚠️ Retardé de +${Math.round(delay / 60000)} min`;
    return "";
  }

  function formatTimeRemaining(expectedTime) {
    const now = new Date();
    const expected = new Date(expectedTime);
    const diff = (expected - now) / 60000;
    if (diff < 0) return "❌ Supprimé";
    if (diff < 1.5) return "🟢 Imminent";
    return `⏳ ${Math.round(diff)} min`;
  }

  function createBlock(line, departures, alert) {
    const bloc = document.createElement("div");
    bloc.className = "transport-block";

    const header = document.createElement("h3");
    header.innerHTML = `🚍 ${line.mode === "rer" ? "🚆" : "🚌"} Ligne ${line.name}`;
    bloc.appendChild(header);

    if (alert) {
      const alertEl = document.createElement("div");
      alertEl.className = "alert";
      alertEl.textContent = `⚠️ ${alert}`;
      bloc.appendChild(alertEl);
    }

    departures.slice(0, 4).forEach(dep => {
      const row = document.createElement("p");
      const delayText = formatDelay(dep.aimed, dep.expected);
      const remainingText = formatTimeRemaining(dep.expected);
      const aimedHour = new Date(dep.aimed).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const expectedHour = new Date(dep.expected).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const showRetard = delayText ? ` (${aimedHour} → ${expectedHour})` : "";

      row.textContent = `${dep.destination} – ${remainingText} ${delayText}${showRetard}`;
      bloc.appendChild(row);
    });

    return bloc;
  }

  async function displayAll() {
    const container = document.getElementById("busBlock");
    container.innerHTML = "";

    for (let line of lines) {
      const [departures, alerts] = await Promise.all([
        fetchDepartures(line.stopArea, line.id),
        fetchAlerts(line.id)
      ]);

      const block = createBlock(line, departures, alerts);
      container.appendChild(block);
    }
  }

  displayAll();
});
