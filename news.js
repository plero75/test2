// --- Actus défilantes France Info via proxy ---
let newsItems = [];
let currentNewsIndex = 0;

async function fetchNewsTicker(containerId) {
  const proxyURL = "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=";
  const rssURL = "https://api.rss2json.com/v1/api.json?rss_url=https://www.francetvinfo.fr/titres.rss";
  const fullURL = proxyURL + encodeURIComponent(rssURL);

  try {
    const response = await fetch(fullURL);
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
