  // script.js — version corrigée avec météo, actus, horaires RER/Bus et alertes
  
  import { CONFIG } from './config.js';
  
  const proxy = CONFIG.proxy;
  
  let newsItems = [];
  let newsIndex = 0;
  
  // Boucles initiales
  document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("DOMContentLoaded", () => {
  loop();
  setInterval(loop, 60_000);
  startWeatherLoop();
  startNewsLoop();
  // afficherProchaineCourseVincennes(); ← À commenter ou définir
  // afficherToutesCoursesVincennes(); ← À commenter ou définir
});

  });
  
  function loop() {
    clock();
    fetchAll();
  }
  
  function clock() {
    document.getElementById("datetime").textContent =
      new Date().toLocaleString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
  }
  
  function fetchAll() {
    horaire("rer", CONFIG.stops.rer, "🚆 RER A");
    horaire("bus77", CONFIG.stops.bus77, "🚌 Bus 77");
    horaire("bus201", CONFIG.stops.bus201, "🚌 Bus 201");
    meteo();
    news();
  }
  
  async function meteo() {
    try {
      const lat = CONFIG.weather.lat;
      const lon = CONFIG.weather.lon;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const data = await fetch(url).then(r => r.json());
      const el = document.getElementById("weather");
      if (data?.current_weather) {
        const w = data.current_weather;
        el.innerHTML = `🌤 ${w.temperature}°C – Vent ${w.windspeed} km/h`;
      } else {
        el.textContent = "Météo indisponible";
      }
    } catch (e) {
      console.error("Météo erreur:", e);
    }
  }
  
  function startWeatherLoop() {
    meteo();
    setInterval(meteo, 10 * 60 * 1000);
  }
  
  async function news() {
    try {
      const res = await fetch(CONFIG.newsUrl);
      if (!res.ok) return;
      const data = await res.json();
      newsItems = data.items || [];
      newsIndex = 0;
      afficherNews();
    } catch (e) {
      console.error("Erreur actus:", e);
    }
  }
  
  function startNewsLoop() {
    news();
    setInterval(afficherNews, 15000);
    setInterval(news, 10 * 60 * 1000);
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
  
  function createHorizontalScroller(stops) {
    return `<div class="stops-scroll">🚏 ${stops.map(s => `<span>${s}</span>`).join('➔')}</div>`;
  }
  
async function horaire(id, stop, title) {
  const scheduleEl = document.getElementById(`${id}-schedules`);
  const monitoringRef = stop?.monitoringRef;
  const lineRef = stop?.lineRef;

  if (!monitoringRef) {
    scheduleEl.innerHTML = "Donnée stop manquante";
    return;
  }

  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`);
    const data = await fetch(url).then(r => r.json());
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

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

    let horairesHTML = "";
    for (const [dest, passages] of Object.entries(passagesByDest)) {
      const first = passages[0];
      const callFirst = first.MonitoredVehicleJourney.MonitoredCall;
      const expFirst = new Date(callFirst.ExpectedDepartureTime);
      const now = new Date();
      const timeToExpMin = Math.max(0, Math.round((expFirst - now) / 60000));
      const timeStr = expFirst.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
      horairesHTML += `<h3>Vers ${dest} – dans ${timeToExpMin} min (à ${timeStr})</h3>`;

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
          horairesHTML += `❌ <s>${aimedStr} → ${dest}</s> supprimé<br>`;
        } else if (late) {
          horairesHTML += `🕒 <s>${aimedStr}</s> → ${expStr} (+${diff} min) ${crowd} <b>${tag}</b><br>`;
        } else {
          horairesHTML += `🕒 ${expStr} → ${dest} ${crowd} <b>${tag}</b><br>`;
        }
      }

      const alert = await lineAlert(lineRef);
      if (alert) horairesHTML += `<div class="info">⚠️ ${alert}</div>`;
    }

    scheduleEl.innerHTML = horairesHTML;
  } catch (e) {
    console.error("Erreur dans horaire():", e);
    scheduleEl.innerHTML = "Erreur horaire";
  }
}

async function lineAlert(lineRef) {
  if (!lineRef) return "";
  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/general-message?LineRef=${lineRef}`);
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = await res.json();
    const messages = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    const msg = messages[0]?.Content?.MessageText || messages[0]?.Message || "";
    return msg ? `⚠️ ${msg}` : "";
  } catch (e) {
    console.error("Erreur lineAlert:", e);
    return "";
  }
}




async function loadStops(journey, targetId) {
  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/vehicle_journeys/${journey}`);
    const data = await fetch(url).then(r => r.ok ? r.json() : null);
    const list = data?.vehicle_journeys?.[0]?.stop_times?.map(s => s.stop_point.name);
    const div = document.getElementById(`gares-${targetId}`);
    if (div && list?.length) div.innerHTML = createHorizontalScroller(list);
  } catch (e) {
    console.error("Erreur chargement stops:", e);
  }
}
