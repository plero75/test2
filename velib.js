async function loadVelib() {
  const url = "https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_information.json";
  try {
    const res = await fetch(url);
    const data = await res.json();
    const joinville = data.data.stations.find(s => s.name.includes("JOINVILLE"));
    const velibBlock = document.getElementById("velibBlock");
    if (joinville) {
      velibBlock.innerHTML = `<p>🚲 Station ${joinville.name} : ${joinville.capacity} places</p>`;
    } else {
      velibBlock.innerHTML = "🚲 Station introuvable.";
    }
  } catch (e) {
    console.error("Erreur Vélib", e);
  }
}
loadVelib();