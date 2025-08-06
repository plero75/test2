async function loadNews() {
const CORS_PROXY = 'https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=';
const feedURL = 'https://api.rss2json.com/v1/api.json?rss_url=https://www.francetvinfo.fr/titres.rss';

const url = CORS_PROXY + encodeURIComponent(feedURL);
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
