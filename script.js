// script.js — version revue pour un affichage type leon.gp / iena.cl avec focus clair sur horaires, directions, alertes et stops

import { CONFIG } from './config.js';

const proxy = CONFIG.proxy;
let newsItems = [];
let newsIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  clock();
  startWeatherLoop();
  startNewsLoop();
  fetchAll();
  setInterval(fetchAll, 60_000);
});

function clock() {
  const el = document.getElementById("datetime");
  if (el) {
    el.textContent = new Date().toLocaleString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}

function fetchAll() {
  const stops = CONFIG.stops;
  horaire("rer", stops.rer, "🚆 RER A");
  horaire("bus77", stops.bus77, "🚌 Bus 77");
  horaire("bus201", stops.bus201, "🚌 Bus 201");
  horaire("joinville", stops.joinville, "🚉 Joinville-le-Pont – RER A");
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
    if (!el) return;
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
  setInterval(meteo, 600_000);
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
  setInterval(afficherNews, 15000);
  setInterval(news, 600_000);
}

function afficherNews() {
  const el = document.getElementById("news-banner-content");
  if (!el) return;
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
  const el = document.getElementById(`${id}-schedules`);
  const ref = stop?.monitoringRef;
  const lineRef = stop?.lineRef;
  if (!ref) return (el.innerHTML = "Stop inconnu");

  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:${ref}:`);
    const data = await fetch(url).then(r => r.json());
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    if (!visits.length) return (el.innerHTML = "Pas de passage prévu");

    const byDest = {};
    for (let v of visits.slice(0, 8)) {
      const call = v.MonitoredVehicleJourney.MonitoredCall;
      const dest = Array.isArray(call.DestinationDisplay) ? call.DestinationDisplay[0]?.value : call.DestinationDisplay || "Indisponible";
      if (!byDest[dest]) byDest[dest] = [];
      byDest[dest].push(v);
    }

    let html = `<h2>${title}</h2>`;
    for (const [dest, group] of Object.entries(byDest)) {
      html += `<h3>→ ${dest}</h3>`;
      for (const item of group) {
        const call = item.MonitoredVehicleJourney.MonitoredCall;
        const aimed = new Date(call.AimedDepartureTime);
        const exp = new Date(call.ExpectedDepartureTime);
        const delay = Math.round((exp - aimed) / 60000);
        const expStr = exp.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
        const tag = delay > 1 ? `🔴 +${delay} min` : "🟢";
        html += `<div>${expStr} ${tag}</div>`;
      }
    }

    const alert = await lineAlert(lineRef);
    if (alert) html += `<div class="info">⚠️ ${alert}</div>`;
    el.innerHTML = html;
  } catch (e) {
    console.error("Erreur horaire:", e);
    el.innerHTML = "Erreur";
  }
}

async function lineAlert(lineRef) {
  if (!lineRef) return "";
  try {
    const idfmLine = lineRef.replace("STIF:Line::", "line:IDFM:");
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/line_reports/lines/${idfmLine}`);
    const res = await fetch(url);
    if (!res.ok) return "";
    const data = await res.json();
    return data?.line_reports?.[0]?.message?.text || "";
  } catch (e) {
    console.error("Erreur lineAlert:", e);
    return "";
  }
}
