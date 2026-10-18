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
  return onAuthStateChanged(auth, async user => {
    if(!user){
      onChange({
        user:null,
        role:null,
        canEdit:false
      });
      return;
    }

    const role = await getStaffRole(user.uid);

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
