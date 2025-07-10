// script.js — version complète avec récupération automatique des vehicle_journeys

import { CONFIG } from './config.js';

const proxy = CONFIG.proxy;
const stops = CONFIG.stops;

document.addEventListener("DOMContentLoaded", () => {
  loop();
  setInterval(loop, 60_000);
  startWeatherLoop();
  startNewsLoop();
});

function loop() {
  updateClock();
  fetchAll();
}

function updateClock() {
  document.getElementById("datetime").textContent = new Date().toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function fetchAll() {
  horaire("rer", stops.rer);
  horaire("bus77", stops.bus77);
  horaire("bus201", stops.bus201);
  meteo();
  news();
}

async function horaire(type, stop) {
  const target = document.getElementById(`${type}-schedules`);
  if (!target) return;
  target.innerHTML = "Chargement...";

  try {
    const url = `${proxy}https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=STIF:StopArea:SP:${stop.monitoringRef}:`;
    const res = await fetch(url);
    const data = await res.json();

    const monitored = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    if (!monitored.length) {
      target.innerHTML = "Aucun passage trouvé";
      return;
    }

    target.innerHTML = monitored.slice(0, 4).map(item => {
      const mvj = item.MonitoredVehicleJourney;
      const aimed = mvj.MonitoredCall?.AimedDepartureTime;
      const expected = mvj.MonitoredCall?.ExpectedDepartureTime || aimed;
      const dest = mvj.DestinationName;
      const now = new Date();
      const dep = new Date(expected);
      const minLeft = Math.round((dep - now) / 60000);
      const retard = new Date(expected) - new Date(aimed);

      return `
        <div class="horaire">
          <span class="heure">${dep.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
          <span class="destination">→ ${dest}</span>
          <span class="retard">${retard > 60000 ? `⚠️ +${Math.floor(retard / 60000)} min` : ''}</span>
          <span class="reste">${minLeft > 0 ? `${minLeft} min` : '🟢 imminent'}</span>
        </div>`;
    }).join("");
  } catch (e) {
    console.error("Erreur horaire", e);
    target.innerHTML = "Erreur de chargement";
  }
}

async function meteo() {
  const meteoDiv = document.getElementById("weather");
  if (!meteoDiv) return;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.weather.lat}&longitude=${CONFIG.weather.lon}&current_weather=true&timezone=Europe%2FParis`;
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current_weather.temperature;
    const wind = data.current_weather.windspeed;
    const code = data.current_weather.weathercode;

    meteoDiv.innerHTML = `${temp}°C, vent ${wind} km/h, code météo ${code}`;
  } catch (e) {
    console.error("Météo erreur:", e);
    meteoDiv.innerHTML = "Météo indisponible";
  }
}

async function news() {
  const newsDiv = document.getElementById("news-banner-content");
  if (!newsDiv) return;
  try {
    const res = await fetch(CONFIG.newsUrl);
    const data = await res.json();
    const items = data.items.slice(0, 5).map(item => `<li><a href="${item.link}" target="_blank">${item.title}</a></li>`);
    newsDiv.innerHTML = `<ul>${items.join('')}</ul>`;
  } catch (e) {
    console.error("News erreur:", e);
    newsDiv.innerHTML = "Actualités non disponibles";
  }
}

function startWeatherLoop() {
  meteo();
  setInterval(meteo, 600_000);
}

function startNewsLoop() {
  news();
  setInterval(news, 600_000);
}
