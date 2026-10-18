// Google publishes this manual at 493.9pt plus 59pt side margins.
// Keep that paper width centered; shrink it only when the reader is narrower.
const sopViewport = document.querySelector(".sop-document-viewport");
const sopFrame = document.querySelector(".sop-document-frame");
function fitSopDocument(){
  if(!sopViewport || !sopFrame || !sopViewport.clientWidth) return;
  const scale = Math.min(1, sopViewport.clientWidth / 850);
  sopFrame.style.setProperty("--sop-scale", scale);
  sopFrame.style.setProperty("--sop-frame-height", Math.ceil(sopViewport.clientHeight / scale) + "px");
}
if(sopViewport){
  new ResizeObserver(fitSopDocument).observe(sopViewport);
  sopFrame.addEventListener("load", fitSopDocument);
  fitSopDocument();
}
