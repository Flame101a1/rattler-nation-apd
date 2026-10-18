import { subscribeToCalendarEvents } from "./calendar-events-service.js";
import { subscribeToAnnouncements } from "./announcements-service.js";
import { watchStaffAuth } from "./staff-auth-service.js";

function escapeHTML(value){
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[character]));
}

function loadAnnouncements(){
  const box = document.getElementById("announcements-list");

  if(!box){
    return;
  }

  box.innerHTML = emptyStateHTML("Loading announcements", "Checking the latest department posts.", "is-loading compact");

  subscribeToAnnouncements(
    announcements => {
      const latestAnnouncements = announcements.slice(0,3);

      if(!latestAnnouncements.length){
        box.innerHTML = emptyStateHTML("No active announcements", "New department announcements will appear here once posted.", "compact");
        return;
      }

      box.innerHTML = latestAnnouncements.map(announcement => `
        <div class="announcement dashboard-announcement">
          <h4>${escapeHTML(announcement.title || "Untitled Announcement")}</h4>
          <p>${escapeHTML(announcement.message || "")}</p>
          <span>${escapeHTML(announcementMeta(announcement))}</span>
        </div>
      `).join("");
    },
    () => {
      box.innerHTML = emptyStateHTML("Announcements unavailable", "The shared announcement feed could not be reached.", "error compact");
    }
  );
}

function loadHomepageTraining(){
  const box = document.getElementById("homepage-training");

  if(!box){
    return;
  }

  box.innerHTML = emptyStateHTML("Loading training", "Checking the shared calendar for upcoming classes.", "is-loading compact");

  subscribeToCalendarEvents(
    events => {
      const upcomingTraining = dashboardTrainingEvents(events).slice(0,3);

      if(!upcomingTraining.length){
        box.innerHTML = emptyStateHTML("No upcoming training", "Upcoming calendar events will appear here automatically.", "compact");
        return;
      }

      const [nextTraining, ...remainingTraining] = upcomingTraining;

      box.innerHTML = `
        ${nextTrainingHTML(nextTraining)}
        ${remainingTraining.length ? `
          <div class="training-up-next">
            <span>Additional Training</span>
            ${remainingTraining.map(compactTrainingHTML).join("")}
          </div>
        ` : ""}
      `;
    },
    () => {
      box.innerHTML = emptyStateHTML("Training unavailable", "The shared training calendar could not be reached.", "error compact");
    }
  );
}

function nextTrainingHTML({ event, date }){
  return `
    <a class="next-training-card" href="training.html">
      <div class="next-training-body">
        <div class="next-training-topline">
          <span>${escapeHTML(trainingTypeLabel(event))}</span>
          <strong>${escapeHTML(trainingCountdown(event, date))}</strong>
        </div>
        <h4>${escapeHTML(event.title || "Scheduled Training")}</h4>
        <p>${escapeHTML(formatTrainingDateTime(event, date))}</p>
        ${event.location ? `<small>${escapeHTML(event.location)}</small>` : ""}
      </div>
    </a>
  `;
}

function compactTrainingHTML({ event, date }){
  return `
    <a class="training-item dashboard-training-link compact-training-link" href="training.html">
      <div class="date compact-date">
        <span>${escapeHTML(date.toLocaleDateString("en-US", { month:"short" }))}</span>
        <strong>${escapeHTML(date.getDate())}</strong>
      </div>
      <div>
        <h4>${escapeHTML(event.title || "Scheduled Training")}</h4>
        <p>${escapeHTML(formatTrainingDateTime(event, date))}</p>
      </div>
    </a>
  `;
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

function dashboardTrainingEvents(events){
  const today = startOfDay(new Date());
  const windowEnd = addDays(today, 180);
  const upcomingEvents = events
    .flatMap(event => occurrencesBetween(event, today, windowEnd))
    .sort(sortOccurrences);

  const trainingEvents = upcomingEvents.filter(({ event }) => isTrainingEvent(event));

  return trainingEvents.length ? trainingEvents : upcomingEvents;
}

function sortOccurrences(a, b){
  const dateCompare = a.date - b.date;
  if(dateCompare !== 0){
    return dateCompare;
  }

  return (a.event.start || "00:00").localeCompare(b.event.start || "00:00");
}

function occurrencesBetween(event, startDate, endDate){
  if(!event.date){
    return [];
  }

  const eventDate = parseLocalDate(event.date);

  if(Number.isNaN(eventDate.getTime())){
    return [];
  }

  if(!event.recurring){
    return eventDate >= startDate && eventDate <= endDate ? [{ event, date:eventDate }] : [];
  }

  const recurrenceEnd = event.recurrenceEnd ? parseLocalDate(event.recurrenceEnd) : endDate;
  const occurrences = [];
  let cursor = eventDate;
  let safety = 0;

  while(cursor <= endDate && cursor <= recurrenceEnd && safety < 120){
    if(cursor >= startDate){
      occurrences.push({ event, date:new Date(cursor) });
    }

    cursor = nextOccurrence(cursor, event.recurrence);
    safety++;
  }

  return occurrences;
}

function isTrainingEvent(event){
  const type = String(event.type || "").trim().toLowerCase();
  const title = String(event.title || "").trim().toLowerCase();

  return type === "training"
    || type === "fto training"
    || type.includes("training")
    || title.includes("training");
}

function formatTrainingMeta(event, date){
  const dateText = date.toLocaleDateString("en-US", {
    weekday:"short",
    month:"short",
    day:"numeric"
  });

  if(event.allDay){
    return `${event.type} - ${dateText} - All Day`;
  }

  if(event.start && event.end){
    return `${event.type} - ${dateText} - ${formatTime(event.start)} to ${formatTime(event.end)}`;
  }

  if(event.start){
    return `${event.type} - ${dateText} - ${formatTime(event.start)}`;
  }

  return `${event.type} - ${dateText}`;
}

function formatTrainingDateTime(event, date){
  const dateText = date.toLocaleDateString("en-US", {
    weekday:"long",
    month:"short",
    day:"numeric"
  });

  if(event.allDay){
    return `${dateText} - All Day`;
  }

  if(event.start && event.end){
    return `${dateText} - ${formatTime(event.start)} to ${formatTime(event.end)}`;
  }

  if(event.start){
    return `${dateText} - ${formatTime(event.start)}`;
  }

  return `${dateText} - Time TBD`;
}

function trainingTypeLabel(event){
  const type = String(event.type || "").trim();

  if(!type || type.toLowerCase() === "other"){
    return "Training Event";
  }

  return type;
}

function trainingCountdown(event, date){
  const now = new Date();
  const eventStart = eventDateTime(event, date);
  const diffMs = eventStart - now;
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  if(diffMs <= 0){
    return "In Progress";
  }

  if(diffMs < dayMs && date.toDateString() === now.toDateString()){
    const hours = Math.max(1, Math.ceil(diffMs / hourMs));
    return hours === 1 ? "Begins in 1 hour" : `Begins in ${hours} hours`;
  }

  const days = Math.ceil(diffMs / dayMs);

  if(days === 1){
    return "Begins Tomorrow";
  }

  return `Begins in ${days} days`;
}

function eventDateTime(event, date){
  if(!event.start){
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0);
  }

  const [hours, minutes] = event.start.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes || 0);
}

function formatTime(value){
  const [hours, minutes] = value.split(":");
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return date.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
}

function nextOccurrence(date, recurrence){
  if(recurrence === "daily"){
    return addDays(date, 1);
  }

  if(recurrence === "monthly"){
    return new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  return addDays(date, 7);
}

function parseLocalDate(value){
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date){
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days){
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function updateClock(){
  const now = new Date();
  const timeBox = document.getElementById("currentTime");
  const dateBox = document.getElementById("currentDate");

  if(timeBox){
    timeBox.innerText = now.toLocaleTimeString("en-US", {
      hour:"numeric",
      minute:"2-digit",
      second:"2-digit"
    });
  }

  if(dateBox){
    dateBox.innerText = now.toLocaleDateString("en-US", {
      weekday:"short",
      month:"short",
      day:"numeric"
    });
  }
}

function announcementMeta(announcement){
  const parts = [];

  if(announcement.category){
    parts.push(announcement.category);
  }

  if(announcement.priority && announcement.priority !== "Normal"){
    parts.push(announcement.priority);
  }

  const date = formatFirestoreDate(announcement.createdAt);

  if(date){
    parts.push(date);
  }

  return parts.join(" - ");
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

loadAnnouncements();
loadHomepageTraining();
watchAdminNavigation();
updateClock();
setInterval(updateClock, 1000);

function watchAdminNavigation(){
  const adminLink = document.getElementById("adminSidebarLink");

  if(!adminLink){
    return;
  }

  watchStaffAuth(access => {
    document.body.classList.toggle("site-admin", Boolean(access.role?.admin));
    adminLink.hidden = !access.role?.admin;
  });
}
