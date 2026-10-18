// Published Google Sheets keep fixed column widths inside their iframe.
// Use the complete published column width plus room for the vertical scrollbar.
const rosterViewport = document.querySelector(".roster-viewport");
const rosterFrame = document.querySelector(".roster-frame");
const publishedSheetWidth = 2461;
function fitRoster(){
  if(!rosterViewport || !rosterFrame) return;
  const width = rosterViewport.clientWidth;
  if(!width) return;
  const scale = Math.min(1, width / publishedSheetWidth);
  rosterFrame.style.setProperty("--roster-width", publishedSheetWidth + "px");
  rosterFrame.style.setProperty("--roster-scale", scale);
  rosterFrame.style.setProperty("--roster-height", Math.ceil(rosterViewport.clientHeight / scale) + "px");
}
if(rosterViewport){
  new ResizeObserver(fitRoster).observe(rosterViewport);
  rosterFrame.addEventListener("load", fitRoster);
  fitRoster();
}
