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

const resourcePostsCollection = collection(db, "resourcePosts");

export function subscribeToResourcePosts(onPosts, onError){
  const postsQuery = query(resourcePostsCollection, orderBy("createdAt", "desc"));

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

export function createResourcePost(post){
  return addDoc(resourcePostsCollection, {
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

export function deleteResourcePost(postId){
  return deleteDoc(doc(db, "resourcePosts", postId));
}
