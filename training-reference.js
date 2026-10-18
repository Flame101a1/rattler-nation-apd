import {
  createTrainingReference,
  deleteTrainingReference,
  subscribeToTrainingReferences
} from "./training-reference-service.js";

import { logPortalAction } from "./portal-log-service.js";

import { watchStaffAuth } from "./staff-auth-service.js";

let staffAccess = {
  user:null,
  role:null,
  canEdit:false
};

let trainingReferences = [];
let activeFilter = "All";
let activeSearch = "";
let pendingDeletePostId = "";

const list = document.getElementById("trainingReferenceList");
const filters = document.getElementById("trainingReferenceFilters");
const searchInput = document.getElementById("trainingReferenceSearch");
const postCount = document.getElementById("trainingReferenceCount");
const activeFilterLabel = document.getElementById("trainingReferenceActiveFilter");
const createBtn = document.getElementById("createTrainingReferenceBtn");
const modal = document.getElementById("trainingReferenceModal");
const form = document.getElementById("trainingReferenceForm");
const formStatus = document.getElementById("trainingReferenceFormStatus");
const detailsModal = document.getElementById("trainingReferenceDetailsModal");
const detailsTitle = document.getElementById("trainingReferenceDetailsTitle");
const detailsCategory = document.getElementById("trainingReferenceDetailsCategory");
const detailsContent = document.getElementById("trainingReferenceDetailsContent");
const deleteModal = document.getElementById("trainingReferenceDeleteModal");
const deletePostTitle = document.getElementById("trainingReferenceDeletePostTitle");
const confirmDeleteBtn = document.getElementById("confirmTrainingReferenceDeleteBtn");
const staffStatus = document.getElementById("staffAuthStatus");

if(list){
  subscribeToTrainingReferences(
    posts => {
      trainingReferences = posts;
      renderTrainingReferences();
    },
    error => {
      console.error("Training reference sync failed:", error);
      list.innerHTML = emptyStateHTML(
        "Training references unavailable",
        "The Training Reference Library could not be reached. Check the connection and try again.",
        "error"
      );
    }
  );
}

watchStaffAuth(access => {
  staffAccess = access;
  updateTrainingReferenceAccessUI();
});

createBtn?.addEventListener("click", openCreateModal);
form?.addEventListener("submit", handleSubmit);
document.getElementById("cancelTrainingReferenceDeleteBtn")?.addEventListener("click", closeDeleteModal);
confirmDeleteBtn?.addEventListener("click", confirmDeletePost);

filters?.addEventListener("click", event => {
  const filterButton = event.target.closest("[data-training-reference-filter]");

  if(!filterButton){
    return;
  }

  activeFilter = filterButton.dataset.trainingReferenceFilter || "All";
  renderTrainingReferences();
});

searchInput?.addEventListener("input", event => {
  activeSearch = event.target.value.trim().toLowerCase();
  renderTrainingReferences();
});

document.querySelectorAll("[data-close-training-reference-modal]").forEach(button => {
  button.addEventListener("click", closeCreateModal);
});

document.querySelectorAll("[data-close-training-reference-details]").forEach(button => {
  button.addEventListener("click", closeDetailsModal);
});

[modal, detailsModal, deleteModal].forEach(dialog => {
  dialog?.addEventListener("click", event => {
    if(event.target === dialog){
      if(dialog === modal){
        closeCreateModal();
      }else if(dialog === detailsModal){
        closeDetailsModal();
      }else{
        closeDeleteModal();
      }
    }
  });
});

document.addEventListener("keydown", event => {
  if(event.key !== "Escape"){
    return;
  }

  if(modal?.classList.contains("open")){
    closeCreateModal();
  }

  if(detailsModal?.classList.contains("open")){
    closeDetailsModal();
  }

  if(deleteModal?.classList.contains("open")){
    closeDeleteModal();
  }
});

function renderTrainingReferences(){
  if(!list){
    return;
  }

  renderFilters();
  renderStatus();

  if(!trainingReferences.length){
    list.innerHTML = emptyStateHTML(
      "No training references yet",
      "Authorized training staff posts will appear here as preparation notes, documents, and training guidance are published."
    );
    updateTrainingReferenceAccessUI();
    return;
  }

  const visiblePosts = filteredPosts();

  if(!visiblePosts.length){
    list.innerHTML = emptyStateHTML(
      activeSearch ? "No matching training references" : `No ${activeFilter} posts`,
      activeSearch ? "Adjust the search text or choose another tag to broaden the results." : "Select another tag or choose All to view the full Training Reference Library."
    );
    updateTrainingReferenceAccessUI();
    return;
  }

  list.innerHTML = visiblePosts.map(post => postHTML(post)).join("");

  list.querySelectorAll("[data-view-training-reference]").forEach(button => {
    button.addEventListener("click", () => openDetailsModal(button.dataset.viewTrainingReference));
  });

  list.querySelectorAll("[data-delete-training-reference]").forEach(button => {
    button.addEventListener("click", () => requestDelete(button.dataset.deleteTrainingReference));
  });

  updateTrainingReferenceAccessUI();
}

function filteredPosts(){
  return trainingReferences.filter(post => {
    const matchesFilter = activeFilter === "All" || (post.category || "General") === activeFilter;

    if(!matchesFilter){
      return false;
    }

    if(!activeSearch){
      return true;
    }

    return [
      post.title,
      post.category,
      post.summary,
      post.content,
      post.author
    ].some(value => String(value || "").toLowerCase().includes(activeSearch));
  });
}

function renderStatus(){
  if(postCount){
    postCount.textContent = String(trainingReferences.length);
  }

  if(activeFilterLabel){
    activeFilterLabel.textContent = activeSearch ? `${activeFilter} + Search` : activeFilter;
  }
}

function renderFilters(){
  if(!filters){
    return;
  }

  const categories = ["All", ...Array.from(new Set(
    trainingReferences.map(post => post.category || "General")
  )).sort((a, b) => a.localeCompare(b))];

  if(activeFilter !== "All" && !categories.includes(activeFilter)){
    activeFilter = "All";
  }

  filters.innerHTML = categories.map(category => {
    const count = category === "All"
      ? trainingReferences.length
      : trainingReferences.filter(post => (post.category || "General") === category).length;
    const active = category === activeFilter ? " active" : "";

    return `
      <button class="resource-filter-pill${active}" data-training-reference-filter="${escapeAttr(category)}" type="button" aria-pressed="${category === activeFilter}">
        <span>${escapeHTML(category)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");
}

function postHTML(post){
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
        <h3>${escapeHTML(post.title || "Untitled Training Reference")}</h3>
        <p>${escapeHTML(summary)}</p>
        <small>${escapeHTML(meta)}</small>
      </div>
      <div class="resource-post-actions">
        <button class="back-button small" data-view-training-reference="${escapeAttr(post.id)}" type="button">View Post</button>
        <button class="danger-btn" data-delete-training-reference="${escapeAttr(post.id)}" type="button" hidden>Remove</button>
      </div>
    </article>
  `;
}

async function handleSubmit(event){
  event.preventDefault();
  clearFormErrors();

  if(!canManageTrainingReferences()){
    setTrainingReferenceStatus("Sign in with an approved editor account to publish training references.", "warning");
    return;
  }

  const post = {
    title:document.getElementById("trainingReferenceTitle").value.trim(),
    category:document.getElementById("trainingReferenceCategory").value,
    author:document.getElementById("trainingReferenceAuthor").value.trim(),
    summary:document.getElementById("trainingReferenceSummary").value.trim(),
    content:document.getElementById("trainingReferenceContent").value.trim(),
    resourceUrl:document.getElementById("trainingReferenceLink").value.trim()
  };

  const errors = validatePost(post);

  if(Object.keys(errors).length){
    showFormErrors(errors);
    setFormStatus("Please fix the highlighted fields before publishing.");
    return;
  }

  try{
    setFormStatus("Publishing post...");
    const createdPost = await createTrainingReference(post);
    await logPortalAction(staffAccess, {
      action:"Training Reference Published",
      category:"Training",
      message:`Published training reference: ${post.title}.`,
      targetUid:createdPost.id || "",
      targetLabel:post.title,
      postAuthor:post.author,
      postCategory:post.category,
      postDetails:post.summary,
      postNarrative:post.content,
      resourceUrl:normalizeUrl(post.resourceUrl)
    });
    form.reset();
    closeCreateModal();
    setTrainingReferenceStatus("Training reference published.", "success");
  }catch(error){
    console.error("Training reference publish failed:", error);
    setFormStatus("Training reference could not be published. Check portal access and try again.");
  }
}

function openCreateModal(){
  if(!canManageTrainingReferences()){
    setTrainingReferenceStatus("Sign in with an approved editor account before creating posts.", "warning");
    return;
  }

  clearFormErrors();
  form?.reset();
  openModal(modal);
  document.getElementById("trainingReferenceTitle")?.focus();
}

function closeCreateModal(){
  closeModal(modal);
}

function openDetailsModal(postId){
  const post = trainingReferences.find(reference => reference.id === postId);

  if(!post || !detailsModal || !detailsTitle || !detailsContent){
    return;
  }

  detailsTitle.textContent = post.title || "Training Reference Post";

  if(detailsCategory){
    detailsCategory.textContent = post.category || "Training Reference Library";
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

  openModal(detailsModal);
}

function closeDetailsModal(){
  closeModal(detailsModal);
}

function requestDelete(postId){
  if(!canManageTrainingReferences()){
    setTrainingReferenceStatus("Only approved editors can remove training reference posts.", "warning");
    return;
  }

  const post = trainingReferences.find(reference => reference.id === postId);
  pendingDeletePostId = postId;

  if(deletePostTitle){
    deletePostTitle.textContent = post?.title ? `"${post.title}"` : "Selected training reference post";
  }

  openModal(deleteModal);
  confirmDeleteBtn?.focus();
}

async function confirmDeletePost(){
  if(!pendingDeletePostId){
    return;
  }

  const postId = pendingDeletePostId;
  const post = trainingReferences.find(reference => reference.id === postId);

  try{
    if(confirmDeleteBtn){
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = "Removing...";
    }

    await deleteTrainingReference(postId);
    await logPortalAction(staffAccess, {
      action:"Training Reference Removed",
      category:"Training",
      message:`Removed training reference: ${post?.title || postId}.`,
      targetUid:postId,
      targetLabel:post?.title || postId,
      postAuthor:post?.author || "",
      postCategory:post?.category || "",
      postDetails:post?.summary || "",
      postNarrative:post?.content || "",
      resourceUrl:normalizeUrl(post?.resourceUrl || "")
    });
    closeDeleteModal();
    setTrainingReferenceStatus("Training reference removed.", "success");
  }catch(error){
    console.error("Training reference delete failed:", error);
    setTrainingReferenceStatus("Training reference could not be removed. Check portal access and try again.", "error");
  }finally{
    if(confirmDeleteBtn){
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Remove Post";
    }
  }
}

function closeDeleteModal(){
  pendingDeletePostId = "";
  closeModal(deleteModal);
}

function updateTrainingReferenceAccessUI(){
  const canEdit = canManageTrainingReferences();

  if(createBtn){
    createBtn.hidden = !canEdit;
  }

  document.querySelectorAll("[data-delete-training-reference]").forEach(button => {
    button.hidden = !canEdit;
  });
}

function canManageTrainingReferences(){
  return Boolean(staffAccess.canEdit);
}

function validatePost(post){
  const errors = {};

  if(!post.title){
    errors.trainingReferenceTitle = "Post title is required.";
  }

  if(!post.content){
    errors.trainingReferenceContent = "Post details are required.";
  }

  if(post.resourceUrl && !normalizeUrl(post.resourceUrl)){
    errors.trainingReferenceLink = "Enter a valid web link.";
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
  document.querySelectorAll("#trainingReferenceForm .field-error").forEach(error => {
    error.textContent = "";
  });
  document.querySelectorAll("#trainingReferenceForm .invalid").forEach(input => {
    input.classList.remove("invalid");
  });
}

function setFormStatus(message){
  if(formStatus){
    formStatus.textContent = message;
  }
}

function setTrainingReferenceStatus(message, type){
  if(!staffStatus){
    return;
  }

  staffStatus.textContent = message;
  staffStatus.dataset.status = type || "info";
}

function openModal(targetModal){
  targetModal?.classList.add("open");
  targetModal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(targetModal){
  targetModal?.classList.remove("open");
  targetModal?.setAttribute("aria-hidden", "true");

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
