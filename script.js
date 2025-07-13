import { CONFIG } from './config.js';

const proxy = CONFIG.proxy;
const lineMap = {
  "STIF:StopArea:SP:43135:": "STIF:Line::C01742:",
  "STIF:StopArea:SP:463641:": "STIF:Line::C01789:",
  "STIF:StopArea:SP:463644:": "STIF:Line::C01805:",
};

document.addEventListener("DOMContentLoaded", () => {
  loop();
  setInterval(loop, 60_000);
  startWeatherLoop();
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

function createHorizontalScroller(stops) {
  return `<div class="stops-scroll">🚏 ${stops.map(s => `<span>${s}</span>`).join('➔')}</div>`;
}

async function horaire(id, stop, title) {
  const scheduleEl = document.getElementById(`${id}-schedules`);
  const alertEl = document.getElementById(`${id}-alert`);
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
      const timeStr = expFirst.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      horairesHTML += `<h3>Vers ${dest} – prochain départ dans : ${timeToExpMin} min (à ${timeStr})</h3>`;

      passages.forEach(v => {
        const call = v.MonitoredVehicleJourney.MonitoredCall;
        const aimed = new Date(call.AimedDepartureTime);
        const exp = new Date(call.ExpectedDepartureTime);
        const diff = Math.round((exp - aimed) / 60000);
        const late = diff > 1;
        const cancel = (call.ArrivalStatus || "").toLowerCase() === "cancelled";
        const aimedStr = aimed.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const expStr = exp.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
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

        let line = "";
        if (cancel) {
          line = `❌ <s>${aimedStr} → ${dest}</s> train supprimé`;
        } else if (late) {
          line = `🕒 <s>${aimedStr}</s> → ${expStr} (+${diff} min) → ${dest} ${crowd} <b>${tag}</b> (dans ${timeToExpMin} min)`;
        } else {
          line = `🕒 ${expStr} → ${dest} ${crowd} <b>${tag}</b> (dans ${timeToExpMin} min)`;
        }

        const journeyId = v.MonitoredVehicleJourney?.FramedVehicleJourneyRef?.DatedVehicleJourneyRef;
        if (id === "rer" && journeyId) {
          const scrollerId = `${id}-${journeyId}`;
          line += `<div id="gares-${scrollerId}" class="stops-scroll">🚉 …</div>`;
          loadStops(journeyId, scrollerId);
        }
        horairesHTML += `<div class="departure">${line}</div>`;
      });

      const alert = await lineAlert(stop);
      if (alert) horairesHTML += `<div class="info">⚠️ ${alert}</div>`;
    }
    scheduleEl.innerHTML = horairesHTML;
  } catch {
    scheduleEl.innerHTML = "Erreur horaire";
  }
}

async function loadStops(journey, targetId) {
  try {
    const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/vehicle-journey/${journey}`);
    const data = await fetch(url).then(r => r.ok ? r.json() : null);
    const list = data?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery?.[0]?.VehicleActivity?.[0]?.MonitoredVehicleJourney?.OnwardCalls?.OnwardCall?.map(c => c.StopPointName);
    const div = document.getElementById(`gares-${targetId}`);
    if (div) div.innerHTML = list && list.length > 0 ? createHorizontalScroller(list) : "";
  } catch { /* ignore */ }
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
  } catch { return ""; }
}

// -------- Actus, météo, courses --------
async function news() {
  const elNews = document.getElementById("news-content");
  try {
    const r = await fetch(
      "https://api.rss2json.com/v1/api.json?rss_url=https://www.francetvinfo.fr/titres.rss"
    );
    elNews.textContent = (await r.json()).items
      .slice(0, 3)
      .map((i) => i.title)
      .join(" • ");
  } catch {
    elNews.textContent = "Actus indisponibles";
  }
}

async function afficherProchaineCourseVincennes() {
  const el = document.getElementById("nextRace");
  try {
    const data = await fetch("static/races.json").then((r) => r.json());
    const now = new Date();
    const prochaines = data
      .map((r) => ({
        ...r,
        dateTime: r.heure
          ? new Date(`${r.date}T${r.heure.length === 5 ? r.heure + ':00' : r.heure}`)
          : new Date(r.date),
      }))
      .filter((r) => r.dateTime >= now)
      .sort((a, b) => a.dateTime - b.dateTime);

    const prochaine = prochaines[0];
    if (!prochaine) {
      el.innerHTML = "Aucune réunion Vincennes à venir.";
      return;
    }

    const options = {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    };
    const dateStr = prochaine.dateTime.toLocaleString("fr-FR", options);
    el.innerHTML = `🏇 Prochaine réunion : <b>${prochaine.lieu}</b> (${prochaine.type})<br>📅 ${dateStr}`;
  } catch (e) {
    console.error(e);
    el.innerHTML = "Erreur lors de la détection de la prochaine réunion Equidia.";
  }
}

async function afficherToutesCoursesVincennes() {
  const el = document.getElementById("courses-content");
  try {
    const data = await fetch("static/races.json").then((r) => r.json());
    const now = new Date();
    const prochaines = data
      .map((r) => ({
        ...r,
        dateTime: r.heure
          ? new Date(`${r.date}T${r.heure.length === 5 ? r.heure + ':00' : r.heure}`)
          : new Date(r.date),
      }))
      .filter((r) => r.dateTime >= now)
      .sort((a, b) => a.dateTime - b.dateTime);

    if (!prochaines.length) {
      el.innerHTML = "<i>Aucune course Vincennes à venir.</i>";
      return;
    }

    el.innerHTML = prochaines
      .map(
        (c) =>
          `<div class="course">
        <b>${c.date}${c.heure ? ' ' + c.heure : ''}</b> – ${c.lieu} (${c.type})
      </div>`
      )
      .join("");
  } catch (err) {
    console.error("Erreur Equidia:", err);
    el.innerHTML = "<b>Erreur de chargement des courses.</b>";
  }
}

async function meteo() {
  const el = document.getElementById("meteo");
  try {
    const r = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=48.8402&longitude=2.4274&current_weather=true"
    );
    const c = (await r.json()).current_weather;
    el.innerHTML = `<h2>🌤 Météo locale</h2>${c.temperature} °C | Vent ${c.windspeed} km/h`;
  } catch {
    el.textContent = "Erreur météo";
  }
}

function startWeatherLoop() {
  meteo();
  setInterval(meteo, 30 * 60 * 1000);
}

