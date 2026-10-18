// Shared confirmation using the portal's original Confirm Action dialog design.
let confirmationOpen = false;
export function confirmPortalAction({title="Confirm Action", message="Are you sure?", confirmLabel="Confirm"} = {}){
  if(confirmationOpen) return Promise.resolve(false);
  confirmationOpen = true;
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const wasLocked = document.body.classList.contains("modal-open");
    const modal = document.createElement("div");
    modal.className = "planner-modal open portal-confirm-modal";
    modal.setAttribute("aria-hidden", "false");
    modal.innerHTML = '<div class="planner-modal-panel confirm-panel" role="dialog" aria-modal="true" aria-labelledby="portalConfirmTitle" aria-describedby="portalConfirmMessage"><div class="planner-modal-header"><div><p class="eyebrow">Confirm Action</p><h2 id="portalConfirmTitle"></h2></div></div><p class="confirm-copy" id="portalConfirmMessage"></p><div class="planner-modal-actions"><button class="back-button" type="button" data-confirm-cancel>Cancel</button><button class="danger-btn" type="button" data-confirm-accept></button></div></div>';
    modal.querySelector("#portalConfirmTitle").textContent = title;
    modal.querySelector("#portalConfirmMessage").textContent = message;
    const cancel = modal.querySelector("[data-confirm-cancel]");
    const accept = modal.querySelector("[data-confirm-accept]");
    accept.textContent = confirmLabel;
    function finish(confirmed){
      modal.remove();
      document.removeEventListener("keydown", onKey, true);
      if(!wasLocked && !document.querySelector(".planner-modal.open")) document.body.classList.remove("modal-open");
      confirmationOpen = false;
      if(previousFocus?.isConnected) previousFocus.focus();
      resolve(confirmed);
    }
    function onKey(event){
      if(event.key === "Escape"){
        event.preventDefault(); event.stopImmediatePropagation(); finish(false);
      }else if(event.key === "Tab"){
        event.preventDefault();
        (document.activeElement === cancel ? accept : cancel).focus();
      }
    }
    cancel.addEventListener("click", () => finish(false));
    accept.addEventListener("click", () => finish(true));
    modal.addEventListener("click", event => { if(event.target === modal) finish(false); });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(modal);
    document.body.classList.add("modal-open");
    cancel.focus();
  });
}
