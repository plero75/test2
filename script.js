// script.js — version mise à jour avec affichage dynamique des arrêts du RER A à Joinville-le-Pont

const PROXY_URL = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';
const STOP_MONITORING_URL = PROXY_URL + encodeURIComponent(
  'https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopPoint:Q:473951:'
);

const rerStopsContainer = document.getElementById('rer-a-stops');

async function fetchNextVehicleJourneyId() {
  try {
    const response = await fetch(STOP_MONITORING_URL);
    const data = await response.json();
    const journeys =
      data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit;

    if (!journeys || journeys.length === 0) throw new Error('Aucun passage RER trouvé');

    const first = journeys[0].MonitoredVehicleJourney;
    const journeyId = first?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
    return journeyId;
  } catch (err) {
    console.error('Erreur fetchNextVehicleJourneyId :', err);
    return null;
  }
}

async function fetchVehicleJourneyStops(journeyId) {
  const encodedJourneyId = encodeURIComponent(journeyId);
  const url = `${PROXY_URL}https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/vehicle_journeys/${encodedJourneyId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const stops = data?.vehicle_journeys?.[0]?.stop_times;
    return stops || [];
  } catch (err) {
    console.error('Erreur fetchVehicleJourneyStops :', err);
    return [];
  }
}

function displayScrollingStops(stops) {
  rerStopsContainer.innerHTML = '';
  const line = document.createElement('div');
  line.className = 'scrolling-line';
  line.innerHTML = stops
    .map(
      (s, i) =>
        `<span class="stop">${s.stop_point.name}</span>$
        {i < stops.length - 1 ? ' ➤ ' : ''}`
    )
    .join('');
  rerStopsContainer.appendChild(line);
}

async function loadRERAStops() {
  const journeyId = await fetchNextVehicleJourneyId();
  if (!journeyId) return;
  const stops = await fetchVehicleJourneyStops(journeyId);
  if (stops.length > 0) displayScrollingStops(stops);
}

// Lancer au chargement
loadRERAStops();

// Mettre à jour toutes les 2 minutes
setInterval(loadRERAStops, 2 * 60 * 1000);
