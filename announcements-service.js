import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase-config.js";

const announcementsCollection = collection(db, "announcements");

export function subscribeToAnnouncements(onAnnouncements, onError){
  const announcementsQuery = query(announcementsCollection, orderBy("createdAt", "desc"));

  return onSnapshot(
    announcementsQuery,
    snapshot => {
      const announcements = snapshot.docs.map(documentSnapshot => ({
        id:documentSnapshot.id,
        ...documentSnapshot.data()
      }));

      onAnnouncements(announcements);
    },
    error => {
      if(onError){
        onError(error);
      }
    }
  );
}

export function createAnnouncement(announcement){
  return addDoc(announcementsCollection, {
    title:announcement.title || "",
    message:announcement.message || "",
    category:announcement.category || "General",
    author:announcement.author || "",
    priority:announcement.priority || "Normal",
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}

export function deleteAnnouncement(announcementId){
  return deleteDoc(doc(db, "announcements", announcementId));
}
