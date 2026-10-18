import {
  createResourcePost,
  deleteResourcePost,
  subscribeToResourcePosts
} from "./resource-posts-service.js";

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

let resourcePosts = [];
let activeResourceFilter = "All";
let activeResourceSearch = "";
let pendingDeletePostId = "";

const postsList = document.getElementById("resourcePostsList");
const tagFilters = document.getElementById("resourceTagFilters");
const searchInput = document.getElementById("resourcePostSearch");
const postCount = document.getElementById("resourcePostCount");
const activeFilterLabel = document.getElementById("resourceActiveFilter");
const createPostBtn = document.getElementById("createResourcePostBtn");
const postModal = document.getElementById("resourcePostModal");
const postForm = document.getElementById("resourcePostForm");
const postFormStatus = document.getElementById("resourcePostFormStatus");
const detailsModal = document.getElementById("resourcePostDetailsModal");
const detailsTitle = document.getElementById("resourcePostDetailsTitle");
const detailsCategory = document.getElementById("resourcePostDetailsCategory");
const detailsContent = document.getElementById("resourcePostDetailsContent");
const deleteConfirmModal = document.getElementById("resourceDeleteConfirmModal");
const deletePostTitle = document.getElementById("resourceDeletePostTitle");
const confirmDeleteBtn = document.getElementById("confirmResourceDeleteBtn");
const loginForm = document.getElementById("resourceLoginForm");
const sessionPanel = document.getElementById("resourceSessionPanel");
const accessSummary = document.getElementById("resourceAccessSummary");
const authStatus = document.getElementById("resourceAuthStatus");
const userEmail = document.getElementById("resourceUserEmail");
const roleLabel = document.getElementById("resourceRoleLabel");

if(postsList){
  subscribeToResourcePosts(
    posts => {
      resourcePosts = posts;
      renderResourcePosts();
    },
    error => {
      console.error("Resource board sync failed:", error);
      postsList.innerHTML = emptyStateHTML(
        "Officer Resources unavailable",
        "Officer Resources could not be reached. Check the connection and try again.",
        "error"
      );
    }
  );
}

watchStaffAuth(access => {
  staffAccess = access;
  updateAccessUI();

  if(access.user && !access.canEdit){
    setAuthStatus("This account does not have Officer Resources editor access.", "warning");
  }
});

createPostBtn?.addEventListener("click", openPostModal);
postForm?.addEventListener("submit", handlePostSubmit);
loginForm?.addEventListener("submit", handleLogin);
document.getElementById("resourceSignOutBtn")?.addEventListener("click", handleSignOut);
document.getElementById("cancelResourceDeleteBtn")?.addEventListener("click", closeDeleteConfirmModal);
confirmDeleteBtn?.addEventListener("click", confirmDeletePost);

tagFilters?.addEventListener("click", event => {
  const filterButton = event.target.closest("[data-resource-filter]");

  if(!filterButton){
    return;
  }

  activeResourceFilter = filterButton.dataset.resourceFilter || "All";
  renderResourcePosts();
});

searchInput?.addEventListener("input", event => {
  activeResourceSearch = event.target.value.trim().toLowerCase();
  renderResourcePosts();
});

document.querySelectorAll("[data-close-resource-modal]").forEach(button => {
  button.addEventListener("click", closePostModal);
});

document.querySelectorAll("[data-close-resource-details]").forEach(button => {
  button.addEventListener("click", closeDetailsModal);
});

postModal?.addEventListener("click", event => {
  if(event.target === postModal){
    closePostModal();
  }
});

detailsModal?.addEventListener("click", event => {
  if(event.target === detailsModal){
    closeDetailsModal();
  }
});

deleteConfirmModal?.addEventListener("click", event => {
  if(event.target === deleteConfirmModal){
    closeDeleteConfirmModal();
  }
});

document.addEventListener("keydown", event => {
  if(event.key !== "Escape"){
    return;
  }

  if(postModal?.classList.contains("open")){
    closePostModal();
  }

  if(detailsModal?.classList.contains("open")){
    closeDetailsModal();
  }

  if(deleteConfirmModal?.classList.contains("open")){
    closeDeleteConfirmModal();
  }
});

function renderResourcePosts(){
  if(!postsList){
    return;
  }

  renderResourceFilters();
  renderBoardStatus(resourcePosts);

  if(!resourcePosts.length){
    postsList.innerHTML = emptyStateHTML(
      "No Officer Resources posts yet",
      "Authorized staff posts will appear here as documents, how-to guides, and department references are published."
    );
    updateAccessUI();
    return;
  }

  const visiblePosts = filteredPosts();

  if(!visiblePosts.length){
    const emptyTitle = activeResourceSearch
      ? "No matching Officer Resources posts"
      : `No ${activeResourceFilter} posts`;
    const emptyMessage = activeResourceSearch
      ? "Adjust the search text or choose another tag to broaden the results."
      : "Select another tag or choose All to view Officer Resources.";

    postsList.innerHTML = emptyStateHTML(
      emptyTitle,
      emptyMessage
    );
    updateAccessUI();
    return;
  }

  postsList.innerHTML = visiblePosts.map(post => resourcePostHTML(post)).join("");

  postsList.querySelectorAll("[data-view-resource-post]").forEach(button => {
    button.addEventListener("click", () => openDetailsModal(button.dataset.viewResourcePost));
  });

  postsList.querySelectorAll("[data-delete-resource-post]").forEach(button => {
    button.addEventListener("click", () => handleDeletePost(button.dataset.deleteResourcePost));
  });

  updateAccessUI();
}

function filteredPosts(){
  return resourcePosts.filter(post => {
    const matchesFilter = activeResourceFilter === "All"
      || (post.category || "General") === activeResourceFilter;

    if(!matchesFilter){
      return false;
    }

    if(!activeResourceSearch){
      return true;
    }

    return [
      post.title,
      post.category,
      post.summary,
      post.content,
      post.author
    ].some(value => String(value || "").toLowerCase().includes(activeResourceSearch));
  });
}

function renderBoardStatus(posts){
  if(postCount){
    postCount.textContent = String(posts.length);
  }

  if(activeFilterLabel){
    activeFilterLabel.textContent = activeResourceSearch
      ? `${activeResourceFilter} + Search`
      : activeResourceFilter;
  }
}

function renderResourceFilters(){
  if(!tagFilters){
    return;
  }

  const categories = ["All", ...Array.from(new Set(
    resourcePosts.map(post => post.category || "General")
  )).sort((a, b) => a.localeCompare(b))];

  if(activeResourceFilter !== "All" && !categories.includes(activeResourceFilter)){
    activeResourceFilter = "All";
  }

  tagFilters.innerHTML = categories.map(category => {
    const count = category === "All"
      ? resourcePosts.length
      : resourcePosts.filter(post => (post.category || "General") === category).length;
    const active = category === activeResourceFilter ? " active" : "";

    return `
      <button class="resource-filter-pill${active}" data-resource-filter="${escapeAttr(category)}" type="button" aria-pressed="${category === activeResourceFilter}">
        <span>${escapeHTML(category)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");
}

function resourcePostHTML(post){
  const summary = post.summary || previewText(post.content);
  const date = formatDate(post.createdAt);
  const meta = [post.author ? `Posted by ${post.author}` : "", date].filter(Boolean).join(" - ");
  const hasLink = Boolean(normalizeUrl(post.resourceUrl));

  return `
    <article class="resource-post-card">
      <div class="resource-post-main">
        <div class="resource-post-card-top">
          <span class="resource-post-category">${escapeHTML(post.category || "General")}</span>
          ${hasLink ? `<span class="resource-link-indicator">Linked Resource</span>` : ""}
        </div>
        <h3>${escapeHTML(post.title || "Untitled Resource")}</h3>
        <p>${escapeHTML(summary)}</p>
        <small>${escapeHTML(meta)}</small>
      </div>
      <div class="resource-post-actions">
        <button class="back-button small" data-view-resource-post="${escapeAttr(post.id)}" type="button">View Post</button>
        <button class="danger-btn" data-delete-resource-post="${escapeAttr(post.id)}" type="button" hidden>Remove</button>
      </div>
    </article>
  `;
}

async function handlePostSubmit(event){
  event.preventDefault();
  clearFormErrors();

  if(!userCanManagePosts()){
    setFormStatus("You must be signed in as an approved editor to publish Officer Resources posts.");
    return;
  }

  const post = {
    title:document.getElementById("resourcePostTitle").value.trim(),
    category:document.getElementById("resourcePostCategory").value,
    author:document.getElementById("resourcePostAuthor").value.trim(),
    summary:document.getElementById("resourcePostSummary").value.trim(),
    content:document.getElementById("resourcePostContent").value.trim(),
    resourceUrl:document.getElementById("resourcePostLink").value.trim()
  };

  const errors = validatePost(post);

  if(Object.keys(errors).length){
    showFormErrors(errors);
    setFormStatus("Please fix the highlighted fields before publishing.");
    return;
  }

  try{
    setFormStatus("Publishing post...");
    const createdPost = await createResourcePost(post);
    await logPortalAction(staffAccess, {
      action:"Officer Resource Published",
      category:"Resources",
      message:`Published Officer Resources post: ${post.title}.`,
      targetUid:createdPost.id || "",
      targetLabel:post.title,
      postAuthor:post.author,
      postCategory:post.category,
      postDetails:post.summary,
      postNarrative:post.content,
      resourceUrl:normalizeUrl(post.resourceUrl)
    });
    postForm.reset();
    closePostModal();
    setAuthStatus("Officer Resources post published.", "success");
  }catch(error){
    console.error("Officer Resources post publish failed:", error);
    setFormStatus("Officer Resources post could not be published. Check portal access and try again.");
  }
}

async function handleDeletePost(postId){
  if(!userCanManagePosts()){
    setAuthStatus("Only approved editors can remove Officer Resources posts.", "warning");
    return;
  }

  openDeleteConfirmModal(postId);
}

async function confirmDeletePost(){
  if(!pendingDeletePostId){
    return;
  }

  const postId = pendingDeletePostId;
  const post = resourcePosts.find(resourcePost => resourcePost.id === postId);

  try{
    if(confirmDeleteBtn){
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = "Removing...";
    }

    await deleteResourcePost(postId);
    await logPortalAction(staffAccess, {
      action:"Officer Resource Removed",
      category:"Resources",
      message:`Removed Officer Resources post: ${post?.title || postId}.`,
      targetUid:postId,
      targetLabel:post?.title || postId,
      postAuthor:post?.author || "",
      postCategory:post?.category || "",
      postDetails:post?.summary || "",
      postNarrative:post?.content || "",
      resourceUrl:normalizeUrl(post?.resourceUrl || "")
    });
    closeDeleteConfirmModal();
    setAuthStatus("Officer Resources post removed.", "success");
  }catch(error){
    console.error("Officer Resources post delete failed:", error);
    setAuthStatus("Officer Resources post could not be removed. Check portal access and try again.", "error");
  }finally{
    if(confirmDeleteBtn){
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Remove Post";
    }
  }
}

async function handleLogin(event){
  event.preventDefault();

  const email = document.getElementById("resourceEmail").value.trim();
  const password = document.getElementById("resourcePassword").value;

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
    console.error("Officer Resources sign in failed:", error);
    setAuthStatus("Sign in failed. Check the email and password, then try again.", "error");
  }
}

async function handleSignOut(){
  try{
    await signOutStaff();
    setAuthStatus("Signed out.", "info");
  }catch(error){
    console.error("Officer Resources sign out failed:", error);
    setAuthStatus("Could not sign out. Try again.", "error");
  }
}

function openPostModal(){
  if(!userCanManagePosts()){
    setAuthStatus("Sign in with an approved editor account before creating posts.", "warning");
    return;
  }

  clearFormErrors();
  postForm?.reset();
  postModal?.classList.add("open");
  postModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  document.getElementById("resourcePostTitle")?.focus();
}

function closePostModal(){
  postModal?.classList.remove("open");
  postModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openDetailsModal(postId){
  const post = resourcePosts.find(resourcePost => resourcePost.id === postId);

  if(!post || !detailsModal || !detailsTitle || !detailsContent){
    return;
  }

  detailsTitle.textContent = post.title || "Officer Resources Post";

  if(detailsCategory){
    detailsCategory.textContent = post.category || "Officer Resources";
  }

  const date = formatDate(post.createdAt);
  const meta = [post.author ? `Posted by ${post.author}` : "", date].filter(Boolean).join(" - ");
  const link = normalizeUrl(post.resourceUrl);

  detailsContent.innerHTML = `
    ${meta ? `<p class="resource-post-meta">${escapeHTML(meta)}</p>` : ""}
    ${post.summary ? `<p class="resource-post-summary">${escapeHTML(post.summary)}</p>` : ""}
    <div class="resource-post-body">${formatBody(post.content)}</div>
    ${link ? `<a class="submit-btn resource-link-button" href="${escapeAttr(link)}" target="_blank" rel="noopener">Open Resource Link</a>` : ""}
  `;

  detailsModal.classList.add("open");
  detailsModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeDetailsModal(){
  detailsModal?.classList.remove("open");
  detailsModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openDeleteConfirmModal(postId){
  const post = resourcePosts.find(resourcePost => resourcePost.id === postId);

  pendingDeletePostId = postId;

  if(deletePostTitle){
    deletePostTitle.textContent = post?.title ? `"${post.title}"` : "Selected Officer Resources post";
  }

  deleteConfirmModal?.classList.add("open");
  deleteConfirmModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  confirmDeleteBtn?.focus();
}

function closeDeleteConfirmModal(){
  pendingDeletePostId = "";
  deleteConfirmModal?.classList.remove("open");
  deleteConfirmModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function updateAccessUI(){
  const canEdit = userCanManagePosts();

  if(createPostBtn){
    createPostBtn.hidden = !canEdit;
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
    roleLabel.textContent = staffAccess.role?.admin ? "Admin Officer Resources access" : "Officer Resources editor access";
  }

  if(accessSummary){
    accessSummary.textContent = canEdit
      ? "You can publish and remove Officer Resources posts."
      : "Sign in with an approved staff account to create or remove Officer Resources posts.";
  }

  document.querySelectorAll("[data-delete-resource-post]").forEach(button => {
    button.hidden = !canEdit;
  });
}

function userCanManagePosts(){
  return Boolean(staffAccess.canEdit);
}

function validatePost(post){
  const errors = {};

  if(!post.title){
    errors.resourcePostTitle = "Post title is required.";
  }

  if(!post.content){
    errors.resourcePostContent = "Post details are required.";
  }

  if(post.resourceUrl && !normalizeUrl(post.resourceUrl)){
    errors.resourcePostLink = "Enter a valid web link.";
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
  document.querySelectorAll(".resource-post-form .field-error").forEach(error => {
    error.textContent = "";
  });
  document.querySelectorAll(".resource-post-form .invalid").forEach(input => {
    input.classList.remove("invalid");
  });
}

function setFormStatus(message){
  if(postFormStatus){
    postFormStatus.textContent = message;
  }
}

function setAuthStatus(message, type){
  if(!authStatus){
    return;
  }

  authStatus.textContent = message;
  authStatus.dataset.status = type || "info";
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

function formatBody(value){
  const paragraphs = String(value || "")
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  if(!paragraphs.length){
    return "<p>No details provided.</p>";
  }

  return paragraphs.map(paragraph => `<p>${escapeHTML(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

function previewText(value){
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if(text.length <= 160){
    return text;
  }

  return `${text.slice(0, 157)}...`;
}

function normalizeUrl(value){
  const url = String(value || "").trim();

  if(!url){
    return "";
  }

  try{
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl.href : "";
  }catch(error){
    return "";
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

function emptyStateHTML(title, message, variant = ""){
  const className = variant ? `empty-state ${variant}` : "empty-state";

  return `
    <div class="${className}">
      <strong>${escapeHTML(title)}</strong>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}
