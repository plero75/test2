import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import RSSParser from "rss-parser";

const app = express();
app.use(cors());
app.use(express.static("public"));
const nowStr = () => new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});

app.get("/proxy", async (req, res) => {
  const url = decodeURIComponent(req.query.url||"");
  try {
    const response = await fetch(url);
    const text = await response.text();
    res.send(text);
  } catch {
    res.status(500).send("");
  }
});

app.get("/news", async (req, res) => {
  const parser = new RSSParser();
  const feed = await parser.parseURL("https://www.francetvinfo.fr/titres.rss");
  res.json(feed.items.slice(0,6).map(i=>({title:i.title,desc:i.contentSnippet})));
});

app.listen(3000, () => console.log(`Serveur démarré à ${nowStr()}`));
