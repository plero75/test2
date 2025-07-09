diff --git a/script.js b/script.js
index 15cd0754d077a307868d67e9e8863cc3f8fdc253..468f039a635813b724d236a53ab91e6158d83bba 100644
--- a/script.js
+++ b/script.js
@@ -5,62 +5,62 @@ const lineMap = {
   "STIF:StopArea:SP:43135:": "STIF:Line::C01742:",
   "STIF:StopArea:SP:463641:": "STIF:Line::C01789:",
   "STIF:StopArea:SP:463644:": "STIF:Line::C01805:",
 };
 
 document.addEventListener("DOMContentLoaded", () => {
   loop();
   setInterval(loop, 60000);
   startWeatherLoop();
   afficherProchaineCourseVincennes();
   afficherToutesCoursesVincennes();
 });
 
 function loop() {
   clock();
   fetchAll();
 }
 
 function clock() {
   document.getElementById("datetime").textContent = new Date().toLocaleString("fr-FR", {
     weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
   });
 }
 
 function fetchAll() {
-  horaire("rer", CONFIG.stops.rer, "🚆 RER A");
-  horaire("bus77", CONFIG.stops.bus77, "🚌 Bus 77");
-  horaire("bus201", CONFIG.stops.bus201, "🚌 Bus 201");
+  horaire("rer", CONFIG.stops.rer);
+  horaire("bus77", CONFIG.stops.bus77);
+  horaire("bus201", CONFIG.stops.bus201);
   meteo();
   news();
 }
 
 function createHorizontalScroller(stops) {
   return `<div class="stops-scroll">🚏 ${stops.map(s => `<span>${s}</span>`).join('➔')}</div>`;
 }
 
-async function horaire(id, stop, title) {
+async function horaire(id, stop) {
   const scheduleEl = document.getElementById(`${id}-schedules`);
   const alertEl = document.getElementById(`${id}-alert`);
   try {
     const url = proxy + encodeURIComponent(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${stop}`);
     const data = await fetch(url).then(r => r.json());
     const visits = data.Siri.ServiceDelivery.StopMonitoringDelivery[0]?.MonitoredStopVisit || [];
 
     if (!visits.length) {
       scheduleEl.innerHTML = "Aucun passage prévu pour l’instant";
       return;
     }
 
     const passagesByDest = {};
     for (let v of visits.slice(0, 8)) {
       const call = v.MonitoredVehicleJourney.MonitoredCall;
       const dest = Array.isArray(call.DestinationDisplay) ? call.DestinationDisplay[0]?.value : call.DestinationDisplay || "Indisponible";
       if (!passagesByDest[dest]) passagesByDest[dest] = [];
       passagesByDest[dest].push(v);
     }
 
     let horairesHTML = "";
     for (const [dest, passages] of Object.entries(passagesByDest)) {
       const first = passages[0];
       const callFirst = first.MonitoredVehicleJourney.MonitoredCall;
       const expFirst = new Date(callFirst.ExpectedDepartureTime);
