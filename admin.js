import { confirmPortalAction } from "./portal-confirm.js";
import {
  loadAuthorizedUsers,
  removeAuthorizedUser,
  saveAuthorizedUser
} from "./admin-service.js";

import {
  createPortalLog,
  watchPortalLogs
} from "./portal-log-service.js";

import {
  signInStaff,
  signOutStaff,
  watchStaffAuth
} from "./staff-auth-service.js";

let adminAccess = {
  user:null,
  role:null,
  canEdit:false
};
let unsubscribeLogs = null;
let portalLogs = [];
let activeLogFilter = "All";

const loginForm = document.getElementById("adminLoginForm");
const sessionPanel = document.getElementById("adminSessionPanel");
const consolePanel = document.getElementById("adminConsole");
const authStatus = document.getElementById("adminAuthStatus");
const adminUserEmail = document.getElementById("adminUserEmail");
const roleForm = document.getElementById("roleForm");
const roleFormStatus = document.getElementById("roleFormStatus");
const authorizedUsersList = document.getElementById("authorizedUsersList");
const portalLogList = document.getElementById("portalLogList");
const portalLogFilters = document.getElementById("portalLogFilters");

watchStaffAuth(access => {
  adminAccess = access;
  updateAdminUI();

  if(isAdmin()){
    loadRoles();
    startLogStream();
  }else if(access.user){
    stopLogStream();
    setAuthStatus("This account is signed in but does not have owner access.", "warning");
  }else{
    stopLogStream();
  }
});

loginForm?.addEventListener("submit", handleLogin);
document.getElementById("adminSignOutBtn")?.addEventListener("click", handleSignOut);
roleForm?.addEventListener("submit", handleRoleSave);
document.getElementById("clearRoleFormBtn")?.addEventListener("click", clearRoleForm);
document.getElementById("refreshRolesBtn")?.addEventListener("click", loadRoles);
portalLogFilters?.addEventListener("click", event => {
  const filterButton = event.target.closest("[data-log-filter]");

  if(!filterButton){
    return;
  }

  activeLogFilter = filterButton.dataset.logFilter || "All";
  renderPortalLogs();
});

async function handleLogin(event){
  event.preventDefault();

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  if(!email || !password){
    setAuthStatus("Enter the owner email and password.", "warning");
    return;
  }

  try{
    setAuthStatus("Signing in...", "info");
    await signInStaff(email, password);
    loginForm.reset();
  }catch(error){
    console.error("Admin sign in failed:", error);
    setAuthStatus("Sign in failed. Check the email and password, then try again.", "error");
  }
}

async function handleSignOut(){
  try{
    await signOutStaff();
    setAuthStatus("Signed out.", "info");
  }catch(error){
    console.error("Admin sign out failed:", error);
    setAuthStatus("Could not sign out. Try again.", "error");
  }
}

async function handleRoleSave(event){
  event.preventDefault();
  clearRoleErrors();

  if(!isAdmin()){
    setRoleStatus("Only owner accounts can manage portal access.");
    return;
  }

  const userRole = {
    uid:document.getElementById("roleUid").value.trim(),
    email:document.getElementById("roleEmail").value.trim(),
    displayName:document.getElementById("roleDisplayName").value.trim(),
    calendarEditor:document.getElementById("roleCalendarEditor").checked,
    admin:document.getElementById("roleAdmin").checked,
    officer:document.getElementById("roleOfficer").checked,
    reviewer:document.getElementById("roleReviewer").checked,
    cidEditor:document.getElementById("roleCidEditor").checked
  };

  if(!userRole.uid){
    showRoleError("roleUid", "Portal account ID is required.");
    setRoleStatus("Please enter the portal account ID.");
    return;
  }

  try{
    setRoleStatus("Saving authorized account...");
    await saveAuthorizedUser(userRole);
    await writePortalLog({
      action:"Authorized Account Saved",
      category:"Access",
      message:`Updated portal permissions for ${userRole.displayName || userRole.email || userRole.uid}.`,
      targetUid:userRole.uid,
      targetLabel:userRole.displayName || userRole.email || userRole.uid
    });
    clearRoleForm();
    setRoleStatus("Authorized account saved.");
    await loadRoles();
  }catch(error){
    console.error("Role save failed:", error);
    setRoleStatus("Could not save this account. Check the portal access rules.");
  }
}

async function loadRoles(){
  if(!isAdmin() || !authorizedUsersList){
    return;
  }

  authorizedUsersList.innerHTML = "<p>Loading authorized accounts...</p>";

  try{
    const users = await loadAuthorizedUsers();

    if(!users.length){
      authorizedUsersList.innerHTML = "<p>No authorized accounts have been added yet.</p>";
      return;
    }

    authorizedUsersList.innerHTML = users.map(user => authorizedUserHTML(user)).join("");

    authorizedUsersList.querySelectorAll("[data-edit-role]").forEach(button => {
      button.addEventListener("click", () => editRole(users.find(user => user.uid === button.dataset.editRole)));
    });

    authorizedUsersList.querySelectorAll("[data-delete-role]").forEach(button => {
      button.addEventListener("click", () => deleteRole(button.dataset.deleteRole));
    });
  }catch(error){
    console.error("Load roles failed:", error);
    authorizedUsersList.innerHTML = `
      <p>Authorized accounts could not be loaded.</p>
      <p style="opacity:.65;font-size:14px;">Confirm owner accounts are allowed to view authorized portal users.</p>
    `;
  }
}

function authorizedUserHTML(user){
  const roles = [
    user.calendarEditor ? "Editor" : "",
    user.admin ? "Admin" : ""
  ].filter(Boolean).join(" / ") || "Viewer";
  const hasLabel = Boolean(user.displayName || user.email);
  const displayLabel = user.displayName || user.email || "Unlabeled authorized account";
  const emailLabel = user.email || "Click Edit to add email/name";

  return `
    <div class="authorized-user-card ${hasLabel ? "" : "needs-label"}">
      <div>
        <strong>${escapeHTML(displayLabel)}</strong>
        <span>${escapeHTML(emailLabel)}</span>
        <code>${escapeHTML(user.uid)}</code>
        <small>${escapeHTML(roles)}</small>
      </div>
      <div class="authorized-user-actions">
        <button class="back-button small" data-edit-role="${escapeAttr(user.uid)}" type="button">Edit</button>
        <button class="danger-btn" data-delete-role="${escapeAttr(user.uid)}" type="button">Remove</button>
      </div>
    </div>
  `;
}

function editRole(user){
  if(!user){
    return;
  }

  document.getElementById("roleUid").value = user.uid || "";
  document.getElementById("roleEmail").value = user.email || "";
  document.getElementById("roleDisplayName").value = user.displayName || "";
  document.getElementById("roleCalendarEditor").checked = Boolean(user.calendarEditor);
  document.getElementById("roleAdmin").checked = Boolean(user.admin);
  document.getElementById("roleOfficer").checked = Boolean(user.officer);
  document.getElementById("roleReviewer").checked = Boolean(user.reviewer);
  document.getElementById("roleCidEditor").checked = Boolean(user.cidEditor);
  setRoleStatus("Editing authorized account.");
}

async function deleteRole(uid){
  if(!isAdmin()){
    return;
  }

  if(uid === adminAccess.user?.uid){
    setRoleStatus("You cannot remove your own admin access from this page.");
    return;
  }

  const confirmed = await confirmPortalAction({
    title:"Remove Authorized Account?",
    message:"This will remove this account's elevated portal permissions. Its sign-in account will remain.",
    confirmLabel:"Remove Access"
  });

  if(!confirmed || !isAdmin()){
    return;
  }

  try{
    await removeAuthorizedUser(uid);
    await writePortalLog({
      action:"Authorized Account Removed",
      category:"Access",
      message:"Removed an account from elevated portal access.",
      targetUid:uid,
      targetLabel:uid
    });
    await loadRoles();
  }catch(error){
    console.error("Role delete failed:", error);
    setRoleStatus("Could not remove this account. Check the portal access rules.");
  }
}

function startLogStream(){
  if(unsubscribeLogs || !portalLogList){
    return;
  }

  portalLogList.innerHTML = "<p>Loading portal activity...</p>";
  renderLogFilters();

  unsubscribeLogs = watchPortalLogs(logs => {
    portalLogs = logs;
    renderPortalLogs();
  }, error => {
    console.error("Portal log stream failed:", error);
    portalLogList.innerHTML = `
      <p>Portal activity could not be loaded.</p>
      <p style="opacity:.65;font-size:14px;">Confirm owner accounts are allowed to view portal logs.</p>
    `;
  });
}

function stopLogStream(){
  if(typeof unsubscribeLogs === "function"){
    unsubscribeLogs();
  }

  unsubscribeLogs = null;
  portalLogs = [];
  activeLogFilter = "All";
  renderLogFilters();

  if(portalLogList){
    portalLogList.innerHTML = "<p>Sign in as an owner to view portal activity.</p>";
  }
}

function renderPortalLogs(){
  if(!portalLogList){
    return;
  }

  renderLogFilters();

  if(!portalLogs.length){
    portalLogList.innerHTML = "<p>No portal activity has been recorded yet.</p>";
    return;
  }

  const visibleLogs = activeLogFilter === "All"
    ? portalLogs
    : portalLogs.filter(log => (log.category || "Admin") === activeLogFilter);

  if(!visibleLogs.length){
    portalLogList.innerHTML = `<p>No ${escapeHTML(activeLogFilter)} activity has been recorded yet.</p>`;
    return;
  }

  portalLogList.innerHTML = visibleLogs.map(portalLogHTML).join("");
}

function renderLogFilters(){
  if(!portalLogFilters){
    return;
  }

  if(!portalLogs.length){
    portalLogFilters.innerHTML = "";
    return;
  }

  const categories = ["All", ...Array.from(new Set(
    portalLogs.map(log => log.category || "Admin")
  )).sort((a, b) => a.localeCompare(b))];

  if(activeLogFilter !== "All" && !categories.includes(activeLogFilter)){
    activeLogFilter = "All";
  }

  portalLogFilters.innerHTML = categories.map(category => {
    const count = category === "All"
      ? portalLogs.length
      : portalLogs.filter(log => (log.category || "Admin") === category).length;
    const active = category === activeLogFilter ? " active" : "";

    return `
      <button class="resource-filter-pill${active}" data-log-filter="${escapeAttr(category)}" type="button" aria-pressed="${category === activeLogFilter}">
        <span>${escapeHTML(category)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");
}

function portalLogHTML(log){
  const date = formatLogDate(log.createdAt);
  const actor = log.actorEmail || "Owner account";
  const target = log.targetLabel || log.targetUid || "Portal";

  return `
    <article class="portal-log-entry">
      <div>
        <span class="portal-log-badge">${escapeHTML(log.category || "Admin")}</span>
        <strong>${escapeHTML(log.action || "Portal Action")}</strong>
        <p>${escapeHTML(log.message || "Portal administration action recorded.")}</p>
        <small>${escapeHTML(actor)} &middot; ${escapeHTML(target)}</small>
      </div>
      <time>${escapeHTML(date)}</time>
    </article>
  `;
}

async function writePortalLog(logEntry){
  if(!isAdmin()){
    return;
  }

  try{
    await createPortalLog({
      ...logEntry,
      actorUid:adminAccess.user?.uid || "",
      actorEmail:adminAccess.user?.email || ""
    });
  }catch(error){
    console.error("Portal log write failed:", error);
  }
}

function updateAdminUI(){
  const admin = isAdmin();

  if(loginForm){
    loginForm.hidden = admin;
  }

  if(sessionPanel){
    sessionPanel.hidden = !admin;
  }

  if(consolePanel){
    consolePanel.hidden = !admin;
  }

  if(adminUserEmail){
    adminUserEmail.textContent = adminAccess.user?.email || "Admin User";
  }
}

function isAdmin(){
  return Boolean(adminAccess.role?.admin);
}

function clearRoleForm(){
  roleForm?.reset();
  clearRoleErrors();
}

function showRoleError(field, message){
  const error = document.querySelector(`[data-error-for="${field}"]`);
  const input = document.getElementById(field);

  if(error){
    error.textContent = message;
  }

  input?.classList.add("invalid");
}

function clearRoleErrors(){
  setRoleStatus("");
  document.querySelectorAll(".admin-role-form .field-error").forEach(error => {
    error.textContent = "";
  });
  document.querySelectorAll(".admin-role-form .invalid").forEach(input => {
    input.classList.remove("invalid");
  });
}

function setAuthStatus(message, type){
  if(!authStatus){
    return;
  }

  authStatus.textContent = message;
  authStatus.dataset.status = type || "info";
}

function setRoleStatus(message){
  if(roleFormStatus){
    roleFormStatus.textContent = message;
  }
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

function formatLogDate(value){
  const date = firestoreDate(value);

  if(!date){
    return "Pending";
  }

  return date.toLocaleString("en-US", {
    month:"short",
    day:"numeric",
    year:"numeric",
    hour:"numeric",
    minute:"2-digit"
  });
}

function firestoreDate(value){
  if(!value){
    return null;
  }

  if(typeof value.toDate === "function"){
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
