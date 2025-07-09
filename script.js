import { CONFIG } from './config.js';

const proxy = CONFIG.proxy;
const lineMap = {
  "STIF:StopArea:SP:43135:": "STIF:Line::C01742:",
  "STIF:StopArea:SP:463641:": "STIF:Line::C01789:",
  "STIF:StopArea:SP:463644:": "STIF:Line::C01805:",
};

let newsItems = [];
let newsIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  loop();
  setInterval(loop, 60_000);
  startWeatherLoop();
  startNewsLoop();
  afficherProchaineCourseVincennes();
  afficherToutesCoursesVincennes();
});

function loop() {
  clock();
  fetchAll();
}

function clock() {
  document.getElementById("datetime").textContent =
    new Date().toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fetchAll() {
  horaire("rer", CONFIG.stops.rer, "🚆 RER A");
  horaire("bus77", CONFIG.stops.bus77, "🚌 Bus 77");
  horaire("bus201", CONFIG.stops.bus201, "🚌 Bus 201");
  meteo();
  news();
}

function startWeatherLoop() {
  meteo();
  setInterval(meteo, 15 * 60 * 1000); // toutes les 15 min
}

async function meteo() {
  const meteoEl = document.getElementById("meteo");
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.821&longitude=2.452&current_weather=true";
    const res = await fetch(url);
    const data = await res.json();
    const weather = data.current_weather;

    if (!weather) {
      meteoEl.textContent = "🌤 Météo indisponible";
      return;
    }

    const temp = Math.round(weather.temperature);
    const wind = Math.round(weather.windspeed);
    const code = weather.weathercode;
    const icon = getWeatherIcon(code);

    meteoEl.innerHTML = `${icon} ${temp}°C, vent ${wind} km/h`;
  } catch (e) {
    meteoEl.textContent = "🌤 Météo indisponible";
    console.error("Erreur météo :", e);
  }
}

function getWeatherIcon(code) {
  if ([0].includes(code)) return "☀️";
  if ([1, 2, 3].includes(code)) return "⛅️";
  if ([45, 48].includes(code)) return "🌫";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧";
  if ([71, 73, 75, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈";
  return "🌡";
}

function startNewsLoop() {
  news();
  setInterval(news, 10 * 60 * 1000);
}

async function news() {
  try {
    const res = await fetch(CONFIG.newsUrl);
    if (!res.ok) return;
    const data = await res.json();
    newsItems = data.items || [];
    newsIndex = 0;
    afficherNews();
    setInterval(afficherNews, 15000);
  } catch (e) {
    console.error("Erreur actus :", e);
  }
}

function afficherNews() {
  const el = document.getElementById("news-banner-content");
  if (!newsItems.length) {
    el.textContent = "Aucune actu disponible";
    return;
  }
  const article = newsItems[newsIndex];
  el.innerHTML = `<b>${article.title}</b> – ${article.description}`;
  newsIndex = (newsIndex + 1) % newsItems.length;
}

async function horaire(id, stop, title) {
  const scheduleEl = document.getElementById(`${id}-schedules`);
  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stop}`);
    const data = await fetch(url).then(r => r.json());
    const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0]?.MonitoredStopVisit || [];

    let horairesHTML = "";
    if (!visits.length) {
      scheduleEl.innerHTML = "Aucun passage prévu pour l’instant";
      return;
    }

    const passagesByDest = {};
    for (let v of visits.slice(0, 8)) {
      const call = v.MonitoredVehicleJourney.MonitoredCall;
      const dest = Array.isArray(call.DestinationDisplay) ? call.DestinationDisplay[0]?.value : call.DestinationDisplay || "Indisponible";
      if (!passagesByDest[dest]) passagesByDest[dest] = [];
      passagesByDest[dest].push(v);
    }

    for (const [dest, passages] of Object.entries(passagesByDest)) {
      const first = passages[0];
      const callFirst = first.MonitoredVehicleJourney.MonitoredCall;
      const expFirst = new Date(callFirst.ExpectedDepartureTime);
      const now = new Date();
      const timeToExpMin = Math.max(0, Math.round((expFirst - now) / 60000));
      const timeStr = expFirst.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });

      horairesHTML += `<h3>Vers ${dest} – prochain départ dans : ${timeToExpMin} min (à ${timeStr})</h3>`;

      const journey = first.MonitoredVehicleJourney?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
      if (id === "rer" && journey) {
        const scrollerId = `${id}-${journey}`;
        horairesHTML += `<div id="gares-${scrollerId}" class="stops-scroll" style="margin-bottom:8px;">🚉 …</div>`;
        loadStops(journey, scrollerId);
      }

      for (const v of passages) {
        const call = v.MonitoredVehicleJourney.MonitoredCall;
        const aimed = new Date(call.AimedDepartureTime);
        const exp = new Date(call.ExpectedDepartureTime);
        const diff = Math.round((exp - aimed) / 60000);
        const late = diff > 1;
        const cancel = (call.ArrivalStatus || "").toLowerCase() === "cancelled";
        const aimedStr = aimed.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
        const expStr = exp.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
        const timeToExpMin = Math.max(0, Math.round((exp - new Date()) / 60000));

        let crowd = "";
        const occ = v.MonitoredVehicleJourney?.OccupancyStatus || v.MonitoredVehicleJourney?.Occupancy || "";
        if (/full|crowd|high/i.test(occ)) crowd = "🔴";
        else if (/standing|medium|average/i.test(occ)) crowd = "🟡";
        else if (/seats|low|few|empty|available/i.test(occ)) crowd = "🟢";

        let tag = "";
        const status = call.StopPointStatus || call.ArrivalProximityText || "";
        if (timeToExpMin < 2) tag = "🟢 Imminent";
        if (/arrivée|en gare|at stop|stopped/i.test(status) && id === "rer") tag = "🚉 En gare";
        if (/at stop|stopped/i.test(status) && id.startsWith("bus")) tag = "🚌 À l'arrêt";

        if (cancel) {
          horairesHTML += `❌ <s>${aimedStr} → ${dest}</s> train supprimé<br>`;
        } else if (late) {
          horairesHTML += `🕒 <s>${aimedStr}</s> → ${expStr} (+${diff} min) → ${dest} ${crowd} <b>${tag}</b> (dans ${timeToExpMin} min)<br>`;
        } else {
          horairesHTML += `🕒 ${expStr} → ${dest} ${crowd} <b>${tag}</b> (dans ${timeToExpMin} min)<br>`;
        }
      }

      const alert = await lineAlert(stop);
      if (alert) horairesHTML += `<div class="info">⚠️ ${alert}</div>`;
    }

    scheduleEl.innerHTML = horairesHTML;
  } catch (e) {
    scheduleEl.innerHTML = "Erreur horaire";
    console.error(e);
  }
}

async function loadStops(journey, targetId) {
  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/vehicle_journeys/${journey}`);
    const data = await fetch(url).then(r => r.ok ? r.json() : null);
    const list = data?.vehicle_journeys?.[0]?.stop_times?.map(s => s.stop_point.name);
    const div = document.getElementById(`gares-${targetId}`);
    if (div) div.innerHTML = list && list.length > 0 ? createHorizontalScroller(list) : "";
  } catch (e) {
    console.error("Erreur chargement stops :", e);
  }
}

async function lineAlert(stop) {
  const line = lineMap[stop];
  if (!line) return "";
  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=${line}`);
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = await res.json();
    const messages = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    const msg = messages[0]?.Content?.MessageText || messages[0]?.Message || "";
    return msg ? `⚠️ ${msg}` : "";
  } catch {
    return "";
  }
}

function createHorizontalScroller(stops) {
  return `<div class="stops-scroll">🚏 ${stops.map(s => `<span>${s}</span>`).join(' ➔ ')}</div>`;
}
