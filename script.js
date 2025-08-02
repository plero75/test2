document.addEventListener("DOMContentLoaded", () => {
  updateDateTime();
  fetchWeather();
  fetchVelib();
  fetchNews();
  fetchAlerts();
  fetchRaces();
  fetchTransports();

  setInterval(updateDateTime, 10000); // Mise à jour de l'heure toutes les 10s
});

// ⏱ Heure et date
function updateDateTime() {
  const now = new Date();
  document.getElementById("datetime").textContent =
    `🕐 ${now.toLocaleTimeString()} – 📅 ${now.toLocaleDateString("fr-FR")}`;
}

// 🌦 Météo via Open-Meteo
async function fetchWeather() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.84&longitude=2.45&current=temperature_2m,weathercode&timezone=Europe%2FParis";
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current.temperature_2m;
    const weatherCode = data.current.weathercode;
    const weatherText = getWeatherDescription(weatherCode);
    document.getElementById("meteo").innerHTML = `🌡 ${temp}°C – ${weatherText}`;
  } catch (err) {
    document.getElementById("meteo").textContent = "Météo indisponible";
  }
}

function getWeatherDescription(code) {
  const map = {
    0: "Ciel clair",
    1: "Principalement clair",
    2: "Partiellement nuageux",
    3: "Couvert",
    45: "Brouillard",
    48: "Brouillard givrant",
    51: "Bruine faible",
    61: "Pluie faible",
    71: "Neige faible",
    80: "Averses faibles",
    95: "Orage",
  };
  return map[code] || "Conditions inconnues";
}

// 🚲 Vélib’
async function fetchVelib() {
  try {
    const stations = [
      { id: "10020", name: "Vincennes" },
      { id: "12129", name: "Joinville" }
    ];

    const infos = await Promise.all(
      stations.map(async (s) => {
        const url = `https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json`;
        const status = `https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json`;
        const [infoRes, statusRes] = await Promise.all([fetch(url), fetch(status)]);
        const info = (await infoRes.json()).data.stations.find(st => st.station_id === s.id);
        const stat = (await statusRes.json()).data.stations.find(st => st.station_id === s.id);

        return `🚲 ${s.name} : ${stat.num_bikes_available} vélos, ${stat.num_docks_available} bornes`;
      })
    );

    document.getElementById("velib").innerHTML = infos.join("<br>");
  } catch {
    document.getElementById("velib").textContent = "Vélib’ indisponible";
  }
}

// 📰 Actus France Info
async function fetchNews() {
  try {
    const url = "https://api.allorigins.win/get?url=" + encodeURIComponent("https://www.francetvinfo.fr/titres.rss");
    const res = await fetch(url);
    const data = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(data.contents, "application/xml");
    const items = xml.querySelectorAll("item");
    const titles = Array.from(items).slice(0, 5).map(item => item.querySelector("title").textContent);
    document.getElementById("news-ticker").innerHTML = "📰 " + titles.join(" • ");
  } catch {
    document.getElementById("news-ticker").textContent = "Actus indisponibles";
  }
}

// ⚠️ Alertes trafic
async function fetchAlerts() {
  try {
    const res = await fetch("https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/v2/general-message");
    const data = await res.json();
    const messages = data.messages?.slice(0, 5).map(m => m.message) || [];
    document.getElementById("alertes").innerHTML = messages.length ? messages.join("<br>") : "Aucune alerte";
  } catch {
    document.getElementById("alertes").textContent = "Alertes indisponibles";
  }
}

// 🐎 Courses
async function fetchRaces() {
  try {
    const res = await fetch("races.json");
    const data = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const todayRaces = data[today] || [];
    document.getElementById("courses").innerHTML = todayRaces.length
      ? todayRaces.map(r => `🎽 ${r.time} – ${r.title}`).join("<br>")
      : "Pas de course prévue aujourd’hui.";
  } catch {
    document.getElementById("courses").textContent = "Courses indisponibles";
  }
}

// 🚍 Transports
async function fetchTransports() {
  const stops = [
    { id: "STIF:StopArea:SP:43135:", name: "Joinville-le-Pont", lines: ["C02251", "C01130", "C01135", "C01137", "C01139", "C01141", "C01219", "C01260", "C01399"] },
    { id: "STIF:StopArea:SP:463641:", name: "Hippodrome de Vincennes", lines: ["C02251"] },
    { id: "STIF:StopArea:SP:463644:", name: "École du Breuil", lines: ["C02251", "C01219"] },
  ];

  for (const stop of stops) {
    try {
      const res = await fetch(`https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stop.id}`);
      const data = await res.json();
      const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

      // Regrouper par ligne + destination
      const byLine = {};
      visits.forEach(v => {
        const lineId = v.MonitoredVehicleJourney.LineRef.value.split("::")[2].replace(":", "");
        const dest = v.MonitoredVehicleJourney.DestinationName?.[0]?.value || "Destination inconnue";
        const key = `${lineId}__${dest}`;
        if (!byLine[key]) byLine[key] = [];
        byLine[key].push(v);
      });

      // Générer le HTML
      const bloc = document.getElementById("transport-" + stop.name.replaceAll(" ", ""));
      bloc.innerHTML = Object.entries(byLine).map(([key, visits]) => {
        const [line, dest] = key.split("__");
        const horaires = visits.slice(0, 2).map(v => {
          const dt = new Date(v.MonitoredVehicleJourney.MonitoredCall.ExpectedDepartureTime);
          const now = new Date();
          const diff = Math.round((dt - now) / 60000);
          const retard = v.MonitoredVehicleJourney.MonitoredCall.DepartureStatus === "delayed" ? "⚠️ retardé" : "";
          return `🕒 ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${diff} min) ${retard}`;
        }).join("<br>");
        return `<h4>🚌 ${line} → ${dest}</h4>${horaires}`;
      }).join("<hr>");

    } catch (e) {
      document.getElementById("transport-" + stop.name.replaceAll(" ", "")).textContent = "Transports indisponibles";
    }
  }
}