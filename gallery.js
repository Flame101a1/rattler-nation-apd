const galleryImages = [];

function escapeHTML(value){
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[character]));
}

function loadGallery(){
  const box = document.getElementById("gallery-list");

  if(!box){
    return;
  }

  if(!galleryImages.length){
    box.innerHTML = '<div class="empty-state"><strong>Rattler Nation gallery</strong><p>Austin Police Department media will appear here when new community photos are added.</p></div>';
    return;
  }
  box.innerHTML = galleryImages.map(item => {
    const image = escapeHTML(item.image);
    const title = escapeHTML(item.title);
    const description = escapeHTML(item.description);

    return `
      <div class="gallery-card">
        <img
          src="${image}"
          alt="${title}"
          loading="lazy"
          decoding="async"
          data-gallery-image="${image}"
        >
        <div class="gallery-info">
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
      </div>
    `;
  }).join("");
}

function openImage(image){
  const modal = document.getElementById("galleryModal");
  const modalImage = document.getElementById("modalImage");

  if(!modal || !modalImage){
    return;
  }

  modal.style.display = "flex";
  modalImage.src = image;
}

function closeImage(){
  const modal = document.getElementById("galleryModal");

  if(modal){
    modal.style.display = "none";
  }
}

document.getElementById("gallery-list")?.addEventListener("click",event=>{const image=event.target.closest("[data-gallery-image]");if(image)openImage(image.dataset.galleryImage);});
document.getElementById("closeGalleryImage")?.addEventListener("click",closeImage);
loadGallery();
