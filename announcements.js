import { confirmPortalAction } from "./portal-confirm.js";
import {
  createAnnouncement,
  subscribeToAnnouncementDrafts,
  deleteAnnouncement,
  subscribeToAnnouncements
} from "./announcements-service.js";

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
let currentAnnouncements = [];
let stopDrafts = null;
let currentDrafts = [];

const announcementList = document.getElementById("all-announcements-list");
const editorCard = document.getElementById("announcementEditorCard");
const announcementForm = document.getElementById("announcementForm");
const formStatus = document.getElementById("announcementFormStatus");
const loginForm = document.getElementById("announcementLoginForm");
const sessionPanel = document.getElementById("announcementSessionPanel");
const accessSummary = document.getElementById("announcementAccessSummary");
const authStatus = document.getElementById("announcementAuthStatus");
const userEmail = document.getElementById("announcementUserEmail");
const roleLabel = document.getElementById("announcementRoleLabel");

if(announcementList){
  announcementList.innerHTML = emptyStateHTML("Loading announcements", "Checking the shared department announcement feed.", "is-loading");

  subscribeToAnnouncements(
    announcements => {
      currentAnnouncements = announcements;
      renderAnnouncements(announcements);
    },
    error => {
      console.error("Announcement sync failed:", error);
      announcementList.innerHTML = emptyStateHTML(
        "Announcements unavailable",
        "The shared announcement feed could not be reached. Check the connection and try again.",
        "error"
      );
    }
  );
}

watchStaffAuth(access => {
  staffAccess = access;
  updateAccessUI();
  if(stopDrafts)stopDrafts();stopDrafts=null;
  const draftPanel=document.getElementById("announcementDraftPanel");draftPanel.hidden=!access.role?.admin;
  if(access.role?.admin)stopDrafts=subscribeToAnnouncementDrafts(rows=>{currentDrafts=rows;const list=document.getElementById("announcementDraftList");list.replaceChildren();for(const record of rows){const b=document.createElement("button");b.className="back-button";b.type="button";b.textContent=record.title+" • "+record.publishState;b.onclick=()=>editAnnouncement(record,true);list.append(b);}},()=>setFormStatus("Drafts unavailable. Publish the new Firestore rules."));

  if(access.user && !access.canEdit){
    setAuthStatus("This account does not have announcement editor access.", "warning");
  }
});

announcementForm?.addEventListener("submit", handleAnnouncementSubmit);
loginForm?.addEventListener("submit", handleLogin);
document.getElementById("announcementSignOutBtn")?.addEventListener("click", handleSignOut);

function renderAnnouncements(announcements){
  if(!announcementList){
    return;
  }

  if(!announcements.length){
    announcementList.innerHTML = emptyStateHTML(
      "No active announcements",
      "Approved staff announcements will appear here and on the dashboard as soon as they are posted."
    );
    return;
  }

  announcementList.innerHTML = announcements.map(announcement => announcementHTML(announcement)).join("");

  announcementList.querySelectorAll("[data-delete-announcement]").forEach(button => {
    button.addEventListener("click", () => handleDeleteAnnouncement(button.dataset.deleteAnnouncement));
  });

  announcementList.querySelectorAll("[data-edit-announcement]").forEach(button=>button.addEventListener("click",()=>editAnnouncement(currentAnnouncements.find(r=>r.id===button.dataset.editAnnouncement),false)));
  updateAccessUI();
}

function announcementHTML(announcement){
  return `
    <div class="announcement full-announcement announcement-managed">
      <div>
        <h4>${escapeHTML(announcement.title || "Untitled Announcement")}</h4>
        <p>${escapeHTML(announcement.message || "")}</p>
        <span>${announcementMeta(announcement)}</span>
      </div>
      <button class="back-button announcement-delete" data-edit-announcement="${escapeAttr(announcement.id)}" type="button" hidden>Edit</button>
      <button class="danger-btn announcement-delete" data-delete-announcement="${escapeAttr(announcement.id)}" type="button" hidden>Delete</button>
    </div>
  `;
}

function announcementMeta(announcement){
  const parts = [];

  if(announcement.category){
    parts.push(announcement.category);
  }

  if(announcement.priority && announcement.priority !== "Normal"){
    parts.push(announcement.priority);
  }

  if(announcement.author){
    parts.push(`Posted by ${announcement.author}`);
  }

  const date = formatFirestoreDate(announcement.createdAt);

  if(date){
    parts.push(date);
  }

  return escapeHTML(parts.join(" • "));
}

let announcementSaving=false;
async function handleAnnouncementSubmit(event){
  event.preventDefault();
  if(announcementSaving)return;
  clearFormErrors();

  if(!userCanManageAnnouncements()){
    setFormStatus("You must be signed in as an owner to publish announcements.");
    return;
  }

  const announcement = {
    title:document.getElementById("announcementTitle").value.trim(),
    category:document.getElementById("announcementCategory").value,
    priority:document.getElementById("announcementPriority").value,
    author:document.getElementById("announcementAuthor").value.trim(),
    message:document.getElementById("announcementMessage").value.trim(),
    id:document.getElementById("announcementEditingId").value,
    wasDraft:document.getElementById("announcementEditingDraft").value === "true",
    format:document.getElementById("announcementFormat").value,
    pingApd:document.getElementById("announcementPingApd").checked,
    publishState:document.getElementById("announcementPublishState").value,
    scheduledFor:document.getElementById("announcementSchedule").value ? new Date(document.getElementById("announcementSchedule").value).toISOString() : "",
    roleIds:document.getElementById("announcementRoleIds").value.split(",").map(s=>s.trim()).filter(Boolean)
  };

  if(announcement.publishState === "scheduled" && (!announcement.scheduledFor || Date.parse(announcement.scheduledFor)<=Date.now())){setFormStatus("Choose a future scheduled time.");return;}
  const errors = validateAnnouncement(announcement);

  if(Object.keys(errors).length){
    showFormErrors(errors);
    setFormStatus("Please fix the highlighted fields before publishing.");
    return;
  }

  announcementSaving=true;
  const submit=announcementForm.querySelector("button[type=submit],button:not([type])");if(submit)submit.disabled=true;
  try{
    setFormStatus("Publishing announcement...");
    const createdAnnouncement = await createAnnouncement(announcement);
    announcementForm.reset();
    setFormStatus(createdAnnouncement.draft ? "Draft saved. Scheduled drafts are published by the serverless scheduler when due." : "Announcement saved. Discord delivery is queued; owners can check delivery status in Admin Console.");
  }catch(error){
    console.error("Announcement publish failed:", error);
    setFormStatus("Announcement could not be published. Check portal access and try again.");
  }finally{announcementSaving=false;if(submit)submit.disabled=false;}
}

async function handleDeleteAnnouncement(announcementId){
  if(!userCanManageAnnouncements()){
    setAuthStatus("Only owners can remove announcements.", "warning");
    return;
  }

  const selectedAnnouncement = currentAnnouncements.find(item => item.id === announcementId);
  const confirmed = await confirmPortalAction({
    title:"Delete Announcement?",
    message:'This will permanently remove "' + (selectedAnnouncement?.title || "this announcement") + '". This cannot be undone.',
    confirmLabel:"Delete Announcement"
  });

  if(!confirmed || !userCanManageAnnouncements()){
    return;
  }

  try{
    const announcement = currentAnnouncements.find(item => item.id === announcementId);
    await deleteAnnouncement(announcementId,announcement||{});

  }catch(error){
    console.error("Announcement delete failed:", error);
    setAuthStatus("Announcement could not be deleted. Check portal access and try again.", "error");
  }
}

async function handleLogin(event){
  event.preventDefault();

  const email = document.getElementById("announcementEmail").value.trim();
  const password = document.getElementById("announcementPassword").value;

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
    console.error("Announcement sign in failed:", error);
    setAuthStatus("Sign in failed. Check the email and password, then try again.", "error");
  }
}

async function handleSignOut(){
  try{
    await signOutStaff();
    setAuthStatus("Signed out.", "info");
  }catch(error){
    console.error("Announcement sign out failed:", error);
    setAuthStatus("Could not sign out. Try again.", "error");
  }
}

function updateAccessUI(){
  const canEdit = userCanManageAnnouncements();

  if(editorCard){
    editorCard.hidden = !canEdit;
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
    roleLabel.textContent = staffAccess.role?.admin ? "Admin announcement access" : "Announcement editor access";
  }

  if(accessSummary){
    accessSummary.textContent = canEdit
      ? "You can publish and remove shared portal announcements."
      : "Sign in with an approved staff account to add or remove announcements.";
  }

  document.querySelectorAll("[data-delete-announcement], [data-edit-announcement]").forEach(button => {
    button.hidden = !canEdit;
  });
}

function userCanManageAnnouncements(){
  return Boolean(staffAccess.role?.admin);
}

function validateAnnouncement(announcement){
  const errors = {};

  if(!announcement.title){
    errors.announcementTitle = "Announcement title is required.";
  }

  if(!announcement.message){
    errors.announcementMessage = "Announcement text is required.";
  }

  return errors;
}

function showFormErrors(errors){
  Object.entries(errors).forEach(([field, message]) => {
    const error = document.querySelector(`[data-error-for="${field}"]`);
    const input = document.getElementById(field);

    if(error){
      error.textContent = message;
    }

    input?.classList.add("invalid");
  });
}

function clearFormErrors(){
  setFormStatus("");
  document.querySelectorAll(".announcement-form .field-error").forEach(error => {
    error.textContent = "";
  });
  document.querySelectorAll(".announcement-form .invalid").forEach(input => {
    input.classList.remove("invalid");
  });
}

function setFormStatus(message){
  if(formStatus){
    formStatus.textContent = message;
  }
}

function setAuthStatus(message, type){
  if(!authStatus){
    return;
  }

  authStatus.textContent = message;
  authStatus.dataset.status = type || "info";
}

function formatFirestoreDate(value){
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

function editAnnouncement(record,draft){
 if(!record||!staffAccess.role?.admin)return;
 document.getElementById("announcementEditingId").value=record.id;
 document.getElementById("announcementEditingDraft").value=String(draft);
 for(const [id,key] of [["announcementTitle","title"],["announcementMessage","message"],["announcementCategory","category"],["announcementPriority","priority"],["announcementAuthor","author"],["announcementFormat","format"],["announcementPublishState","publishState"]])document.getElementById(id).value=record[key]||({format:"plain",publishState:"published"}[key]||"");
 document.getElementById("announcementPingApd").checked=record.pingApd!==false;
 document.getElementById("announcementRoleIds").value=(record.roleIds||[]).join(", ");
 if(record.scheduledFor){const date=new Date(record.scheduledFor);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());document.getElementById("announcementSchedule").value=date.toISOString().slice(0,16);}
 editorCard.scrollIntoView({behavior:"smooth"});
}
document.getElementById("announcementPreviewBtn")?.addEventListener("click",()=>{const preview=document.getElementById("announcementPreview");preview.hidden=false;preview.textContent=(document.getElementById("announcementPingApd").checked?"@APD\n\n":"")+document.getElementById("announcementTitle").value+"\n\n"+document.getElementById("announcementMessage").value;});
document.getElementById("announcementCancelEditBtn")?.addEventListener("click",()=>{announcementForm.reset();document.getElementById("announcementEditingId").value="";document.getElementById("announcementEditingDraft").value="";document.getElementById("announcementPreview").hidden=true;});
