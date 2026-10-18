import { firebaseConfig } from "./portal-config.js";
const modules = [...document.querySelectorAll("[data-portal-module]")];
if(firebaseConfig){
  for(const script of modules){
    try{ await import(new URL(script.dataset.portalModule, import.meta.url).href); }
    catch(error){ console.error("Portal service could not start:", error); showSetup("Portal services are unavailable. Please contact Rattler Nation command staff."); }
  }
}else if(modules.length){
  showSetup("Rattler Nation portal services are being configured. Announcements, training, case records, resources, and staff sign-in will become available after setup.");
  document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", event => event.preventDefault());
    form.querySelectorAll("input, textarea, select, button").forEach(control => control.disabled = true);
  });
  document.querySelectorAll("button:not(.inner-nav-toggle):not(#printScheduleBtn), input, textarea, select").forEach(control => control.disabled = true);
  document.getElementById("printScheduleBtn")?.addEventListener("click", () => window.print());
  document.querySelectorAll(".is-loading, #announcements-list, #homepage-training").forEach(box => {
    box.classList.remove("is-loading");
    box.textContent = "Awaiting Rattler Nation portal setup.";
  });
}
function showSetup(message){
  if(document.querySelector(".portal-setup-notice")) return;
  const notice = document.createElement("aside");
  notice.className = "portal-setup-notice";
  notice.setAttribute("role", "status");
  notice.textContent = message;
  const host = document.querySelector(".main, .page-layout") || document.body;
  host.prepend(notice);
}
