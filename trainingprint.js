import { subscribeToCalendarEvents } from "./calendar-events-service.js";

const scheduleWindowDays = 180;
const printList = document.getElementById("print-training-list");
const rangeLabel = document.getElementById("printScheduleRange");
const updatedLabel = document.getElementById("printScheduleUpdated");

document.getElementById("printScheduleBtn")?.addEventListener("click", () => {
  window.print();
});

if(printList){
  subscribeToCalendarEvents(
    events => renderPrintableSchedule(events),
    () => {
      printList.innerHTML = emptyStateHTML(
        "Printable schedule unavailable",
        "The shared calendar could not be reached. Check the connection and try again.",
        "error"
      );
    }
  );
}

function renderPrintableSchedule(events){
  const today = startOfDay(new Date());
  const windowEnd = addDays(today, scheduleWindowDays);
  const trainingEvents = events
    .filter(isTrainingEvent)
    .flatMap(event => occurrencesBetween(event, today, windowEnd))
    .sort((a, b) => {
      const dateCompare = a.date - b.date;
      if(dateCompare !== 0){
        return dateCompare;
      }

      return (a.event.start || "00:00").localeCompare(b.event.start || "00:00");
    });

  if(rangeLabel){
    rangeLabel.textContent = `${formatRangeDate(today)} - ${formatRangeDate(windowEnd)}`;
  }

  if(updatedLabel){
    updatedLabel.textContent = new Date().toLocaleDateString("en-US", {
      month:"long",
      day:"numeric",
      year:"numeric"
    });
  }

  if(!trainingEvents.length){
    printList.innerHTML = emptyStateHTML(
      "No upcoming training scheduled",
      "Training and FTO Training events added to the Calendar & Planner will appear here automatically."
    );
    return;
  }

  printList.innerHTML = trainingEvents.map(({ event, date }) => `
    <article class="print-training-row">
      <div class="print-date">
        <span>${escapeHTML(date.toLocaleDateString("en-US", { weekday:"short" }))}</span>
        <strong>${escapeHTML(date.toLocaleDateString("en-US", { month:"short", day:"numeric" }))}</strong>
        <small>${escapeHTML(date.getFullYear())}</small>
      </div>
      <div class="print-training-main">
        <div class="print-training-heading">
          <h3>${escapeHTML(event.title || "Untitled Training")}</h3>
          <span>${escapeHTML(event.type || "Training")}</span>
        </div>
        <dl>
          <div>
            <dt>Time</dt>
            <dd>${escapeHTML(formatTimeRange(event))}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>${escapeHTML(event.location || "TBD")}</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>${escapeHTML(event.group || "All applicable staff")}</dd>
          </div>
          <div>
            <dt>Organizer</dt>
            <dd>${escapeHTML(event.organizer || "APD Command")}</dd>
          </div>
        </dl>
        ${event.description ? `<p>${escapeHTML(event.description)}</p>` : ""}
        ${event.notes ? `<p class="print-notes">${escapeHTML(event.notes)}</p>` : ""}
      </div>
    </article>
  `).join("");
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

  while(cursor <= endDate && cursor <= recurrenceEnd && safety < 450){
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

function nextOccurrence(date, recurrence){
  if(recurrence === "daily"){
    return addDays(date, 1);
  }

  if(recurrence === "monthly"){
    return new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  return addDays(date, 7);
}

function formatTimeRange(event){
  if(event.allDay){
    return "All Day";
  }

  if(event.start && event.end){
    return `${formatTime(event.start)} - ${formatTime(event.end)}`;
  }

  if(event.start){
    return formatTime(event.start);
  }

  return "Time TBD";
}

function formatTime(value){
  const [hours, minutes] = value.split(":");
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return date.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
}

function formatRangeDate(date){
  return date.toLocaleDateString("en-US", {
    month:"short",
    day:"numeric",
    year:"numeric"
  });
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

function emptyStateHTML(title, message, variant = ""){
  const className = variant ? `empty-state ${variant}` : "empty-state";

  return `
    <div class="${className}">
      <strong>${escapeHTML(title)}</strong>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
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
