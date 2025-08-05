async function loadWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=48.83&longitude=2.46&current=temperature_2m,weathercode&timezone=Europe%2FParis";
  try {
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current.temperature_2m;
    const code = data.current.weathercode;
    const weatherBlock = document.getElementById("weatherBlock");
    weatherBlock.innerHTML = `<p>🌡️ ${temp} °C – Code météo ${code}</p>`;
  } catch (e) {
    console.error("Erreur météo", e);
  }
}
loadWeather();