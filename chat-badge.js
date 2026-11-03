// chat-badge.js: customer sees how many replies from support are unread

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
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
    doc(db, "chats", user.uid),
    (snap) => setBadge("customerChatBadge", snap.data()?.customerUnread || 0),
    (error) => console.error(error)
  );

});
