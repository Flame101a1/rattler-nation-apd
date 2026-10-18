import {
  deleteCalendarEvent,
  saveCalendarEvent,
  subscribeToCalendarEvents
} from "./calendar-events-service.js";

import { logPortalAction } from "./portal-log-service.js";

import {
  signInStaff,
  signOutStaff,
  watchStaffAuth
} from "./staff-auth-service.js";

(function(){
  const calendarSurface = document.getElementById("calendarSurface");

  if(!calendarSurface){
    return;
  }

  const eventTypes = {
    "Department Event":"dept",
    "Training":"training",
    "Meeting":"meeting",
    "Patrol Operation":"patrol",
    "Special Operation":"special",
    "Interview":"interview",
    "Deadline":"deadline",
    "Court":"court",
    "FTO Training":"fto",
    "Command Staff":"command",
    "Other":"other"
  };

  let plannerEvents = [];
  let currentDate = startOfDay(new Date());
  let currentView = "month";
  let activeEventId = null;
  let activeOccurrenceDate = null;
  let pendingDeleteId = null;
  let staffAccess = {
    user:null,
    role:null,
    canEdit:false
  };

  const title = document.getElementById("calendarTitle");
  const viewButtons = document.querySelectorAll("[data-view]");
  const createEventBtn = document.getElementById("createEventBtn");
  const editEventBtn = document.getElementById("editEventBtn");
  const deleteEventBtn = document.getElementById("deleteEventBtn");
  const eventModal = document.getElementById("eventModal");
  const detailsModal = document.getElementById("detailsModal");
  const confirmModal = document.getElementById("confirmModal");
  const eventForm = document.getElementById("eventForm");
  const formStatus = document.getElementById("eventFormStatus");
  const recurrencePanel = document.getElementById("recurrencePanel");
  const allDayInput = document.getElementById("eventAllDay");
  const recurringInput = document.getElementById("eventRecurring");
  const staffLoginForm = document.getElementById("staffLoginForm");
  const staffSessionPanel = document.getElementById("staffSessionPanel");
  const staffAccessSummary = document.getElementById("staffAccessSummary");
  const staffAuthStatus = document.getElementById("staffAuthStatus");
  const staffUserEmail = document.getElementById("staffUserEmail");
  const staffRoleLabel = document.getElementById("staffRoleLabel");

  createEventBtn?.addEventListener("click", () => {
    if(!userCanManageEvents()){
      setStaffStatus("Sign in with an approved calendar editor account to create events.", "warning");
      return;
    }

    openEventForm();
  });
  document.getElementById("calendarToday")?.addEventListener("click", () => {
    currentDate = startOfDay(new Date());
    renderPlanner();
  });
  document.getElementById("calendarPrev")?.addEventListener("click", () => moveCalendar(-1));
  document.getElementById("calendarNext")?.addEventListener("click", () => moveCalendar(1));
  editEventBtn?.addEventListener("click", editActiveEvent);
  deleteEventBtn?.addEventListener("click", requestDeleteActiveEvent);
  document.getElementById("cancelDeleteBtn")?.addEventListener("click", () => closeModal(confirmModal));
  document.getElementById("confirmDeleteBtn")?.addEventListener("click", deletePendingEvent);

  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => closeModal(eventModal));
  });

  document.querySelectorAll("[data-close-details]").forEach(button => {
    button.addEventListener("click", () => closeModal(detailsModal));
  });

  viewButtons.forEach(button => {
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      viewButtons.forEach(item => item.classList.toggle("active", item === button));
      renderPlanner();
    });
  });

  allDayInput?.addEventListener("change", toggleAllDayFields);
  recurringInput?.addEventListener("change", toggleRecurrenceFields);
  eventForm?.addEventListener("submit", saveEventFromForm);
  staffLoginForm?.addEventListener("submit", handleStaffLogin);
  document.getElementById("staffSignOutBtn")?.addEventListener("click", handleStaffSignOut);

  [eventModal, detailsModal, confirmModal].forEach(modal => {
    modal?.addEventListener("click", event => {
      if(event.target === modal){
        closeModal(modal);
      }
    });
  });

  startCalendarSync();
  startStaffAuth();

  function startStaffAuth(){
    updatePlannerAccessUI();

    watchStaffAuth(access => {
      staffAccess = access;
      updatePlannerAccessUI();

      if(access.user && !access.canEdit){
        setStaffStatus("This account does not have calendar editor access.", "warning");
      }
    });
  }

  async function handleStaffLogin(event){
    event.preventDefault();

    const email = document.getElementById("staffEmail").value.trim();
    const password = document.getElementById("staffPassword").value;

    if(!email || !password){
      setStaffStatus("Enter your staff email and password.", "warning");
      return;
    }

    try{
      setStaffStatus("Signing in...", "info");
      await signInStaff(email, password);
      staffLoginForm.reset();
      setStaffStatus("Signed in successfully.", "success");
    }catch(error){
      console.error("Staff sign in failed:", error);
      setStaffStatus("Sign in failed. Check the email and password, then try again.", "error");
    }
  }

  async function handleStaffSignOut(){
    try{
      await signOutStaff();
      setStaffStatus("Signed out.", "info");
    }catch(error){
      console.error("Staff sign out failed:", error);
      setStaffStatus("Could not sign out. Try again.", "error");
    }
  }

  function updatePlannerAccessUI(){
    const signedIn = Boolean(staffAccess.user);
    const canEdit = userCanManageEvents();

    if(staffLoginForm){
      staffLoginForm.hidden = canEdit;
    }

    if(staffSessionPanel){
      staffSessionPanel.hidden = !canEdit;
    }

    if(staffUserEmail){
      staffUserEmail.textContent = staffAccess.user?.email || "Staff User";
    }

    if(staffRoleLabel){
      staffRoleLabel.textContent = staffAccess.role?.admin ? "Admin calendar access" : "Calendar editor access";
    }

    if(staffAccessSummary){
      staffAccessSummary.textContent = canEdit
        ? "You can create, edit, and delete shared portal calendar events."
        : "Sign in with an approved staff account to create, edit, and delete calendar events.";
    }

    if(createEventBtn){
      createEventBtn.hidden = !canEdit;
      createEventBtn.disabled = !canEdit;
    }

    if(editEventBtn){
      editEventBtn.hidden = !canEdit;
    }

    if(deleteEventBtn){
      deleteEventBtn.hidden = !canEdit;
    }

    document.body.classList.toggle("calendar-editor", canEdit);
    document.body.classList.toggle("calendar-viewer", !canEdit);
  }

  function userCanManageEvents(){
    return Boolean(staffAccess.canEdit);
  }

  function setStaffStatus(message, type){
    if(!staffAuthStatus){
      return;
    }

    staffAuthStatus.textContent = message;
    staffAuthStatus.dataset.status = type || "info";
  }

  function startCalendarSync(){
    calendarSurface.innerHTML = `<p class="empty-day">Loading calendar events...</p>`;

    subscribeToCalendarEvents(
      events => {
        plannerEvents = events;
        renderPlanner();
      },
      error => {
        console.error("Calendar Firestore sync failed:", error);
        calendarSurface.innerHTML = `
          <div class="external-note">
            Calendar events could not be loaded. Check the connection or portal access before trying again.
          </div>
        `;
      }
    );
  }

  function renderPlanner(){
    renderOverview();

    if(currentView === "week"){
      renderWeekView();
      return;
    }

    if(currentView === "day"){
      renderDayView();
      return;
    }

    renderMonthView();
  }

  function renderOverview(){
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);
    const allUpcoming = getOccurrencesBetween(today, addDays(today, 90));
    const thisWeek = allUpcoming.filter(item => item.date >= today && item.date <= weekEnd);
    const trainingCount = allUpcoming.filter(item => ["Training", "FTO Training"].includes(item.event.type)).length;
    const departmentCount = allUpcoming.filter(item => item.event.type === "Department Event").length;
    const nextEvent = allUpcoming[0];

    setText("statTraining", trainingCount);
    setText("statDepartment", departmentCount);
    setText("statWeek", thisWeek.length);
    setText("statNextEvent", nextEvent ? `${nextEvent.event.title} • ${formatShortDate(nextEvent.date)}` : "None scheduled");
  }

  function renderMonthView(){
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    const gridEnd = addDays(gridStart, 41);
    const occurrences = groupOccurrences(getOccurrencesBetween(gridStart, gridEnd));

    title.textContent = monthStart.toLocaleDateString("en-US", { month:"long", year:"numeric" });

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let html = `
      <div class="calendar-month">
        ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join("")}
    `;

    for(let index = 0; index < 42; index++){
      const date = addDays(gridStart, index);
      const key = toDateKey(date);
      const dayEvents = occurrences[key] || [];
      const visibleEvents = dayEvents.slice(0, 3);
      const isMuted = date.getMonth() !== currentDate.getMonth();

      html += `
        <button class="calendar-day ${isMuted ? "muted" : ""} ${isToday(date) ? "today" : ""}" data-day="${key}" type="button">
          <span class="day-number">${date.getDate()}</span>
          <span class="day-events">
            ${visibleEvents.map(({event, date: occurrenceDate}) => eventChip(event, occurrenceDate, "compact")).join("")}
            ${dayEvents.length > 3 ? `<span class="more-events" data-more-day="${key}">+${dayEvents.length - 3} more</span>` : ""}
          </span>
        </button>
      `;
    }

    html += "</div>";
    calendarSurface.innerHTML = html;
    bindCalendarClicks();
  }

  function renderWeekView(){
    const weekStart = addDays(currentDate, -currentDate.getDay());
    const weekEnd = addDays(weekStart, 6);
    const occurrences = groupOccurrences(getOccurrencesBetween(weekStart, weekEnd));

    title.textContent = `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;

    calendarSurface.innerHTML = `
      <div class="calendar-week">
        ${Array.from({length:7}, (_, index) => {
          const date = addDays(weekStart, index);
          const key = toDateKey(date);
          const dayEvents = occurrences[key] || [];

          return `
            <section class="week-day ${isToday(date) ? "today" : ""}">
              <button class="week-day-header" data-day="${key}" type="button">
                <span>${date.toLocaleDateString("en-US", { weekday:"short" })}</span>
                <strong>${date.getDate()}</strong>
              </button>
              <div class="week-day-events">
                ${dayEvents.length ? dayEvents.map(({event, date: occurrenceDate}) => eventListItem(event, occurrenceDate)).join("") : `<p class="empty-day">No events scheduled.</p>`}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    `;

    bindCalendarClicks();
  }

  function renderDayView(){
    const dayEvents = getOccurrencesForDay(currentDate);

    title.textContent = currentDate.toLocaleDateString("en-US", {
      weekday:"long",
      month:"long",
      day:"numeric",
      year:"numeric"
    });

    calendarSurface.innerHTML = `
      <div class="calendar-day-view ${isToday(currentDate) ? "today" : ""}">
        <div class="day-view-header">
          <div>
            <span>${currentDate.toLocaleDateString("en-US", { weekday:"long" })}</span>
            <strong>${currentDate.getDate()}</strong>
          </div>
          <button class="back-button small" data-day="${toDateKey(currentDate)}" type="button">Add/View Day</button>
        </div>
        <div class="day-view-events">
          ${dayEvents.length ? dayEvents.map(({event, date}) => eventListItem(event, date)).join("") : `<p class="empty-day">No events scheduled for this day.</p>`}
        </div>
      </div>
    `;

    bindCalendarClicks();
  }

  function eventChip(event, occurrenceDate, mode){
    return `
      <span class="event-chip color-${escapeAttr(event.color || "blue")} type-${escapeAttr(eventTypes[event.type] || "other")}" data-event-id="${escapeAttr(event.id)}" data-occurrence-date="${toDateKey(occurrenceDate)}">
        ${mode === "compact" ? "" : `<em>${formatTimeRange(event)}</em>`}
        ${escapeHTML(event.title)}
      </span>
    `;
  }

  function eventListItem(event, occurrenceDate){
    return `
      <button class="event-list-item color-${escapeAttr(event.color || "blue")}" data-event-id="${escapeAttr(event.id)}" data-occurrence-date="${toDateKey(occurrenceDate)}" type="button">
        <span>${formatTimeRange(event)}</span>
        <strong>${escapeHTML(event.title)}</strong>
        <small>${escapeHTML(event.type)}${event.location ? ` • ${escapeHTML(event.location)}` : ""}</small>
      </button>
    `;
  }

  function bindCalendarClicks(){
    calendarSurface.querySelectorAll("[data-event-id]").forEach(item => {
      item.addEventListener("click", event => {
        event.stopPropagation();
        openDetails(item.dataset.eventId, item.dataset.occurrenceDate);
      });
    });

    calendarSurface.querySelectorAll("[data-day]").forEach(item => {
      item.addEventListener("click", () => {
        currentDate = parseLocalDate(item.dataset.day);

        if(currentView === "month"){
          openDaySchedule(currentDate);
        }else if(userCanManageEvents()){
          openEventForm({ date: item.dataset.day });
        }
      });
    });

    calendarSurface.querySelectorAll("[data-more-day]").forEach(item => {
      item.addEventListener("click", event => {
        event.stopPropagation();
        openDaySchedule(parseLocalDate(item.dataset.moreDay));
      });
    });
  }

  function openDaySchedule(date){
    currentDate = date;
    currentView = "day";
    viewButtons.forEach(button => button.classList.toggle("active", button.dataset.view === "day"));
    renderPlanner();
  }

  function openEventForm(options = {}){
    if(!userCanManageEvents()){
      setStaffStatus("Only approved calendar editors can create or edit events.", "warning");
      return;
    }

    clearFormErrors();
    eventForm.reset();
    document.getElementById("eventId").value = options.id || "";
    document.getElementById("eventModalTitle").textContent = options.id ? "Edit Event" : "Create Event";

    const event = options.id ? plannerEvents.find(item => item.id === options.id) : null;

    document.getElementById("eventDate").value = options.date || toDateKey(currentDate);

    if(event){
      fillEventForm(event);
    }

    toggleAllDayFields();
    toggleRecurrenceFields();
    openModal(eventModal);
    document.getElementById("eventTitle").focus();
  }

  function fillEventForm(event){
    document.getElementById("eventId").value = event.id;
    document.getElementById("eventTitle").value = event.title || "";
    document.getElementById("eventType").value = event.type || "";
    document.getElementById("eventDescription").value = event.description || "";
    document.getElementById("eventDate").value = event.date || "";
    document.getElementById("eventStart").value = event.start || "";
    document.getElementById("eventEnd").value = event.end || "";
    document.getElementById("eventLocation").value = event.location || "";
    document.getElementById("eventOrganizer").value = event.organizer || "";
    document.getElementById("eventGroup").value = event.group || "";
    document.getElementById("eventNotes").value = event.notes || "";
    document.getElementById("eventColor").value = event.color || "blue";
    document.getElementById("eventAllDay").checked = Boolean(event.allDay);
    document.getElementById("eventRecurring").checked = Boolean(event.recurring);
    document.getElementById("eventRecurrence").value = event.recurrence || "weekly";
    document.getElementById("eventRecurrenceEnd").value = event.recurrenceEnd || "";
  }

  async function saveEventFromForm(event){
    event.preventDefault();
    clearFormErrors();

    if(!userCanManageEvents()){
      formStatus.textContent = "You must be signed in as a calendar editor to save events.";
      return;
    }

    const formEvent = readEventForm();
    const errors = validateEvent(formEvent);

    if(Object.keys(errors).length){
      showFormErrors(errors);
      formStatus.textContent = "Please fix the highlighted fields before saving.";
      return;
    }

    try{
      formStatus.textContent = "Saving event...";
      const isUpdate = Boolean(formEvent.id);
      const savedEventId = await saveCalendarEvent(formEvent);
      await logPortalAction(staffAccess, {
        action:isUpdate ? "Calendar Event Updated" : "Calendar Event Created",
        category:"Calendar",
        message:`${isUpdate ? "Updated" : "Created"} ${formEvent.type || "calendar event"}: ${formEvent.title}.`,
        targetUid:savedEventId,
        targetLabel:formEvent.title,
        calendarEvent:{...formEvent},
        publishDetails:[formEvent.description, "Date: " + formEvent.date, formEvent.allDay ? "All day" : "Time: " + formEvent.start + (formEvent.end ? " – " + formEvent.end : ""), formEvent.location ? "Location: " + formEvent.location : "", formEvent.organizer ? "Organizer: " + formEvent.organizer : "", formEvent.recurring ? "Repeats: " + formEvent.recurrence + (formEvent.recurrenceEnd ? " until " + formEvent.recurrenceEnd : "") : ""].filter(Boolean).join("\n\n")
      });
      closeModal(eventModal);
    }catch(error){
      console.error("Calendar event save failed:", error);
      formStatus.textContent = "Event could not be saved. Check portal access and try again.";
    }
  }

  function readEventForm(){
    const allDay = document.getElementById("eventAllDay").checked;
    const recurring = document.getElementById("eventRecurring").checked;

    return {
      id:document.getElementById("eventId").value,
      title:document.getElementById("eventTitle").value.trim(),
      type:document.getElementById("eventType").value,
      description:document.getElementById("eventDescription").value.trim(),
      date:document.getElementById("eventDate").value,
      start:allDay ? "" : document.getElementById("eventStart").value,
      end:allDay ? "" : document.getElementById("eventEnd").value,
      location:document.getElementById("eventLocation").value.trim(),
      organizer:document.getElementById("eventOrganizer").value.trim(),
      group:document.getElementById("eventGroup").value.trim(),
      notes:document.getElementById("eventNotes").value.trim(),
      color:document.getElementById("eventColor").value || "blue",
      allDay,
      recurring,
      recurrence:recurring ? document.getElementById("eventRecurrence").value : "",
      recurrenceEnd:recurring ? document.getElementById("eventRecurrenceEnd").value : ""
    };
  }

  function validateEvent(event){
    const errors = {};

    if(!event.title){
      errors.eventTitle = "Event title is required.";
    }

    if(!event.type){
      errors.eventType = "Select an event type.";
    }

    if(!event.date){
      errors.eventDate = "Date is required.";
    }

    if(!event.allDay && event.start && event.end && event.end < event.start){
      errors.eventEnd = "End time cannot be before start time.";
    }

    if(event.recurring && event.recurrenceEnd && event.date && event.recurrenceEnd < event.date){
      errors.eventRecurrenceEnd = "Recurrence end cannot be before the event date.";
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
    formStatus.textContent = "";
    document.querySelectorAll(".field-error").forEach(error => {
      error.textContent = "";
    });
    document.querySelectorAll(".planner-form .invalid").forEach(input => {
      input.classList.remove("invalid");
    });
  }

  function openDetails(eventId, occurrenceDate){
    const event = plannerEvents.find(item => item.id === eventId);

    if(!event){
      return;
    }

    activeEventId = eventId;
    activeOccurrenceDate = occurrenceDate || event.date;
    document.getElementById("detailsTitle").textContent = event.title;
    document.getElementById("eventDetailsContent").innerHTML = detailsHTML(event, activeOccurrenceDate);
    updatePlannerAccessUI();
    openModal(detailsModal);
  }

  function detailsHTML(event, occurrenceDate){
    const rows = [
      ["Type", event.type],
      ["Date", formatLongDate(parseLocalDate(occurrenceDate || event.date))],
      ["Time", formatTimeRange(event)],
      ["All Day", event.allDay ? "Yes" : "No"],
      ["Location", event.location],
      ["Organizer", event.organizer],
      ["Required Rank / Group", event.group],
      ["Description", event.description],
      ["Notes", event.notes],
      ["Recurrence", recurrenceLabel(event)]
    ].filter(([, value]) => value);

    return `
      <div class="details-badge color-${escapeAttr(event.color || "blue")}">${escapeHTML(event.type || "Event")}</div>
      <dl class="details-list">
        ${rows.map(([label, value]) => `
          <div>
            <dt>${escapeHTML(label)}</dt>
            <dd>${escapeHTML(value)}</dd>
          </div>
        `).join("")}
      </dl>
    `;
  }

  function editActiveEvent(){
    if(!activeEventId || !userCanManageEvents()){
      setStaffStatus("Only approved calendar editors can edit events.", "warning");
      return;
    }

    closeModal(detailsModal);
    openEventForm({ id:activeEventId });
  }

  function requestDeleteActiveEvent(){
    if(!userCanManageEvents()){
      setStaffStatus("Only approved calendar editors can delete events.", "warning");
      return;
    }

    pendingDeleteId = activeEventId;
    openModal(confirmModal);
  }

  async function deletePendingEvent(){
    if(!pendingDeleteId){
      return;
    }

    if(!userCanManageEvents()){
      setStaffStatus("Only approved calendar editors can delete events.", "warning");
      closeModal(confirmModal);
      return;
    }

    try{
      const eventToDelete = plannerEvents.find(event => event.id === pendingDeleteId);
      await deleteCalendarEvent(pendingDeleteId);
      await logPortalAction(staffAccess, {
        action:"Calendar Event Deleted",
        category:"Calendar",
        message:`Deleted ${eventToDelete?.type || "calendar event"}: ${eventToDelete?.title || pendingDeleteId}.`,
        targetUid:pendingDeleteId,
        targetLabel:eventToDelete?.title || pendingDeleteId,
        calendarEvent:eventToDelete ? {...eventToDelete} : {}
      });
      pendingDeleteId = null;
      activeEventId = null;
      closeModal(confirmModal);
      closeModal(detailsModal);
    }catch(error){
      console.error("Calendar event delete failed:", error);
    }
  }

  function toggleAllDayFields(){
    const disabled = allDayInput.checked;
    document.getElementById("eventStart").disabled = disabled;
    document.getElementById("eventEnd").disabled = disabled;
  }

  function toggleRecurrenceFields(){
    recurrencePanel.hidden = !recurringInput.checked;
  }

  function moveCalendar(direction){
    if(currentView === "month"){
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1);
    }else if(currentView === "week"){
      currentDate = addDays(currentDate, direction * 7);
    }else{
      currentDate = addDays(currentDate, direction);
    }

    renderPlanner();
  }

  function getOccurrencesForDay(date){
    const key = toDateKey(date);
    return getOccurrencesBetween(date, date).filter(item => toDateKey(item.date) === key);
  }

  function getOccurrencesBetween(startDate, endDate){
    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    const occurrences = [];

    plannerEvents.forEach(event => {
      const eventDate = parseLocalDate(event.date);

      if(!event.recurring){
        if(eventDate >= start && eventDate <= end){
          occurrences.push({ event, date:eventDate });
        }
        return;
      }

      const recurrenceEnd = event.recurrenceEnd ? parseLocalDate(event.recurrenceEnd) : addDays(start, 365);
      let cursor = eventDate;
      let safety = 0;

      while(cursor <= end && cursor <= recurrenceEnd && safety < 450){
        if(cursor >= start){
          occurrences.push({ event, date:new Date(cursor) });
        }

        cursor = nextOccurrence(cursor, event.recurrence);
        safety++;
      }
    });

    return occurrences.sort((a, b) => {
      const dateCompare = a.date - b.date;
      if(dateCompare !== 0){
        return dateCompare;
      }
      return (a.event.start || "00:00").localeCompare(b.event.start || "00:00");
    });
  }

  function groupOccurrences(occurrences){
    return occurrences.reduce((grouped, occurrence) => {
      const key = toDateKey(occurrence.date);
      grouped[key] = grouped[key] || [];
      grouped[key].push(occurrence);
      return grouped;
    }, {});
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

  function setText(id, value){
    const element = document.getElementById(id);
    if(element){
      element.textContent = value;
    }
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

  function recurrenceLabel(event){
    if(!event.recurring){
      return "";
    }

    const repeat = event.recurrence ? `${capitalize(event.recurrence)}` : "Recurring";
    return event.recurrenceEnd ? `${repeat} until ${formatLongDate(parseLocalDate(event.recurrenceEnd))}` : repeat;
  }

  function capitalize(value){
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function formatShortDate(date){
    return date.toLocaleDateString("en-US", { month:"short", day:"numeric" });
  }

  function formatLongDate(date){
    return date.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  }

  function toDateKey(date){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

  function isToday(date){
    return toDateKey(date) === toDateKey(new Date());
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
})();
