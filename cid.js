import {
  addCaseNarrative,
  createCidCase,
  deleteCidCase,
  updateCidCase,
  subscribeToCaseNarratives,
  subscribeToCidCases
} from "./cid-cases-service.js";

import { logPortalAction } from "./portal-log-service.js";

import {
  signInStaff,
  signOutStaff,
  watchStaffAuth
} from "./staff-auth-service.js";

let staffAccess = {
  user:null,
  role:null,
  canEdit:false
};
let cidCases = [];
let activeCaseId = "";
let deletingCase = false;
let pendingDeleteCaseId = "";
let activeFilter = "All";
let activeSearch = "";
let unsubscribeNarratives = null;
let unsubscribeCases = null;
let caseSubscriptionGeneration = 0;
let evidenceBlockCounter = 0;
let investigatorBlockCounter = 0;
let plateBlockCounter = 0;
let locationBlockCounter = 0;
let chargeBlockCounter = 0;

const casesList = document.getElementById("cidCasesList");
const filters = document.getElementById("cidCaseFilters");
const searchInput = document.getElementById("cidCaseSearch");
const caseCount = document.getElementById("cidCaseCount");
const activeFilterLabel = document.getElementById("cidActiveFilter");
const createCaseBtn = document.getElementById("createCidCaseBtn");
const caseModal = document.getElementById("cidCaseModal");
const caseForm = document.getElementById("cidCaseForm");
const caseFormStatus = document.getElementById("cidCaseFormStatus");
const caseSubmitBtn = document.getElementById("cidCaseSubmitBtn");
const detailsModal = document.getElementById("cidCaseDetailsModal");
const detailsTitle = document.getElementById("cidCaseDetailsTitle");
const detailsMeta = document.getElementById("cidCaseDetailsMeta");
const detailsContent = document.getElementById("cidCaseDetailsContent");
const deleteCaseBtn = document.getElementById("deleteCidCaseBtn");
const deleteStatus = document.getElementById("cidDeleteConfirmStatus");
const deleteConfirmModal = document.getElementById("cidDeleteConfirmModal");
const confirmCaseDeleteBtn = document.getElementById("confirmCidDeleteBtn");
const cancelCaseDeleteBtn = document.getElementById("cancelCidDeleteBtn");
const narrativeForm = document.getElementById("cidNarrativeForm");
const narrativeFormStatus = document.getElementById("cidNarrativeFormStatus");
const narrativeSubmitBtn = document.getElementById("cidNarrativeSubmitBtn");
const loginForm = document.getElementById("cidLoginForm");
const sessionPanel = document.getElementById("cidSessionPanel");
const accessSummary = document.getElementById("cidAccessSummary");
const authStatus = document.getElementById("cidAuthStatus");
const userEmail = document.getElementById("cidUserEmail");
const roleLabel = document.getElementById("cidRoleLabel");
const evidenceList = document.getElementById("cidEvidenceList");
const addEvidenceBtn = document.getElementById("addCidEvidenceBtn");
const investigatorList = document.getElementById("cidInvestigatorList");
const addInvestigatorBtn = document.getElementById("addCidInvestigatorBtn");
const photoHelpModal = document.getElementById("cidPhotoHelpModal");
const plateList = document.getElementById("cidPlateList");
const addPlateBtn = document.getElementById("addCidPlateBtn");
const locationList = document.getElementById("cidLocationList");
const addLocationBtn = document.getElementById("addCidLocationBtn");
const chargeList = document.getElementById("cidChargeList");
const addChargeBtn = document.getElementById("addCidChargeBtn");

function stopCaseSubscription(){
  caseSubscriptionGeneration++;
  if(typeof unsubscribeCases === "function") unsubscribeCases();
  unsubscribeCases = null;
}

watchStaffAuth(access => {
  staffAccess = access;
  stopCaseSubscription();
  updateAccessUI();
  if(!access.canCid){
    cidCases = [];
    if(!deletingCase){
      closeDetailsModal();
      closeCaseModal();
    }
    renderFilters();
    renderStatus();
    if(casesList) casesList.innerHTML = emptyStateHTML(
      "Authorized CID access required",
      "Sign in with an approved staff account to view case files."
    );
    if(access.user) setAuthStatus("This account does not have CID case access.", "warning");
    return;
  }
  if(!casesList) return;
  casesList.innerHTML = emptyStateHTML("Loading CID cases", "Checking controlled case files.");
  const generation = caseSubscriptionGeneration;
  unsubscribeCases = subscribeToCidCases(
    cases => {
      if(generation !== caseSubscriptionGeneration) return;
      cidCases = cases;
      renderCases();
    },
    error => {
      if(generation !== caseSubscriptionGeneration) return;
      console.error("CID case sync failed:", error);
      cidCases = [];
      renderStatus();
      casesList.innerHTML = emptyStateHTML("CID cases unavailable", "Case files could not be loaded. Check portal access and Firebase rules.", "error");
    }
  );
});

createCaseBtn?.addEventListener("click", openCaseModal);
deleteCaseBtn?.addEventListener("click", handleDeleteCase);
confirmCaseDeleteBtn?.addEventListener("click", confirmDeleteCase);
cancelCaseDeleteBtn?.addEventListener("click", closeDeleteConfirmation);
deleteConfirmModal?.addEventListener("click", event => {
  if(event.target === deleteConfirmModal) closeDeleteConfirmation();
});
caseForm?.addEventListener("submit", handleCaseSubmit);
narrativeForm?.addEventListener("submit", handleNarrativeSubmit);
loginForm?.addEventListener("submit", handleLogin);
document.getElementById("cidSignOutBtn")?.addEventListener("click", handleSignOut);
addEvidenceBtn?.addEventListener("click", () => addEvidenceBlock());
addInvestigatorBtn?.addEventListener("click", () => addInvestigatorBlock());
addPlateBtn?.addEventListener("click", () => addPlateBlock());
addLocationBtn?.addEventListener("click", () => addLocationBlock());
addChargeBtn?.addEventListener("click", () => addChargeBlock());
document.getElementById("cidPhotoHelpBtn")?.addEventListener("click", () => openModal(photoHelpModal));

document.querySelectorAll("[data-close-cid-help]").forEach(button => {
  button.addEventListener("click", () => closeModal(photoHelpModal));
});

filters?.addEventListener("click", event => {
  const filterButton = event.target.closest("[data-cid-filter]");

  if(!filterButton){
    return;
  }

  activeFilter = filterButton.dataset.cidFilter || "All";
  renderCases();
});

searchInput?.addEventListener("input", event => {
  activeSearch = event.target.value.trim().toLowerCase();
  renderCases();
});

document.querySelectorAll("[data-close-cid-modal]").forEach(button => {
  button.addEventListener("click", closeCaseModal);
});

document.querySelectorAll("[data-close-cid-details]").forEach(button => {
  button.addEventListener("click", closeDetailsModal);
});

[caseModal, detailsModal, photoHelpModal].forEach(modal => {
  modal?.addEventListener("click", event => {
    if(event.target === modal){
      if(modal === caseModal){
        return;
      }else if(modal === detailsModal){
        closeDetailsModal();
      }else{
        closeModal(photoHelpModal);
      }
    }
  });
});

document.addEventListener("keydown", event => {
  if(event.key !== "Escape"){
    return;
  }

  if(deleteConfirmModal?.classList.contains("open")){
    closeDeleteConfirmation();
    return;
  }

  if(caseModal?.classList.contains("open")){
    return;
  }

  if(detailsModal?.classList.contains("open")){
    closeDetailsModal();
  }

  if(photoHelpModal?.classList.contains("open")){
    closeModal(photoHelpModal);
  }
});

function renderCases(){
  if(!casesList){
    return;
  }

  renderFilters();
  renderStatus();

  if(!cidCases.length){
    casesList.innerHTML = emptyStateHTML(
      "No CID cases created",
      "Authorized investigators can create case files with narratives and linked evidence."
    );
    updateAccessUI();
    return;
  }

  const visibleCases = filteredCases();

  if(!visibleCases.length){
    casesList.innerHTML = emptyStateHTML(
      activeSearch ? "No matching CID cases" : `No ${activeFilter} cases`,
      activeSearch ? "Adjust the search text or choose another status filter." : "Choose All to review every visible case file."
    );
    updateAccessUI();
    return;
  }

  casesList.innerHTML = visibleCases.map(caseFileHTML).join("");

  casesList.querySelectorAll("[data-view-cid-case]").forEach(button => {
    button.addEventListener("click", () => openDetailsModal(button.dataset.viewCidCase));
  });

  updateAccessUI();
}

function filteredCases(){
  return cidCases.filter(caseFile => {
    const status = caseFile.status || "Open";
    const matchesFilter = activeFilter === "All" || status === activeFilter;

    if(!matchesFilter){
      return false;
    }

    if(!activeSearch){
      return true;
    }

    return [
      caseFile.caseNumber,
      caseFile.subjectName,
      caseFile.subjectIdentifiers,
      caseFile.status,
      caseFile.priority,
      caseFile.leadInvestigator,
      caseFile.summary
    ].some(value => String(value || "").toLowerCase().includes(activeSearch));
  });
}

function renderFilters(){
  if(!filters){
    return;
  }

  const statuses = ["All", ...Array.from(new Set(
    cidCases.map(caseFile => caseFile.status || "Open")
  )).sort((a, b) => a.localeCompare(b))];

  if(activeFilter !== "All" && !statuses.includes(activeFilter)){
    activeFilter = "All";
  }

  filters.innerHTML = statuses.map(status => {
    const count = status === "All"
      ? cidCases.length
      : cidCases.filter(caseFile => (caseFile.status || "Open") === status).length;
    const active = status === activeFilter ? " active" : "";

    return `
      <button class="resource-filter-pill${active}" data-cid-filter="${escapeAttr(status)}" type="button" aria-pressed="${status === activeFilter}">
        <span>${escapeHTML(status)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");
}

function renderStatus(){
  if(caseCount){
    caseCount.textContent = String(cidCases.length);
  }

  if(activeFilterLabel){
    activeFilterLabel.textContent = activeSearch ? `${activeFilter} + Search` : activeFilter;
  }
}

function caseFileHTML(caseFile){
  const mediaCount = Array.isArray(caseFile.media) ? caseFile.media.length : 0;
  const date = formatDate(caseFile.updatedAt || caseFile.createdAt);
  const meta = [
    caseFile.leadInvestigator ? `Investigator(s): ${caseFile.leadInvestigator}` : "",
    date ? `Updated ${date}` : ""
  ].filter(Boolean).join(" - ");
  const caseTitle = caseFile.summary || caseFile.subjectName || "Untitled CID Case";
  const caseFocus = caseFile.subjectIdentifiers || caseFile.subjectName || "No target details entered.";

  return `
    <article class="resource-post-card cid-case-card">
      <div class="resource-post-main">
        <div class="resource-post-card-top">
          <span class="resource-post-category">${escapeHTML(caseFile.status || "Open")}</span>
          <span class="cid-priority priority-${escapeAttr((caseFile.priority || "standard").toLowerCase())}">${escapeHTML(caseFile.priority || "Standard")}</span>
          ${mediaCount ? `<span class="resource-link-indicator">${mediaCount} Media</span>` : ""}
        </div>
        <h3>${escapeHTML(caseTitle)}</h3>
        <p>${escapeHTML(caseFocus).replace(/\n/g, " - ")}</p>
        <small>${escapeHTML(meta)}</small>
      </div>
      <div class="resource-post-actions">
        <button class="back-button small" data-view-cid-case="${escapeAttr(caseFile.id)}" type="button">View Case</button>
      </div>
    </article>
  `;
}

async function handleCaseSubmit(event){
  event.preventDefault();
  clearCaseErrors();

  if(!canManageCases()){
    setCaseStatus("Sign in with an authorized account to create CID cases.");
    return;
  }

  const evidenceLinks = readEvidenceLinks();
  const caseData = {
    caseNumber:"",
    subjectName:caseSubjectLabel(),
    subjectIdentifiers:caseSubjectDetails(),
    status:document.getElementById("cidCaseStatus").value,
    priority:document.getElementById("cidCasePriority").value,
    leadInvestigator:combinedInvestigators(),
    summary:document.getElementById("cidCaseSummary").value.trim(),
    narrative:combinedNarrative(),
    media:stripEvidenceFormIds(evidenceLinks)
  };
  const errors = validateCase({
    ...caseData,
    media:evidenceLinks
  });

  if(Object.keys(errors).length){
    showCaseErrors(errors);
    setCaseStatus("Please complete the required case fields.");
    return;
  }

  try{
    setCaseStatus("Creating case file...");
    setCaseSubmitting(true);
    const createdCase = await createCidCase(caseData, staffAccess);
    await logPortalAction(staffAccess, {
      action:"CID Case Created",
      category:"CID",
      message:`Created CID case for ${caseData.subjectName}.`,
      targetUid:createdCase.id,
      targetLabel:caseData.subjectName,
      suspectNames:document.getElementById("cidSubjectIdentifiers").value.trim(),
      postAuthor:caseData.leadInvestigator || staffAccess.user?.email || "",
      postCategory:caseData.status,
      postDetails:caseData.summary,
      postNarrative:caseData.narrative,
      resourceUrl:""
    });
    caseForm.reset();
    resetEvidenceBlocks();
    resetInvestigatorBlocks();
    resetPlateBlocks();
    resetLocationBlocks();
    resetChargeBlocks();
    closeCaseModal();
    setAuthStatus("CID case created.", "success");
  }catch(error){
    console.error("CID case create failed:", error);
    setCaseStatus("Case could not be created. Confirm Firestore rules include the current CID statuses and media fields.");
  }finally{
    setCaseSubmitting(false);
  }
}

async function handleNarrativeSubmit(event){
  event.preventDefault();
  clearNarrativeErrors();

  if(!activeCaseId || !canManageCases()){
    setNarrativeStatus("Sign in with an authorized account to add narratives.");
    return;
  }

  const caseFile = cidCases.find(item => item.id === activeCaseId);
  const narrative = {
    title:document.getElementById("cidNarrativeTitle").value.trim() || "Follow-up Narrative",
    body:document.getElementById("cidNarrativeBody").value.trim()
  };

  if(!narrative.body){
    showNarrativeError("cidNarrativeBody", "Narrative text is required.");
    setNarrativeStatus("Enter the narrative before saving.");
    return;
  }

  try{
    setNarrativeStatus("Adding narrative...");
    if(narrativeSubmitBtn){
      narrativeSubmitBtn.disabled = true;
    }
    await addCaseNarrative(activeCaseId, narrative, staffAccess);
    await logPortalAction(staffAccess, {
      action:"CID Narrative Added",
      category:"CID",
      message:`Added narrative to CID case: ${caseFile?.subjectName || activeCaseId}.`,
      targetUid:activeCaseId,
      targetLabel:caseFile?.subjectName || activeCaseId,
      postAuthor:staffAccess.user?.email || "",
      postCategory:caseFile?.status || "Open",
      postDetails:narrative.title,
      postNarrative:narrative.body,
      resourceUrl:""
    });
    narrativeForm.reset();
    setNarrativeStatus("Narrative added.");
  }catch(error){
    console.error("CID narrative add failed:", error);
    setNarrativeStatus("Narrative could not be added. Check portal access and Firebase rules.");
  }finally{
    if(narrativeSubmitBtn){
      narrativeSubmitBtn.disabled = false;
    }
  }
}

function openCaseModal(){
  if(!canManageCases()){
    setAuthStatus("Sign in with an authorized account before creating CID cases.", "warning");
    return;
  }

  clearCaseErrors();
  caseForm?.reset();
  resetEvidenceBlocks();
  resetInvestigatorBlocks();
  resetPlateBlocks();
  resetLocationBlocks();
  resetChargeBlocks();
  openModal(caseModal);
  document.getElementById("cidSubjectIdentifiers")?.focus();
}

function closeCaseModal(){
  closeModal(caseModal);
}

function openDetailsModal(caseId){
  const caseFile = cidCases.find(item => item.id === caseId);

  if(!caseFile || !detailsModal || !detailsContent){
    return;
  }

  activeCaseId = caseId;
  document.getElementById("cidUpdateStatus").value=caseFile.status||"Open";
  document.getElementById("cidUpdatePriority").value=caseFile.priority||"Standard";
  document.getElementById("cidUpdateInvestigator").value=caseFile.leadInvestigator||"";
  if(deleteStatus) deleteStatus.textContent = "";

  if(detailsTitle){
    detailsTitle.textContent = caseFile.summary || caseFile.subjectName || "CID Case File";
  }

  if(detailsMeta){
    detailsMeta.textContent = caseFile.status || "Open";
  }

  detailsContent.innerHTML = caseDetailsHTML(caseFile, []);

  if(typeof unsubscribeNarratives === "function"){
    unsubscribeNarratives();
  }

  unsubscribeNarratives = subscribeToCaseNarratives(
    caseId,
    narratives => {
      detailsContent.innerHTML = caseDetailsHTML(caseFile, narratives);
    },
    error => {
      console.error("CID narratives sync failed:", error);
      detailsContent.innerHTML = caseDetailsHTML(caseFile, []);
    }
  );

  updateAccessUI();
  openModal(detailsModal);
}

function handleDeleteCase(){
  if(deletingCase || !canManageCases() || !activeCaseId) return;
  const caseFile = cidCases.find(item => item.id === activeCaseId);
  if(!caseFile) return;
  pendingDeleteCaseId = activeCaseId;
  document.getElementById("cidDeleteCaseName").textContent = caseFile.summary || caseFile.subjectName || "this case";
  if(deleteStatus) deleteStatus.textContent = "";
  openModal(deleteConfirmModal);
  cancelCaseDeleteBtn?.focus();
}

function closeDeleteConfirmation(){
  if(deletingCase) return;
  pendingDeleteCaseId = "";
  closeModal(deleteConfirmModal);
  deleteCaseBtn?.focus();
}

async function confirmDeleteCase(){
  if(deletingCase || !canManageCases() || !pendingDeleteCaseId) return;
  const caseId = pendingDeleteCaseId;
  if(activeCaseId !== caseId) return;
  const caseFile = cidCases.find(item => item.id === caseId);
  if(!caseFile) { closeDeleteConfirmation(); return; }
  deletingCase = true;
  confirmCaseDeleteBtn.disabled = true;
  confirmCaseDeleteBtn.textContent = "Deleting...";
  cancelCaseDeleteBtn.disabled = true;
  deleteCaseBtn.disabled = true;
  deleteCaseBtn.textContent = "Deleting...";
  if(deleteStatus) deleteStatus.textContent = "";
  try{
    await deleteCidCase(caseId);
    await logPortalAction(staffAccess, {
      action:"CID Case Deleted",
      category:"CID",
      message:"Deleted CID case file.",
      targetUid:caseId,
      targetLabel:"CID Case File",
      suspectNames:(caseFile.subjectIdentifiers || "").match(/^Subject\(s\):\s*(.+)$/m)?.[1]?.trim() || ""
    });
    cidCases = cidCases.filter(item => item.id !== caseId);
    renderCases();
    pendingDeleteCaseId = "";
    closeModal(deleteConfirmModal);
    if(activeCaseId === caseId) closeDetailsModal();
    setAuthStatus("CID case deleted.", "success");
  }catch(error){
    console.error("CID case deletion failed:", error);
    if(deleteStatus) deleteStatus.textContent = error.code === "permission-denied"
      ? "Deletion is not permitted. Ask the portal owner to enable CID case and narrative deletion in Firestore rules."
      : "Case could not be deleted. " + (error.message || "Please try again.");
  }finally{
    deletingCase = false;
    confirmCaseDeleteBtn.disabled = false;
    confirmCaseDeleteBtn.textContent = "Delete Case";
    cancelCaseDeleteBtn.disabled = false;
    deleteCaseBtn.disabled = false;
    deleteCaseBtn.textContent = "Delete Case";
  }
}

function closeDetailsModal(){
  if(deletingCase && pendingDeleteCaseId) return;
  if(pendingDeleteCaseId) closeDeleteConfirmation();
  if(typeof unsubscribeNarratives === "function"){
    unsubscribeNarratives();
  }

  unsubscribeNarratives = null;
  activeCaseId = "";
  closeModal(detailsModal);
}

function caseDetailsHTML(caseFile, narratives){
  const media = Array.isArray(caseFile.media) ? caseFile.media : [];
  const rows = [
    ["Status", caseFile.status],
    ["Priority", caseFile.priority],
    ["Investigator(s)", caseFile.leadInvestigator],
    ["Case Focus", caseFile.subjectIdentifiers],
    ["Created By", caseFile.createdBy],
    ["Last Updated", formatDate(caseFile.updatedAt || caseFile.createdAt)]
  ].filter(([, value]) => value);

  return `
    <dl class="details-list cid-details-list">
      ${rows.map(([label, value]) => `
        <div>
          <dt>${escapeHTML(label)}</dt>
          <dd>${escapeHTML(value).replace(/\n/g, "<br>")}</dd>
        </div>
      `).join("")}
    </dl>

    <section class="cid-detail-section">
      <h3>Narratives</h3>
      <div class="cid-narrative-list">
        ${narratives.length ? narratives.map(narrativeHTML).join("") : `<p class="empty-day">No narratives have been added yet.</p>`}
      </div>
    </section>

    <section class="cid-detail-section">
      <h3>Evidence Links</h3>
      ${media.length ? `<div class="cid-media-grid">${media.map(mediaHTML).join("")}</div>` : `<p class="empty-day">No evidence links attached to this case.</p>`}
    </section>
  `;
}

function narrativeHTML(narrative){
  return `
    <article class="cid-narrative-entry">
      <div>
        <strong>${escapeHTML(narrative.title || "Case Narrative")}</strong>
        <small>${escapeHTML([narrative.author, formatDate(narrative.createdAt)].filter(Boolean).join(" - "))}</small>
      </div>
      <p>${escapeHTML(narrative.body || "").replace(/\n/g, "<br>")}</p>
    </article>
  `;
}

function mediaHTML(media){
  const isVideo = String(media.type || "").startsWith("video/");

  return `
    <a class="cid-media-item" href="${escapeAttr(media.url)}" target="_blank" rel="noopener">
      ${isVideo || media.kind === "Video"
        ? `<div class="cid-media-placeholder">Video Evidence</div>`
        : media.kind === "Photo" ? `<img src="${escapeAttr(media.url)}" alt="${escapeAttr(media.name || "CID media")}">` : `<div class="cid-media-placeholder">${escapeHTML(media.kind || "Evidence")}</div>`}
      <span>${escapeHTML(media.name || "Evidence Link")}</span>
    </a>
  `;
}

async function handleLogin(event){
  event.preventDefault();

  const email = document.getElementById("cidEmail").value.trim();
  const password = document.getElementById("cidPassword").value;

  if(!email || !password){
    setAuthStatus("Enter your staff email and password.", "warning");
    return;
  }

  try{
    setAuthStatus("Signing in...", "info");
    await signInStaff(email, password);
    loginForm.reset();
    setAuthStatus("Signed in successfully.", "success");
  }catch(error){
    console.error("CID sign in failed:", error);
    setAuthStatus("Sign in failed. Check the email and password, then try again.", "error");
  }
}

async function handleSignOut(){
  try{
    await signOutStaff();
    setAuthStatus("Signed out.", "info");
  }catch(error){
    console.error("CID sign out failed:", error);
    setAuthStatus("Could not sign out. Try again.", "error");
  }
}

function updateAccessUI(){
  const canEdit = canManageCases();
  document.getElementById("cidUpdateForm").hidden=!canEdit||!activeCaseId;
  if(deleteCaseBtn) deleteCaseBtn.hidden = !canEdit || !activeCaseId;

  if(createCaseBtn){
    createCaseBtn.hidden = !canEdit;
  }

  if(loginForm){
    loginForm.hidden = canEdit;
  }

  if(sessionPanel){
    sessionPanel.hidden = !canEdit;
  }

  if(userEmail){
    userEmail.textContent = staffAccess.user?.email || "Staff User";
  }

  if(roleLabel){
    roleLabel.textContent = staffAccess.role?.admin ? "Admin CID access" : "CID case access";
  }

  if(accessSummary){
    accessSummary.textContent = canEdit
      ? "You can create CID cases, link evidence, and add investigative narratives."
      : "Sign in with an authorized staff account to create and update CID cases.";
  }

  if(narrativeForm){
    narrativeForm.hidden = !canEdit || !activeCaseId;
  }
}

function canManageCases(){
  return Boolean(staffAccess.canCid);
}

function validateCase(caseData){
  const errors = {};

  if(!caseData.subjectIdentifiers){
    errors.cidSubjectIdentifiers = "Enter a subject, property/location, or vehicle plate.";
  }

  if(!caseData.narrative){
    errors.cidCaseNarrative = "Narrative is required.";
  }

  caseData.media.forEach(item => {
    if(!validHttpUrl(item.url)){
      errors[`cidEvidenceUrl-${item.formId}`] = "Enter a valid evidence link beginning with http or https.";
    }
  });

  return errors;
}

function combinedNarrative(){
  const narrative = document.getElementById("cidCaseNarrative").value.trim();
  const charges = readListedCharges();

  if(!charges.length){
    return narrative;
  }

  return [
    narrative,
    "Listed Charges:",
    ...charges.map((charge, index) => `${index + 1}. ${charge}`)
  ].filter(Boolean).join("\n\n");
}

function readListedCharges(){
  return Array.from(document.querySelectorAll("[data-charge-input]"))
    .map(input => input.value.trim())
    .filter(Boolean);
}

function resetChargeBlocks(){
  chargeBlockCounter = 0;

  if(chargeList){
    chargeList.innerHTML = "";
  }
}

function addChargeBlock(){
  if(!chargeList){
    return;
  }

  chargeBlockCounter++;
  const blockId = String(chargeBlockCounter);
  const row = document.createElement("div");
  row.className = "cid-charge-row";
  row.innerHTML = `
    <span class="cid-charge-index">${blockId}</span>
    <input data-charge-input id="cidListedCharge-${blockId}" placeholder="Charge title, statute, or offense description">
    <button class="back-button small subtle-remove" type="button" data-remove-charge>Remove</button>
  `;

  row.querySelector("[data-remove-charge]")?.addEventListener("click", () => {
    row.remove();
  });

  chargeList.appendChild(row);
  row.querySelector("input")?.focus();
}

function caseSubjectLabel(){
  const subjectNames = document.getElementById("cidSubjectIdentifiers").value.trim();
  const propertyLocations = allPropertyLocations().join(", ");
  const vehiclePlates = allVehiclePlates().join(", ");

  return subjectNames || propertyLocations || vehiclePlates || "CID Case";
}

function caseSubjectDetails(){
  const subjectNames = document.getElementById("cidSubjectIdentifiers").value.trim();
  const propertyLocations = allPropertyLocations().join(", ");
  const vehiclePlates = allVehiclePlates().join(", ");

  return [
    subjectNames ? `Subject(s): ${subjectNames}` : "",
    propertyLocations ? `Property/Location: ${propertyLocations}` : "",
    vehiclePlates ? `Vehicle Plate(s): ${vehiclePlates}` : ""
  ].filter(Boolean).join("\n");
}

function allPropertyLocations(){
  const primaryLocation = document.getElementById("cidPropertyLocations").value.trim();
  const additionalLocations = Array.from(document.querySelectorAll("[data-location-input]"))
    .map(input => input.value.trim())
    .filter(Boolean);

  return [primaryLocation, ...additionalLocations].filter(Boolean);
}

function resetLocationBlocks(){
  locationBlockCounter = 0;

  if(locationList){
    locationList.innerHTML = "";
  }
}

function addLocationBlock(){
  if(!locationList){
    return;
  }

  locationBlockCounter++;
  const blockId = String(locationBlockCounter);
  const row = document.createElement("div");
  row.className = "cid-location-row";
  row.innerHTML = `
    <input data-location-input id="cidAdditionalLocation-${blockId}" placeholder="Additional property, house, location, or area">
    <button class="back-button small subtle-remove" type="button" data-remove-location>Remove</button>
  `;

  row.querySelector("[data-remove-location]")?.addEventListener("click", () => {
    row.remove();
  });

  locationList.appendChild(row);
  row.querySelector("input")?.focus();
}

function allVehiclePlates(){
  const primaryPlate = document.getElementById("cidVehiclePlates").value.trim();
  const additionalPlates = Array.from(document.querySelectorAll("[data-plate-input]"))
    .map(input => input.value.trim())
    .filter(Boolean);

  return [primaryPlate, ...additionalPlates].filter(Boolean);
}

function resetPlateBlocks(){
  plateBlockCounter = 0;

  if(plateList){
    plateList.innerHTML = "";
  }
}

function addPlateBlock(){
  if(!plateList){
    return;
  }

  plateBlockCounter++;
  const blockId = String(plateBlockCounter);
  const row = document.createElement("div");
  row.className = "cid-plate-row";
  row.innerHTML = `
    <input data-plate-input id="cidAdditionalPlate-${blockId}" placeholder="Additional plate or vehicle identifier">
    <button class="back-button small subtle-remove" type="button" data-remove-plate>Remove</button>
  `;

  row.querySelector("[data-remove-plate]")?.addEventListener("click", () => {
    row.remove();
  });

  plateList.appendChild(row);
  row.querySelector("input")?.focus();
}

function readEvidenceLinks(){
  return Array.from(document.querySelectorAll("[data-evidence-block]"))
    .map(block => {
      const formId = block.dataset.evidenceBlock;
      const title = block.querySelector("[data-evidence-title]")?.value.trim() || "";
      const kind = block.querySelector("[data-evidence-type]")?.value || "Photo";
      const url = block.querySelector("[data-evidence-url]")?.value.trim() || "";

      if(!title && !url){
        return null;
      }

      return {
        formId,
        name:title || "Evidence Link",
        kind,
        type:kind,
        url
      };
    })
    .filter(Boolean);
}

function stripEvidenceFormIds(evidenceLinks){
  return evidenceLinks.map(({ formId, ...evidence }) => evidence);
}

function combinedInvestigators(){
  const lead = document.getElementById("cidLeadInvestigator").value.trim();
  const additional = readAdditionalInvestigators();

  if(!additional.length){
    return lead;
  }

  if(!lead){
    return additional.join(", ");
  }

  return `${lead} | Additional: ${additional.join(", ")}`;
}

function readAdditionalInvestigators(){
  return Array.from(document.querySelectorAll("[data-investigator-input]"))
    .map(input => input.value.trim())
    .filter(Boolean);
}

function resetInvestigatorBlocks(){
  investigatorBlockCounter = 0;

  if(investigatorList){
    investigatorList.innerHTML = "";
  }
}

function addInvestigatorBlock(){
  if(!investigatorList){
    return;
  }

  investigatorBlockCounter++;
  const blockId = String(investigatorBlockCounter);
  const row = document.createElement("div");
  row.className = "cid-investigator-row";
  row.innerHTML = `
    <input data-investigator-input id="cidAdditionalInvestigator-${blockId}" placeholder="Additional investigator name">
    <button class="back-button small subtle-remove" type="button" data-remove-investigator>Remove</button>
  `;

  row.querySelector("[data-remove-investigator]")?.addEventListener("click", () => {
    row.remove();
  });

  investigatorList.appendChild(row);
  row.querySelector("input")?.focus();
}

function resetEvidenceBlocks(){
  evidenceBlockCounter = 0;

  if(evidenceList){
    evidenceList.innerHTML = "";
  }

  addEvidenceBlock();
}

function addEvidenceBlock(){
  if(!evidenceList){
    return;
  }

  evidenceBlockCounter++;
  const blockId = String(evidenceBlockCounter);
  const block = document.createElement("div");
  block.className = "cid-evidence-block";
  block.dataset.evidenceBlock = blockId;
  block.innerHTML = `
    <div class="cid-evidence-block-top">
      <strong>Evidence ${blockId}</strong>
      <button class="back-button small subtle-remove" type="button" data-remove-evidence>Remove</button>
    </div>

    <div class="form-group">
      <label for="cidEvidenceTitle-${blockId}">Evidence Name/Description</label>
      <input id="cidEvidenceTitle-${blockId}" data-evidence-title placeholder="Screenshot, clip, bodycam review, document, or short description">
    </div>

    <div class="form-group">
      <label for="cidEvidenceType-${blockId}">Evidence Type</label>
      <select id="cidEvidenceType-${blockId}" data-evidence-type>
        <option>Photo</option>
        <option>Video</option>
        <option>Document</option>
        <option>Other</option>
      </select>
    </div>

    <div class="form-group span-2">
      <label for="cidEvidenceUrl-${blockId}">Evidence Link</label>
      <input id="cidEvidenceUrl-${blockId}" data-evidence-url type="url" placeholder="https://">
      <small class="field-error" data-error-for="cidEvidenceUrl-${blockId}"></small>
    </div>
  `;

  block.querySelector("[data-remove-evidence]")?.addEventListener("click", () => {
    block.remove();

    if(!evidenceList.querySelector("[data-evidence-block]")){
      addEvidenceBlock();
    }
  });

  evidenceList.appendChild(block);
}

function validHttpUrl(value){
  const url = String(value || "").trim();

  if(!url){
    return false;
  }

  try{
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol);
  }catch(error){
    return false;
  }
}

function setCaseSubmitting(isSubmitting){
  if(caseSubmitBtn){
    caseSubmitBtn.disabled = isSubmitting;
    caseSubmitBtn.textContent = isSubmitting ? "Creating..." : "Create Case";
  }
}

function showCaseErrors(errors){
  Object.entries(errors).forEach(([field, message]) => {
    const error = document.querySelector(`[data-error-for="${field}"]`);
    const input = document.getElementById(field);

    if(error){
      error.textContent = message;
    }

    input?.classList.add("invalid");
  });
}

function clearCaseErrors(){
  setCaseStatus("");
  document.querySelectorAll(".cid-case-form .field-error").forEach(error => {
    error.textContent = "";
  });
  document.querySelectorAll(".cid-case-form .invalid").forEach(input => {
    input.classList.remove("invalid");
  });
}

function showNarrativeError(field, message){
  const error = document.querySelector(`[data-error-for="${field}"]`);
  const input = document.getElementById(field);

  if(error){
    error.textContent = message;
  }

  input?.classList.add("invalid");
}

function clearNarrativeErrors(){
  setNarrativeStatus("");
  document.querySelectorAll(".cid-narrative-form .field-error").forEach(error => {
    error.textContent = "";
  });
  document.querySelectorAll(".cid-narrative-form .invalid").forEach(input => {
    input.classList.remove("invalid");
  });
}

function setCaseStatus(message){
  if(caseFormStatus){
    caseFormStatus.textContent = message;
  }
}

function setNarrativeStatus(message){
  if(narrativeFormStatus){
    narrativeFormStatus.textContent = message;
  }
}

function setAuthStatus(message, type){
  if(!authStatus){
    return;
  }

  authStatus.textContent = message;
  authStatus.dataset.status = type || "info";
}

function openModal(modal){
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal){
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");

  if(!document.querySelector(".planner-modal.open")){
    document.body.classList.remove("modal-open");
  }
}

function formatDate(value){
  if(!value){
    return "";
  }

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);

  if(Number.isNaN(date.getTime())){
    return "";
  }

  return date.toLocaleDateString("en-US", {
    month:"short",
    day:"numeric",
    year:"numeric"
  });
}

function escapeHTML(value){
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[character]));
}

function escapeAttr(value){
  return escapeHTML(value).replace(/`/g, "&#96;");
}

function emptyStateHTML(title, message, variant = ""){
  const className = variant ? `empty-state ${variant}` : "empty-state";

  return `
    <div class="${className}">
      <strong>${escapeHTML(title)}</strong>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

document.getElementById("cidUpdateForm")?.addEventListener("submit",async event=>{
 event.preventDefault();if(!canManageCases()||!activeCaseId)return;
 const caseFile=cidCases.find(c=>c.id===activeCaseId);if(!caseFile)return;
 const button=event.submitter;button.disabled=true;
 try{const changes={status:document.getElementById("cidUpdateStatus").value,priority:document.getElementById("cidUpdatePriority").value,leadInvestigator:document.getElementById("cidUpdateInvestigator").value};await updateCidCase(activeCaseId,changes,staffAccess);await logPortalAction(staffAccess,{action:changes.status==="Closed"?"CID Case Closed":"CID Case Updated",category:"CID",message:"Updated case assignment or status.",targetUid:activeCaseId,targetLabel:caseFile.subjectName||"CID Case File",suspectNames:(caseFile.subjectIdentifiers||"").match(/^Subject\(s\):\s*(.+)$/m)?.[1]||""});document.getElementById("cidUpdateStatusMessage").textContent="Case updated. Restricted CID notification queued.";}catch{document.getElementById("cidUpdateStatusMessage").textContent="Case update failed. Check CID access and Firebase rules.";}finally{button.disabled=false;}
});
