// === idfMob.js ===

const CORS_PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

const MONITORING_REFS = [
  { id: "STIF:StopArea:SP:43135:", container: "rer-a-passages", update: "rer-a-update" },
  { id: "STIF:StopArea:SP:463641:", container: "bus-77-passages", update: "bus-77-update" },
  { id: "STIF:StopArea:SP:463644:", container: "bus-201-passages", update: "bus-201-update" },
];

function formatAttente(date, now) {
  const diff = Math.round((date - now) / 60000);
  return diff <= 0 ? "🟢 imminent" : `⏳ dans ${diff} min`;
}

function highlightGare(name) {
  return `<span class="gare">${name}</span>`;
}

async function fetchAndDisplay(url, containerId, updateId) {
  try {
    const response = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const visits = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const now = new Date();

    if (visits.length === 0 ||
      !visits.some(v => new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) > now)) {
      let prochain = null;
      for (const v of visits) {
        const expected = new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime);
        if (expected > now) { prochain = expected; break; }
      }
      let msg = `<div class="aucun-passage">
        <span class="badge-termine">🚫 Service terminé</span><br>`;
      if (prochain) {
        msg += `<span class="prochain-passage">🕐 Prochain passage à <b>${prochain.toLocaleDateString('fr-FR', {weekday:'long', day:'2-digit', month:'long'})} ${prochain.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b></span>`;
      }
      msg += '</div>';
      container.innerHTML = msg;
      if (updateId) {
        const updateEl = document.getElementById(updateId);
        if (updateEl) updateEl.textContent = "Mise à jour : " + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      return;
    }

    const groups = {};
    visits.forEach(v => {
      const dest = v.MonitoredVehicleJourney.DestinationName?.[0]?.value || 'Inconnu';
      if (!groups[dest]) groups[dest] = [];
      groups[dest].push(v);
    });

    Object.entries(groups).forEach(([dest, group]) => {
      group.sort((a, b) => new Date(a.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) - new Date(b.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime));
      const premier = group[0];
      const dernier = group[group.length - 1];
      container.innerHTML += `<div class="sens-block"><div class="sens-title">Vers <b>${dest}</b></div>`;
      group.forEach((v, idx) => {
        const mvj = v.MonitoredVehicleJourney;
        const expected = new Date(mvj.MonitoredCall.ExpectedDepartureTime);
        const attenteTxt = formatAttente(expected, now);
        const isDernier = v === dernier;
        const onward = mvj.OnwardCalls?.OnwardCall?.map(call => call.StopPointName?.[0]?.value).filter(Boolean) || [];
        const arretActuel = mvj.MonitoredCall.StopPointName?.[0]?.value || "";
        let startIdx = onward.findIndex(st => st.toLowerCase() === arretActuel.toLowerCase());
        let nextGares = (startIdx >= 0) ? onward.slice(startIdx + 1) : onward;
        let garesHtml = nextGares.length ?
          `<div class="gares-defile">` + nextGares.map(station => highlightGare(station)).join(' <span>|</span> ') + '</div>'
          : '';
        container.innerHTML += `
          <div class="passage-block">
            <strong>🕐 ${expected.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</strong>
            <span> (${attenteTxt})</span>
            ${isDernier ? '<span class="dernier-train">DERNIER AVANT FIN SERVICE</span>' : ''}
            ${garesHtml}
          </div>
        `;
      });
      container.innerHTML += `<div class="premier-dernier">
        Premier départ : <b>${new Date(premier.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b> /
        Dernier départ : <b>${new Date(dernier.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b>
        </div></div>`;
    });

    if (updateId) {
      const updateEl = document.getElementById(updateId);
      if (updateEl) updateEl.textContent = "Mise à jour : " + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
  } catch (err) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '❌ Erreur chargement passages';
  }
}

export { MONITORING_REFS, fetchAndDisplay };
