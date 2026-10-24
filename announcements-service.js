import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import {addPortalLog} from "./portal-log-service.js";

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

export async function createAnnouncement(announcement){
  if(!auth.currentUser)throw Error("Sign in first.");
  const draft=announcement.publishState!=="published";
  const ref=announcement.id?doc(db,announcement.wasDraft?"announcementDrafts":"announcements",announcement.id):doc(collection(db,draft?"announcementDrafts":"announcements"));
  const publishedRef=announcement.wasDraft&&!draft?doc(collection(db,"announcements")):ref;
  const data={title:announcement.title||"",message:announcement.message||"",category:announcement.category||"General",author:announcement.author||"",priority:announcement.priority||"Normal",format:announcement.format||"plain",pingApd:announcement.pingApd!==false,roleIds:announcement.roleIds||[],destination:"default",publishState:announcement.publishState||"published",scheduledFor:announcement.scheduledFor||"",updatedByUid:auth.currentUser.uid,updatedAt:serverTimestamp()};
  if(!announcement.id||publishedRef!==ref){data.createdAt=serverTimestamp();data.createdByUid=auth.currentUser.uid;}
  if(announcement.id&&!announcement.wasDraft&&draft)throw Error("Existing public announcements cannot be converted into private drafts. Create a new draft instead.");
  const batch=writeBatch(db);batch.set(publishedRef,data,{merge:true});if(publishedRef!==ref)batch.delete(ref);addPortalLog(batch,{action:draft?'Announcement Draft Saved':announcement.id&&publishedRef===ref?'Announcement Updated':'Announcement Published',category:'Announcements',targetUid:publishedRef.id,targetLabel:data.title,message:'Saved announcement: '+data.title,announcement:data});await batch.commit();
  return {id:publishedRef.id,updated:!!announcement.id&&publishedRef===ref,draft};
}
export function subscribeToAnnouncementDrafts(onDrafts,onError){return onSnapshot(query(collection(db,"announcementDrafts"),orderBy("updatedAt","desc")),s=>onDrafts(s.docs.map(d=>({id:d.id,...d.data()}))),onError);}
export async function deleteAnnouncement(announcementId,announcement={}){const batch=writeBatch(db);batch.delete(doc(db,'announcements',announcementId));addPortalLog(batch,{action:'Announcement Deleted',category:'Announcements',targetUid:announcementId,targetLabel:announcement.title||announcementId,message:'Deleted announcement: '+(announcement.title||announcementId),announcement});await batch.commit();}
