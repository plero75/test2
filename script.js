// === CONFIGURATION ===
const CORS_PROXY = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";

// StopArea (IDFM)
const STOP_JOINVILLE = "STIF:StopArea:SP:43135:";   // RER + bus Joinville
const STOP_VHP_77    = "STIF:StopArea:SP:463641:";  // Hippodrome — 77
const STOP_BREUIL    = "STIF:StopArea:SP:463644:";  // École du Breuil — 201 (& 77 éventuel)

// LineRef (IDFM)
const LINE_RER_A = "STIF:Line::C01742:";
const LINE_77    = "STIF:Line::C02251:";
const LINE_201   = "STIF:Line::C01219:";

// Lignes de bus Joinville à afficher
const JOINVILLE_BUS_CODES = ["101","106","108","110","112","281","N33"];

// Couleurs badges
const lineColors = {
  "RER A": "#CE0033",
  "77":    "#F28E00",
  "201":   "#00824B",
  "101":   "#0055A4",
  "106":   "#A1006B",
  "108":   "#91278E",
  "110":   "#A05100",
  "112":   "#FF6600",
  "281":   "#ED7D31",
  "N33":   "#1E1E1E",
};

// Utils DOM
const $ = (id) => document.getElementById(id) || null;

// === HORLOGE ===
function updateDateTime() {
  const now = new Date();
  const formatted = now.toLocaleString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const dt = $('datetime');
  const dtf = $('datetime-footer');
  if (dt) dt.textContent = formatted;
  if (dtf) dtf.textContent = formatted;
}

// === MÉTÉO (entête) ===
async function fetchWeather() {
  const tgt = $('weather-summary'); if (!tgt) return;
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.423&current_weather=true&timezone=Europe%2FParis";
    const res = await fetch(url);
    const data = await res.json();
    const w = data?.current_weather;
    if (!w) throw 0;
    tgt.textContent = `${getWeatherIcon(w.weathercode)} ${Math.round(w.temperature)}°C • ${Math.round(w.windspeed)} km/h`;
  } catch { tgt.textContent = "Météo indisponible"; }
}
function getWeatherIcon(code) {
  if (code < 3) return "☀️";
  if (code < 45) return "⛅";
  if (code < 60) return "🌧️";
  if (code < 80) return "⛈️";
  return "ℹ️";
}

// === NEWS (titre + brève, rotation 15s) ===
async function fetchNewsTicker() {
  const el = $('newsTicker'); if (!el) return;
  try {
    const rssUrl = 'https://www.francetvinfo.fr/titres.rss';
    const res = await fetch(CORS_PROXY + encodeURIComponent(rssUrl));
    const xml = await res.text();
    const dom = new DOMParser().parseFromString(xml, 'text/xml');
    const items = [...dom.querySelectorAll('item')].slice(0, 12);
    if (!items.length) throw 0;
    const slides = items.map(it => {
      const t = it.querySelector('title')?.textContent?.trim() || '';
      const d = (it.querySelector('description')?.textContent || '')
        .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      const breve = d.length > 160 ? d.slice(0,157).replace(/ [^ ]*$/,'') + '…' : d;
      return `${t} — ${breve}`;
    });
    let i = 0;
    el.textContent = slides[0];
    setInterval(() => { i = (i + 1) % slides.length; el.textContent = slides[i]; }, 15000);
  } catch { el.textContent = ''; }
}

// === ALERTES TRAFIC PRIM (générales) ===
async function fetchTrafficAlerts(containerId = "alertes-trafic") {
  const el = $(containerId); if (!el) return;
  try {
    const url = "https://prim.iledefrance-mobilites.fr/marketplace/general-message";
    const res = await fetch(CORS_PROXY + encodeURIComponent(url));
    const data = await res.json();
    const msgs = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || [];
    if (!msgs.length) { el.textContent = ""; return; }
    el.innerHTML = msgs.map(m => {
      const txt = m?.Content?.Message?.[0]?.value || "Information trafic";
      return `<span style="margin-right:24px">⚠️ ${escapeHtml(txt)}</span>`;
    }).join("");
  } catch { el.textContent = ""; }
}

// === UTILS TEMPS & RENDU ===
function hhmm(d) { return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
function deltaText(expected, now) {
  const diff = Math.round((expected - now)/60000);
  if (diff < 0) return "⛔ passé";
  if (diff <= 1) return "🟢 imminent";
  if (diff <= 30) return `⏳ dans ${diff} min`;
  return ""; // > 30 min : on affiche l'heure seule
}
function normalizeLineCode(raw) {
  if (/RER\s*[A-Z]/i.test(raw)) return raw.replace(/^.*?(RER\s*[A-Z]).*$/i, "$1").toUpperCase();
  const mN = raw.match(/N\d{1,3}/i); if (mN) return mN[0].toUpperCase();
  const m  = raw.match(/(\d{1,3})/);  if (m)  return m[1];
  return raw || "—";
}
function badge(code) {
  const color = lineColors[code] || "#555";
  return `<span class="icon-line" style="background:${color}">${escapeHtml(code)}</span>`;
}
function badgeTime(text, style="") {
  const cls = style ? `time-badge ${style}` : "time-badge";
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}
function renderRow(lineCode, dest, expected, now, status) {
  const d = deltaText(expected, now);
  const hour = hhmm(expected);
  const right = d ? `${badgeTime(hour)} ${badgeTime(d,'dim')}` : badgeTime(hour);
  let info = "";
  if (/cancel/i.test(status)) info = `<span class="info-small">— supprimé</span>`;
  else if (/no.?service/i.test(status)) info = `<span class="info-small">— service terminé</span>`;
  return `
    <div class="line-row">
      <div class="left">
        ${badge(lineCode)} <span class="dest">${escapeHtml(dest)}</span> ${info}
      </div>
      <div class="right">${right}</div>
    </div>`;
}
function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// === STOP-MONITORING ===
async function fetchStopMonitoring(monitoringRef) {
  const url = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${encodeURIComponent(monitoringRef)}`;
  const res = await fetch(CORS_PROXY + encodeURIComponent(url));
  if (!res.ok) throw new Error("stop-monitoring " + res.status);
  return res.json();
}

// === BLOCS ===

// RER A — Joinville
async function refreshRerA() {
  const container = $('rer-a-passages'); if (!container) return;
  container.innerHTML = "Chargement…";
  try {
    const data = await fetchStopMonitoring(STOP_JOINVILLE);
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const now = new Date();

    const onlyRerA = visits.filter(v => (v?.MonitoredVehicleJourney?.LineRef?.value || "").includes(LINE_RER_A));
    if (!onlyRerA.length) {
      container.innerHTML = `<div class="service-ended">🚫 Aucun passage RER A</div>`;
      const up = $('rer-a-update'); if (up) up.textContent = "MàJ : " + hhmm(now);
      return;
    }

    const groups = {};
    onlyRerA.forEach(v => {
      const mvj = v.MonitoredVehicleJourney;
      const dest = mvj.DestinationName?.[0]?.value || "Destination inconnue";
      (groups[dest] ||= []).push(v);
    });

    let html = "";
    for (const [dest, group] of Object.entries(groups)) {
      group.sort((a,b) =>
        new Date(a.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) -
        new Date(b.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime)
      );
      html += `<div class="sens-block"><div class="sens-title">Vers <b>${escapeHtml(dest)}</b></div>`;
      group.slice(0,4).forEach(v => {
        const mvj = v.MonitoredVehicleJourney;
        const call = mvj.MonitoredCall || {};
        const expected = new Date(call.ExpectedDepartureTime || call.AimedDepartureTime || Date.now());
        const status = call.DepartureStatus || call.ArrivalStatus || "";
        html += renderRow("RER A", dest, expected, now, status);
      });
      html += `</div>`;
    }

    container.innerHTML = html || `<div class="service-ended">🚫 Aucun passage RER A</div>`;
    const up = $('rer-a-update'); if (up) up.textContent = "MàJ : " + hhmm(now);
  } catch {
    container.innerHTML = `<div class="service-ended">❌ Erreur chargement</div>`;
  }
}

// 77 — Hippodrome
async function refreshBus77() {
  const container = $('bus-77-passages'); if (!container) return;
  container.innerHTML = "Chargement…";
  try {
    const data = await fetchStopMonitoring(STOP_VHP_77);
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const now = new Date();

    const out = visits
      .filter(v => (v?.MonitoredVehicleJourney?.LineRef?.value || "").includes(LINE_77))
      .sort((a,b)=> new Date(a.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) - new Date(b.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime))
      .slice(0, 10)
      .map(v => {
        const mvj = v.MonitoredVehicleJourney;
        const call = mvj.MonitoredCall || {};
        const expected = new Date(call.ExpectedDepartureTime || call.AimedDepartureTime || Date.now());
        const dest = mvj.DestinationName?.[0]?.value || "Destination inconnue";
        const status = call.DepartureStatus || call.ArrivalStatus || "";
        return renderRow("77", dest, expected, now, status);
      }).join("");

    container.innerHTML = out || `<div class="service-ended">🚫 Aucun passage 77</div>`;
    const up = $('bus-77-update'); if (up) up.textContent = "MàJ : " + hhmm(now);
  } catch {
    container.innerHTML = `<div class="service-ended">❌ Erreur chargement</div>`;
  }
}

// 201 — École du Breuil
async function refreshBus201() {
  const container = $('bus-201-passages'); if (!container) return;
  container.innerHTML = "Chargement…";
  try {
    const data = await fetchStopMonitoring(STOP_BREUIL);
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const now = new Date();

    const out = visits
      .filter(v => (v?.MonitoredVehicleJourney?.LineRef?.value || "").includes(LINE_201))
      .sort((a,b)=> new Date(a.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime) - new Date(b.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime))
      .slice(0, 10)
      .map(v => {
        const mvj = v.MonitoredVehicleJourney;
        const call = mvj.MonitoredCall || {};
        const expected = new Date(call.ExpectedDepartureTime || call.AimedDepartureTime || Date.now());
        const dest = mvj.DestinationName?.[0]?.value || "Destination inconnue";
        const status = call.DepartureStatus || call.ArrivalStatus || "";
        return renderRow("201", dest, expected, now, status);
      }).join("");

    container.innerHTML = out || `<div class="service-ended">🚫 Aucun passage 201</div>`;
    const up = $('bus-201-update'); if (up) up.textContent = "MàJ : " + hhmm(now);
  } catch {
    container.innerHTML = `<div class="service-ended">❌ Erreur chargement</div>`;
  }
}

// Joinville — Bus groupés (101/106/108/110/112/281/N33)
async function refreshJoinvilleBus() {
  const container = $('joinville-bus-passages'); if (!container) return;
  container.innerHTML = "Chargement…";
  try {
    const data = await fetchStopMonitoring(STOP_JOINVILLE);
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];
    const now = new Date();

    const map = new Map();
    for (const v of visits) {
      const mvj  = v?.MonitoredVehicleJourney || {};
      const lref = mvj?.LineRef?.value || "";
      const code = normalizeLineCode(lref);
      if (!JOINVILLE_BUS_CODES.includes(code)) continue;
      const dest = (mvj?.DestinationName?.[0]?.value || "Destination inconnue").trim();
      const call = mvj?.MonitoredCall || {};
      const expected = new Date(call.ExpectedDepartureTime || call.AimedDepartureTime || 0);
      if (isNaN(expected)) continue;
      const status = call.DepartureStatus || call.ArrivalStatus || "";

      const key = `${code}__${dest}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ code, dest, expected, status });
    }

    if (map.size === 0) {
      container.innerHTML = `<div class="service-ended">🚫 Aucun passage bus de Joinville</div>`;
      const up = $('joinville-bus-update'); if (up) up.textContent = "MàJ : " + hhmm(now);
      return;
    }

    let html = "";
    for (const [key, list] of map) {
      list.sort((a,b)=> a.expected - b.expected);
      const { code, dest } = list[0];
      html += `<div class="sens-block"><div class="sens-title">${badge(code)}&nbsp;Vers <b>${escapeHtml(dest)}</b></div>`;
      list.slice(0,4).forEach(item => {
        html += renderRow(item.code, item.dest, item.expected, now, item.status);
      });
      html += `</div>`;
    }

    container.innerHTML = html;
    const up = $('joinville-bus-update'); if (up) up.textContent = "MàJ : " + hhmm(now);
  } catch {
    container.innerHTML = `<div class="service-ended">❌ Erreur chargement</div>`;
  }
}

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  setInterval(updateDateTime, 60_000);

  fetchWeather();
  fetchNewsTicker();

  fetchTrafficAlerts();
  setInterval(fetchTrafficAlerts, 120_000);

  refreshRerA();
  refreshJoinvilleBus();
  refreshBus77();
  refreshBus201();

  setInterval(refreshRerA,         60_000);
  setInterval(refreshJoinvilleBus, 60_000);
  setInterval(refreshBus77,        60_000);
  setInterval(refreshBus201,       60_000);

  // Vélib (facultatif) — remets si besoin les deux appels :
  fetchVelib("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12163)", "velib-vincennes");
  fetchVelib("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12128)", "velib-breuil");
});

// Vélib simple
async function fetchVelib(url, containerId) {
  const el = $(containerId); if (!el) return;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const s = data[0];
    el.innerHTML = `
      <div class="line-row">
        <div class="left"><span class="dest">📍 ${escapeHtml(s.name)}</span></div>
        <div class="right">
          <span class="time-badge">🚲 ${s.numbikesavailable}</span>
          <span class="time-badge dim">🔌 ${s.ebike}</span>
          <span class="time-badge dim">🅿️ ${s.numdocksavailable}</span>
        </div>
      </div>`;
    const vu = $('velib-update'); if (vu) vu.textContent = 'MàJ Vélib : ' + hhmm(new Date());
  } catch {
    el.textContent = "❌ Erreur Vélib’";
  }
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

