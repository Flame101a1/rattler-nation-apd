(function(){
  const identity = document.createElement("p");
  identity.className = "community-identity";
  identity.textContent = "Rattler Nation · Austin Police Department";
  const pageHeader = document.querySelector(".simple-header");
  pageHeader?.prepend(identity);
  function updatePortalClock(){
    const now = new Date();
    const time = document.getElementById("currentTime");
    const date = document.getElementById("currentDate");
    if(time) time.textContent = now.toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit", second:"2-digit"});
    if(date) date.textContent = now.toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"});
  }
  updatePortalClock();
  if(document.getElementById("currentTime")) setInterval(updatePortalClock, 1000);
  const layout = document.querySelector(".page-layout");

  if(!layout){
    markExternalLinks();
    return;
  }

  const pages = [
    ["Dashboard", "index.html", "", "Main"],
    ["Officer Resources", "resources.html", "", "Main"],
    ["CID Portal", "cid.html", "", "Main"],
    ["Training", "training.html", "", "Main"],
    ["Roster", "roster.html", "", "Main"],
    ["SOP", "sop.html", "", "Reference"],
    ["CID SOP", "cidsop.html", "", "Reference"],
    ["Penal Codes", "penalcodes.html", "", "Reference"],
    ["Warrants", "warrantform.html", "", "Forms"],
    ["Complaints", "complaints.html", "", "Forms"],
    ["Suggestions", "suggestions.html", "", "Forms"],
    ["Site Issues", "siteissues.html", "", "Forms"]
  ];

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const header = layout.querySelector(".simple-header");

  if(header && !layout.querySelector(".inner-nav")){
    const current = pages.find(([, href]) => href === currentPage);
    const nav = document.createElement("nav");
    nav.className = "inner-nav";
    nav.setAttribute("aria-label", "Portal navigation");

    const homeLink = document.createElement("a");
    homeLink.className = "inner-home-button";
    homeLink.href = "index.html";
    homeLink.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M3.75 10.7 12 4l8.25 6.7" />
        <path d="M5.75 9.75V20h4.5v-5.65h3.5V20h4.5V9.75" />
      </svg>
    `;
    homeLink.title = "Dashboard";
    homeLink.setAttribute("aria-label", "Return to dashboard");

    const toggle = document.createElement("button");
    toggle.className = "inner-nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `
      <span>Portal Menu</span>
      <strong>${current ? current[0] : "Navigation"}</strong>
    `;

    const panel = document.createElement("div");
    panel.className = "inner-nav-panel";

    const groups = pages.reduce((collection, page) => {
      const groupName = page[3] || "Main";

      if(!collection[groupName]){
        collection[groupName] = [];
      }

      collection[groupName].push(page);
      return collection;
    }, {});

    Object.entries(groups).forEach(([groupName, groupPages]) => {
      const group = document.createElement("div");
      group.className = "inner-nav-group";

      const heading = document.createElement("span");
      heading.className = "inner-nav-heading";
      heading.textContent = groupName;
      group.appendChild(heading);

      groupPages.forEach(([label, href, className]) => {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;

        if(className){
          link.className = className;
        }

        if(href === currentPage){
          link.classList.add("active");
        }

        if(href.startsWith("http")){
          link.target = "_blank";
          link.rel = "noopener";
        }

        group.appendChild(link);
      });

      panel.appendChild(group);
    });

    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", event => {
      if(nav.contains(event.target)){
        return;
      }

      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", event => {
      if(event.key !== "Escape"){
        return;
      }

      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });

    nav.appendChild(homeLink);
    nav.appendChild(toggle);
    nav.appendChild(panel);
    header.appendChild(nav);
  }

  markExternalLinks();
  addExternalNotes();
  addFooter(layout);

  function markExternalLinks(){
    document.querySelectorAll('a[href^="http"]').forEach(link => {
      if(!link.classList.contains("no-external-label")){
        link.classList.add("external-link");
      }

      if(!link.target){
        link.target = "_blank";
      }

      const rel = new Set((link.rel || "").split(" ").filter(Boolean));
      rel.add("noopener");
      link.rel = Array.from(rel).join(" ");
    });
  }

  function addExternalNotes(){
    document.querySelectorAll(".doc-frame, .sheet-frame").forEach(frame => {
      const card = frame.closest(".page-card");

      if(!card || card.querySelector(".external-note")){
        return;
      }

      const note = document.createElement("p");
      note.className = "external-note";
      note.textContent = "This embedded document is hosted outside the portal and may open in Google Docs or Google Sheets.";
      (frame.closest(".roster-viewport") || frame).insertAdjacentElement("beforebegin", note);
    });
  }

  function addFooter(target){
    if(target.querySelector(".inner-footer")){
      return;
    }

    const footer = document.createElement("footer");
    footer.className = "portal-footer inner-footer";
    footer.innerHTML = `
      <p>&copy; 2026 Austin Police Department</p>
      <div class="footer-quote">
        "Integrity &middot; Service &middot; Leadership"
        <br>
        <span>- Austin Police Department</span>
      </div>
      <p>Rattler Nation · Private FiveM roleplay community</p>
    `;

    target.appendChild(footer);
  }
})();
