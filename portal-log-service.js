import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { addDeliveryJob } from "./discord-service.js";

const portalLogsCollection = collection(db, "portalLogs");


export function watchPortalLogs(onLogs, onError){
  const recentLogsQuery = query(
    portalLogsCollection,
    orderBy("createdAt", "desc"),
    limit(100)
  );

  return onSnapshot(
    recentLogsQuery,
    snapshot => {
      const logs = snapshot.docs.map(documentSnapshot => ({
        id:documentSnapshot.id,
        ...documentSnapshot.data()
      }));

      onLogs(logs);
    },
    onError
  );
}

export function addPortalLog(batch,logEntry){
  const normalizedLog = {
    action:logEntry.action || "Portal Action",
    category:logEntry.category || "System",
    message:logEntry.message || "",
    actorUid:logEntry.actorUid || "",
    actorEmail:logEntry.actorEmail || "",
    targetUid:logEntry.targetUid || "",
    targetLabel:logEntry.targetLabel || ""
  };
  if(!auth.currentUser) throw Error("Sign in to record a portal action.");
  normalizedLog.actorUid=auth.currentUser.uid;
  const createdLog=doc(portalLogsCollection);
  const record={...normalizedLog,actorDisplayName:logEntry.actorDisplayName||"APD Staff",createdAt:serverTimestamp()};
  for(const key of ["announcement","calendarEvent","suspectNames"]){ if(logEntry[key] !== undefined) record[key]=logEntry[key]; }
  batch.set(createdLog,record);
  addDeliveryJob(batch,createdLog,record);
  return createdLog;
}

export async function createPortalLog(logEntry){const batch=writeBatch(db);const ref=addPortalLog(batch,logEntry);await batch.commit();return ref;}

export async function logPortalAction(staffAccess, logEntry){
  if(!staffAccess?.user){
    return;
  }

  try{
    await createPortalLog({
      ...logEntry,
      actorUid:staffAccess.user.uid || "",
      actorEmail:staffAccess.user.email || "",
      actorDisplayName:staffAccess.role?.displayName || staffAccess.user.displayName || "APD Staff"
    });
  }catch(error){
    console.error("Portal log write failed:", error);
  }
}
