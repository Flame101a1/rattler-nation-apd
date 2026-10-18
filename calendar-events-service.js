import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase-config.js";

const calendarEventsCollection = collection(db, "calendarEvents");

export function subscribeToCalendarEvents(onEvents, onError){
  const calendarQuery = query(calendarEventsCollection, orderBy("date", "asc"));

  return onSnapshot(
    calendarQuery,
    snapshot => {
      const events = snapshot.docs.map(documentSnapshot => ({
        id:documentSnapshot.id,
        ...documentSnapshot.data()
      }));

      onEvents(events);
    },
    error => {
      if(onError){
        onError(error);
      }
    }
  );
}

export async function saveCalendarEvent(event){
  const eventData = {
    title:event.title || "",
    type:event.type || "",
    description:event.description || "",
    date:event.date || "",
    start:event.start || "",
    end:event.end || "",
    location:event.location || "",
    organizer:event.organizer || "",
    group:event.group || "",
    notes:event.notes || "",
    color:event.color || "blue",
    allDay:Boolean(event.allDay),
    recurring:Boolean(event.recurring),
    recurrence:event.recurrence || "",
    recurrenceEnd:event.recurrenceEnd || "",
    updatedAt:serverTimestamp()
  };

  if(event.id){
    await setDoc(
      doc(db, "calendarEvents", event.id),
      eventData,
      { merge:true }
    );

    return event.id;
  }

  const createdEvent = await addDoc(calendarEventsCollection, {
    ...eventData,
    createdAt:serverTimestamp()
  });

  return createdEvent.id;
}

export function deleteCalendarEvent(eventId){
  return deleteDoc(doc(db, "calendarEvents", eventId));
}
