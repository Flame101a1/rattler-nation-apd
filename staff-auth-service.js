import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

export function watchStaffAuth(onChange){
  let generation = 0;
  return onAuthStateChanged(auth, async user => {
    const current = ++generation;
    if(!user){
      onChange({
        user:null,
        role:null,
        canEdit:false
      });
      return;
    }

    let role = null;
    try{
      role = await getStaffRole(user.uid);
    }catch(error){
      console.error("Staff permissions could not be loaded:", error);
    }
    if(current !== generation) return;

    onChange({
      user,
      role,
      canEdit:Boolean(role?.calendarEditor || role?.admin)
    });
  });
}

export function signInStaff(email, password){
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutStaff(){
  return signOut(auth);
}

async function getStaffRole(uid){
  const roleSnapshot = await getDoc(doc(db, "userRoles", uid));

  if(!roleSnapshot.exists()){
    return null;
  }

  return roleSnapshot.data();
}
