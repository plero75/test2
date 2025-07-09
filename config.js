// config.js — Configuration centralisée

export const CONFIG = {
  proxy: "https://ratp-proxy.hippodrome-proxy42.workers.dev/?url=",
  weather: {
    lat: 48.8212,
    lon: 2.4638
  },
  newsUrl: "https://raw.githubusercontent.com/plero75/static-data/main/news.json",
  stops: {
    rer: {
      monitoringRef: "43135",
      lineRef: "STIF:Line::C01742:"
    },
    bus77: {
      monitoringRef: "463641",
      lineRef: "STIF:Line::C01789:"
    },
    bus201: {
      monitoringRef: "463644",
      lineRef: "STIF:Line::C01805:"
    }
  }
};
