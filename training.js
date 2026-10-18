import { subscribeToCalendarEvents } from "./calendar-events-service.js";

const scheduleWindowDays = 180;

const trainingList = document.getElementById("training-list");

if(trainingList){
  subscribeToCalendarEvents(
    events => renderTrainingSchedule(events),
    () => {
      trainingList.innerHTML = emptyStateHTML(
        "Training schedule unavailable",
        "The shared calendar could not be reached. Check the connection and try again.",
        "error"
      );
    }
  );
}

function renderTrainingSchedule(events){
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

  if(!trainingEvents.length){
    trainingList.innerHTML = emptyStateHTML(
      "No upcoming training scheduled",
      "Training and FTO Training events added to the Calendar & Planner will appear here automatically."
    );
    return;
  }

  trainingList.innerHTML = trainingEvents.map(({ event, date }) => {
    const details = [
      event.location ? `LOCATION: ${escapeHTML(event.location)}` : "",
      event.group ? `GROUP: ${escapeHTML(event.group)}` : "",
      event.organizer ? `ORGANIZER: ${escapeHTML(event.organizer)}` : ""
    ].filter(Boolean).join(" | ");

    return `
      <div class="training-full">
        <div class="training-date">${escapeHTML(formatShortDate(date))}</div>
        <div class="training-info">
          <h3>${escapeHTML(event.title)}</h3>
          <p>${details || escapeHTML(event.type)}</p>
        </div>
        <span class="training-time">TIME: ${escapeHTML(formatTimeRange(event))}</span>
      </div>
    `;
  }).join("");
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

function formatShortDate(date){
  return date.toLocaleDateString("en-US", {
    weekday:"short",
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

function escapeHTML(value){
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[character]));
}
