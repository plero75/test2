// === weather.js ===

async function fetchWeather() {
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=48.835&longitude=2.423&current_weather=true');
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const w = (await response.json()).current_weather;
    document.getElementById("weather-summary").innerHTML = getWeatherIcon(w.weathercode) +
      `🌡 ${w.temperature} °C &nbsp;&nbsp;💨 ${w.windspeed} km/h`;
    document.getElementById("weather-update").textContent = "Mise à jour : " + (new Date()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (err) {
    document.getElementById("weather-summary").innerHTML = '❌ Erreur météo';
  }
}

function getWeatherIcon(code) {
  if (code < 3) return "☀️";         // Soleil
  if (code < 6) return "⛅";         // Partiellement nuageux
  if (code < 56) return "🌧";        // Pluie
  if (code < 67) return "❄️";        // Neige
  return "❓";                   // Inconnu
}

fetchWeather();
