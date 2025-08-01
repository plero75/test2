const proxy = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';
const apiBase = 'https://prim.iledefrance-mobilites.fr/marketplace';

// 🔄 Date & Heure
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕒 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}
setInterval(updateDateTime, 10000);
updateDateTime();

// 🚍 Lignes à afficher
const stops = [
  {
    id: 'STIF:StopArea:SP:43135:',
    name: 'Joinville-le-Pont (RER + Bus)',
    lines: [
      'C01742', 'C02251', 'C01130', 'C01135', 'C01137', 'C01139', 'C01141', 'C01219', 'C01260', 'C01399'
    ],
    element: 'bus-joinville'
  },
  {
    id: 'STIF:StopArea:SP:463641:',
    name: 'Hippodrome de Vincennes (Bus 77)',
    lines: ['C02251'],
    element: 'bus-vincennes'
  },
  {
    id: 'STIF:StopArea:SP:463644:',
    name: 'École du Breuil (Bus 201)',
    lines: ['C01219'],
    element: 'bus-breuil'
  }
];

// ⏰ Transports
async function getDepartures(stopArea, lines, containerId) {
  try {
    const url = `${proxy}${apiBase}/stop-monitoring?MonitoringRef=${stopArea}`;
    const res = await fetch(url);
    const data = await res.json();
    const journeys = data.ServiceDelivery.StopMonitoringDelivery[0].MonitoredStopVisit;

    const grouped = {};
    journeys.forEach(j => {
      const line = j.MonitoredVehicleJourney.LineRef;
      const dir = j.MonitoredVehicleJourney.DestinationName;
      const aimed = j.MonitoredVehicleJourney.MonitoredCall.AimedArrivalTime;
      const expected = j.MonitoredVehicleJourney.MonitoredCall.ExpectedArrivalTime;
      const status = j.MonitoredVehicleJourney.MonitoredCall.ArrivalStatus;

      const delayMin = Math.round((new Date(expected) - new Date()) / 60000);
      const statusText = status === "delayed" ? `⚠️ Retardé (+${delayMin} min)` :
                        status === "cancelled" ? "❌ Supprimé" :
                        delayMin < 2 ? "🟢 Imminent" : "🟢 À l'heure";

      const key = `${line} > ${dir}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ aimed, expected, delayMin, statusText });
    });

    let html = `<h3>${stopArea.includes("43135") ? "🚉 RER A + Bus Joinville" : "🚌 " + stops.find(s => s.id === stopArea).name}</h3>`;
    Object.entries(grouped).forEach(([dir, depList]) => {
      html += `<div class="destination"><strong>${dir}</strong><ul>`;
      depList.slice(0, 4).forEach(dep => {
        html += `<li>🕐 ${dep.aimed.slice(11, 16)} – ⏳ ${dep.delayMin} min – ${dep.statusText}</li>`;
      });
      html += `</ul></div>`;
    });

    document.getElementById(containerId).innerHTML = html;
  } catch (e) {
    document.getElementById(containerId).innerHTML = "⚠️ Erreur de données";
  }
}

function refreshTransports() {
  stops.forEach(s =>
    getDepartures(s.id, s.lines, s.element)
  );
}
refreshTransports();
setInterval(refreshTransports, 60000);

// 🌤 Météo
async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m,weathercode&timezone=Europe%2FParis";
  const res = await fetch(url);
  const data = await res.json();
  const temp = data.current.temperature_2m;
  document.getElementById("weather").innerHTML = `🌤️ Température actuelle : ${temp} °C`;
}
fetchWeather();
setInterval(fetchWeather, 30 * 60 * 1000);

// 🚲 Vélib'
async function fetchVelib() {
  const urls = {
    "Hippodrome Paris-Vincennes": "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&q=12163",
    "Pyramide - École du Breuil": "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/exports/json?lang=fr&q=12128"
  };

  let html = "";
  for (const [name, url] of Object.entries(urls)) {
    const res = await fetch(url);
    const data = await res.json();
    const d = data[0];
    html += `<p>📍 <strong>${name}</strong><br>🚲 ${d.mechanical} méca | ⚡ ${d.ebike} élec<br>🅿️ ${d.numdocks} bornes</p>`;
  }
  document.getElementById("velib").innerHTML = html;
}
fetchVelib();
setInterval(fetchVelib, 60000);

// --- Actus défilantes (FranceTV via RSS2JSON) ---
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
  const desc = item.description
    ? item.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/ +/g, ' ').trim()
    : '';
  const shortDesc = desc.length > 220
    ? desc.slice(0, 217).replace(/ [^ ]*$/, '') + "…"
    : desc;

  document.getElementById(containerId).innerHTML = `
    <div class="news-item">
      📰 <b>${item.title}</b>
      <div class="news-desc">${shortDesc}</div>
    </div>`;

  currentNewsIndex = (currentNewsIndex + 1) % newsItems.length;
  setTimeout(() => showNewsItem(containerId), 9000);
}

// Lancement automatique au chargement
fetchNewsTicker('news-ticker');

// 🚨 Alertes trafic
async function fetchAlertes() {
  try {
    const url = `${proxy}${apiBase}/general-message`;
    const res = await fetch(url);
    const data = await res.json();
    const alerts = data.GeneralMessageDelivery[0].InfoMessage;
    const alertText = alerts.slice(0, 2).map(a => a.InfoMessage.Text[0].value).join(" ⚠️ ");
    document.getElementById("alertes").textContent = alertText || "✅ Aucun incident signalé";
  } catch {
    document.getElementById("alertes").textContent = "❓ Alerte indisponible";
  }
}
fetchAlertes();
setInterval(fetchAlertes, 180000);
