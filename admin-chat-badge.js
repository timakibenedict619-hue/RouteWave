// admin-chat-badge.js: admins see how many customer messages are unread

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { setBadge } from "./chat-common.js";

let unsub = null;

onAuthStateChanged(auth, (user) => {

  if (unsub) {
    unsub();
    unsub = null;
  }

  if (!user) return;

  unsub = onSnapshot(
    query(collection(db, "chats"), where("adminUnread", ">", 0)),
    (snap) => {
      let total = 0;
      snap.forEach((d) => { total += Number(d.data().adminUnread || 0); });
      setBadge("adminChatBadge", total);
    },
    (error) => console.error(error)
  );

});
