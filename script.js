document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  startWeatherLoop();
  fetchVelibDirect('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12163)&timezone=Europe%2FParis', 'velib-vincennes');
  fetchVelibDirect('https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&qv1=(12128)&timezone=Europe%2FParis', 'velib-breuil');
  fetchNewsTicker('news-ticker');

  const stops = [
    { name: "Joinville-le-Pont", id: "STIF:StopArea:SP:43135:" },
    { name: "Hippodrome de Vincennes", id: "STIF:StopArea:SP:463641:" },
    { name: "École du Breuil", id: "STIF:StopArea:SP:463644:" },
  ];

  stops.forEach(stop => {
    getDepartures(stop.name, stop.id);
  });

  setInterval(() => {
    updateDateTime();
    stops.forEach(stop => getDepartures(stop.name, stop.id));
  }, 60000);
});

// Heure et date
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// --- Météo
async function meteo() {
  try {
    const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m,weathercode&timezone=Europe%2FParis");
    const data = await res.json();
    const temp = data.current.temperature_2m;
    document.getElementById("weather").textContent = `🌤️ Température actuelle : ${temp} °C`;
  } catch (e) {
    document.getElementById("weather").textContent = "❌ Erreur météo";
  }
}

function startWeatherLoop() {
  meteo();
  setInterval(meteo, 30 * 60 * 1000);
}

// --- Vélib (2 stations)
async function fetchVelibDirect(url, containerId) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const stations = await response.json();
    const s = stations[0];
    document.getElementById(containerId).innerHTML = `
      <div class="velib-block">
        📍 ${s.name}<br>
        🚲 ${s.numbikesavailable} méca&nbsp;|&nbsp;🔌 ${s.ebike} élec<br>
        🅿️ ${s.numdocksavailable} bornes
      </div>
    `;
    document.getElementById('velib-update').textContent = '🕐 Vélib : ' + (new Date()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (err) {
    document.getElementById(containerId).innerHTML = '❌ Erreur Vélib’';
  }
}

// --- Actus défilantes
let newsItems = [];
let currentNewsIndex = 0;

async function fetchNewsTicker(containerId) {
  const url = 'https://api.rss2json.com/v1/api.json?rss_url=https://www.francetvinfo.fr/titres.rss';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    newsItems = data.items || [];
    if (newsItems.length === 0) {
      document.getElementById(containerId).innerHTML = '✅ Aucun article';
      return;
    }
    currentNewsIndex = 0;
    showNewsItem(containerId);
  } catch (err) {
    document.getElementById(containerId).textContent = '❌ Erreur actus';
  }
}

function showNewsItem(containerId) {
  if (newsItems.length === 0) return;
  const item = newsItems[currentNewsIndex];
  const desc = item.description ? item.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/ +/g, ' ').trim() : '';
  const shortDesc = desc.length > 220 ? desc.slice(0,217).replace(/ [^ ]*$/, '') + "…" : desc;
  document.getElementById(containerId).innerHTML = `<div class="news-item">
    📰 <b>${item.title}</b>
    <div class="news-desc">${shortDesc}</div>
  </div>`;
  currentNewsIndex = (currentNewsIndex + 1) % newsItems.length;
  setTimeout(() => showNewsItem(containerId), 9000);
}

// --- Transports temps réel (PRIM)
async function getDepartures(nom, monitoringRef) {
  const url = `https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${encodeURIComponent(monitoringRef)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const journeys = data?.ServiceDelivery?.StopMonitoringDelivery[0]?.MonitoredStopVisit || [];

    const grouped = {};
    for (let j of journeys) {
      const d = j.MonitoredVehicleJourney;
      const dest = d.DestinationName[0];
      if (!grouped[dest]) grouped[dest] = [];
      grouped[dest].push({
        expected: d.MonitoredCall.ExpectedArrivalTime,
        aimed: d.MonitoredCall.AimedArrivalTime,
        status: j?.MonitoredVehicleJourney?.Delay ? `retardé` : 'À l\'heure'
      });
    }

    const content = Object.entries(grouped).map(([dest, list]) => {
      const lines = list.slice(0, 4).map(dep => {
        const aimed = new Date(dep.aimed);
        const expected = new Date(dep.expected);
        const now = new Date();
        const diffMin = Math.round((expected - now) / 60000);
        const retard = Math.round((expected - aimed) / 60000);
        return `
          <div class="horaire">
            ⏰ ${aimed.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            ⏳ ${diffMin} min
            ${retard > 1 ? `⚠️ +${retard} min` : '🟢 À l\'heure'}
          </div>`;
      }).join('');
      return `<div class="destination"><b>${nom}</b> → <b>${dest}</b><br>${lines}</div>`;
    }).join('');

    document.getElementById(`bloc-${nom}`).innerHTML = content;

  } catch (err) {
    console.error(`Erreur récupération pour ${nom}`, err);
    document.getElementById(`bloc-${nom}`).innerHTML = '❌ Erreur';
  }
}
