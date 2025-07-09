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
  
async function horaire(id, stopObj, title) {
  const scheduleEl = document.getElementById(`${id}-schedules`);
  const monitoringRef = stopObj?.monitoringRef;
  const lineRef = stopObj?.lineRef;
  if (!monitoringRef) {
    scheduleEl.innerHTML = "Donnée stop manquante";
    return;
  }

  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${monitoringRef}`);
    const data = await fetch(url).then(r => r.json());
    // ...
    const alert = await lineAlert(lineRef);
    if (alert) horairesHTML += `<div class="info">⚠️ ${alert}</div>`;
    // ...

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
    } catch {
      return "";
    }
  }
