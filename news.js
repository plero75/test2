async function loadNews() {
  const url = "https://www.francetvinfo.fr/titres.rss";
  try {
    const res = await fetch(url);
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    const first = xml.querySelector("item title");
    const newsTicker = document.getElementById("newsTicker");
    newsTicker.textContent = "📰 " + (first ? first.textContent : "Aucune actu.");
  } catch (e) {
    console.error("Erreur actu France Info", e);
  }
}
loadNews();