// presence.js: online status, last seen and typing indicator.
// Loaded on every signed-in page. The page sets data-role="admin" or "customer".

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ROLE = document.querySelector('script[src$="presence.js"]')?.dataset.role || "customer";
const HEARTBEAT_MS = 25000;
const TYPING_REFRESH_MS = 3000;
const TYPING_IDLE_MS = 4000;

let user = null;
let timer = null;
let lastTypingWrite = 0;
let idleTimer = null;

function ref() {
  return doc(db, "presence", user.uid);
}

// Writes "I was seen now" while the page is visible, and when it is left
function beat() {
  if (!user) return;
  setDoc(ref(), {
    uid: user.uid,
    role: ROLE,
    lastSeen: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

onAuthStateChanged(auth, (u) => {
  user = u || null;
  clearInterval(timer);
  if (!user) return;
  beat();
  timer = setInterval(() => {
    if (document.visibilityState === "visible") beat();
  }, HEARTBEAT_MS);
});

document.addEventListener("visibilitychange", beat);
window.addEventListener("pagehide", () => {
  if (!user) return;
  setDoc(ref(), { lastSeen: serverTimestamp(), typingIn: null }, { merge: true }).catch(() => {});
});

// Called on each keystroke in a chat box
export function notifyTyping(chatUid) {
  if (!user) return;
  const now = Date.now();
  if (now - lastTypingWrite > TYPING_REFRESH_MS) {
    lastTypingWrite = now;
    setDoc(ref(), {
      uid: user.uid,
      role: ROLE,
      typingIn: chatUid,
      typingAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
  }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(stopTyping, TYPING_IDLE_MS);
}

export function stopTyping() {
  clearTimeout(idleTimer);
  lastTypingWrite = 0;
  if (!user) return;
  setDoc(ref(), { typingIn: null }, { merge: true }).catch(() => {});
}
