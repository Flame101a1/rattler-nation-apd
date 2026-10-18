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

const trainingReferenceCollection = collection(db, "trainingReferencePosts");

export function subscribeToTrainingReferences(onPosts, onError){
  const postsQuery = query(trainingReferenceCollection, orderBy("createdAt", "desc"));

  return onSnapshot(
    postsQuery,
    snapshot => {
      const posts = snapshot.docs.map(documentSnapshot => ({
        id:documentSnapshot.id,
        ...documentSnapshot.data()
      }));

      onPosts(posts);
    },
    error => {
      if(onError){
        onError(error);
      }
    }
  );
}

export function createTrainingReference(post){
  return addDoc(trainingReferenceCollection, {
    title:post.title || "",
    category:post.category || "General",
    summary:post.summary || "",
    content:post.content || "",
    resourceUrl:post.resourceUrl || "",
    author:post.author || "",
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}

export function deleteTrainingReference(postId){
  return deleteDoc(doc(db, "trainingReferencePosts", postId));
}
