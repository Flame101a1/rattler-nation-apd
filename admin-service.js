import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase-config.js";

const userRolesCollection = collection(db, "userRoles");

export async function loadAuthorizedUsers(){
  const snapshot = await getDocs(userRolesCollection);

  return snapshot.docs
    .map(documentSnapshot => ({
      uid:documentSnapshot.id,
      ...documentSnapshot.data()
    }))
    .sort((a, b) => {
      const aTime = firestoreTime(a.updatedAt);
      const bTime = firestoreTime(b.updatedAt);

      if(aTime !== bTime){
        return bTime - aTime;
      }

      return (a.email || a.displayName || a.uid).localeCompare(b.email || b.displayName || b.uid);
    });
}

export function saveAuthorizedUser(userRole){
  return setDoc(
    doc(db, "userRoles", userRole.uid),
    {
      email:userRole.email || "",
      displayName:userRole.displayName || "",
      calendarEditor:Boolean(userRole.calendarEditor),
      admin:Boolean(userRole.admin),
      officer:Boolean(userRole.officer),
      reviewer:Boolean(userRole.reviewer),
      cidEditor:Boolean(userRole.cidEditor),
      updatedAt:serverTimestamp()
    },
    { merge:true }
  );
}

export function removeAuthorizedUser(uid){
  return deleteDoc(doc(db, "userRoles", uid));
}

function firestoreTime(value){
  if(!value){
    return 0;
  }

  if(typeof value.toMillis === "function"){
    return value.toMillis();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
