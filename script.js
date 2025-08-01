// Exemple simplifié – les appels dynamiques réels seront intégrés selon les API PRIM, Open-Meteo, Vélib etc.
document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchNews();
  fetchVelib();
  // fetchRER(); // simulation
  // fetchBusJoinville();
});

function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString("fr-FR")} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m&timezone=Europe%2FParis";
  const res = await fetch(url);
  const data = await res.json();
  document.getElementById("weather").textContent = `🌡️ ${data.current.temperature_2m} °C`;
}

async function fetchNews() {
  try {
    const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent("https://www.francetvinfo.fr/titres.rss"));
    const data = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(data.contents, "text/xml");
    const items = xml.querySelectorAll("item");
    let news = [];
    for (let i = 0; i < Math.min(5, items.length); i++) {
      news.push(items[i].querySelector("title").textContent);
    }
    document.getElementById("news-ticker").textContent = news.join(" ⚡ ");
  } catch (e) {
    document.getElementById("news-ticker").textContent = "❌ Actu indisponible.";
  }
}

async function fetchVelib() {
  const urls = [
    { id: "12163", el: "velib-vincennes", name: "Hippodrome Paris-Vincennes" },
    { id: "12128", el: "velib-breuil", name: "Pyramide - Ecole du Breuil" }
  ];

  for (let s of urls) {
    try {
      const url = `https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json`;
      const res = await fetch(url);
      const data = await res.json();
      const station = data.data.stations.find(st => st.stationCode === s.id);
      if (!station) throw new Error("Station non trouvée");
      document.getElementById(s.el).innerHTML = `📍 ${s.name}<br>
        🚲 ${station.num_bikes_available_types?.[0]?.mechanical || 0} mécaniques | 🔌 ${station.num_bikes_available_types?.[1]?.ebike || 0} électriques<br>
        🅿️ ${station.num_docks_available} bornes`;
    } catch (e) {
      document.getElementById(s.el).textContent = `❌ Erreur sur station ${s.name}`;
    }
  }

  document.getElementById('velib-update').textContent =
    "Mise à jour : " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}