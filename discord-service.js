import { collection, doc, onSnapshot, query, where, limit, serverTimestamp, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
export function addDeliveryJob(batch, logRef, entry){
  const ref=doc(collection(db,"discordJobs"));
  batch.set(ref,{kind:"activity",logId:logRef.id,actorUid:auth.currentUser.uid,category:entry.category,targetUid:entry.targetUid||"",status:"pending",attempts:0,createdAt:serverTimestamp()});
  return ref;
}
export async function requestDiscordAction(kind,payload={}){
  if(!auth.currentUser) throw Error("Sign in first.");
  const ref=doc(collection(db,"discordJobs"));
  await setDoc(ref,{kind,payload,actorUid:auth.currentUser.uid,status:"pending",attempts:0,createdAt:serverTimestamp()});
  return ref.id;
}
export function watchMyDeliveries(onJobs,onError){
  if(!auth.currentUser) return ()=>{};
  return onSnapshot(query(collection(db,"discordJobs"),where("actorUid","==",auth.currentUser.uid),limit(30)),s=>onJobs(s.docs.map(d=>({id:d.id,...d.data()}))),onError);
}
export function watchBotStatus(onStatus,onError){ return onSnapshot(doc(db,"botStatus","main"),s=>onStatus(s.exists()?s.data():null),onError); }
export async function createLinkCode(){
  if(!auth.currentUser) throw Error("Sign in first.");
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  const code=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code))),b=>b.toString(16).padStart(2,"0")).join("");
  const {Timestamp}=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  await setDoc(doc(db,"discordLinkCodes",hash),{uid:auth.currentUser.uid,createdAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+5*60*1000),used:false});
  return code;
}
