import {
  addDoc,
  collection,
  doc,
  getDocs,
  writeBatch,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase-config.js";

const cidCasesCollection = collection(db, "cidCases");

export function subscribeToCidCases(onCases, onError){
  const casesQuery = query(cidCasesCollection, orderBy("updatedAt", "desc"));

  return onSnapshot(
    casesQuery,
    snapshot => {
      const cases = snapshot.docs.map(documentSnapshot => ({
        id:documentSnapshot.id,
        ...documentSnapshot.data()
      }));

      onCases(cases);
    },
    onError
  );
}

export function subscribeToCaseNarratives(caseId, onNarratives, onError){
  const narrativesQuery = query(
    collection(db, "cidCases", caseId, "narratives"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    narrativesQuery,
    snapshot => {
      const narratives = snapshot.docs.map(documentSnapshot => ({
        id:documentSnapshot.id,
        ...documentSnapshot.data()
      }));

      onNarratives(narratives);
    },
    onError
  );
}

export async function createCidCase(caseData, staffAccess){
  const createdCase = await addDoc(cidCasesCollection, {
    caseNumber:caseData.caseNumber || generatedCaseNumber(),
    subjectName:caseData.subjectName || "",
    subjectIdentifiers:caseData.subjectIdentifiers || "",
    status:caseData.status || "Open",
    priority:caseData.priority || "Standard",
    leadInvestigator:caseData.leadInvestigator || "",
    summary:caseData.summary || "",
    media:caseData.media || [],
    createdBy:staffAccess.user?.email || "",
    createdByUid:staffAccess.user?.uid || "",
    updatedBy:staffAccess.user?.email || "",
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });

  await addCaseNarrative(createdCase.id, {
    title:"Initial Narrative",
    body:caseData.narrative || ""
  }, staffAccess);

  return createdCase;
}

export async function addCaseNarrative(caseId, narrative, staffAccess){
  await addDoc(collection(db, "cidCases", caseId, "narratives"), {
    title:narrative.title || "Case Narrative",
    body:narrative.body || "",
    author:staffAccess.user?.email || "",
    authorUid:staffAccess.user?.uid || "",
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });

  return updateDoc(doc(db, "cidCases", caseId), {
    updatedBy:staffAccess.user?.email || "",
    updatedAt:serverTimestamp()
  });
}

export async function deleteCidCase(caseId){
  if(!caseId) throw new Error("No CID case selected.");
  const narratives = await getDocs(collection(db, "cidCases", caseId, "narratives"));
  // Keep the case and its narratives in one commit: failure deletes nothing.
  if(narratives.size > 499) throw new Error("This case has too many narratives for a single deletion. Contact the portal owner.");
  const batch = writeBatch(db);
  narratives.docs.forEach(narrative => batch.delete(narrative.ref));
  batch.delete(doc(db, "cidCases", caseId));
  await batch.commit();
}

function generatedCaseNumber(){
  const now = new Date();
  const dateKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");

  return `CID-${dateKey}-${String(now.getTime()).slice(-5)}`;
}
