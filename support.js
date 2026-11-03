// support.js: customer chat with RouteWave support

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { renderBubbles } from "./chat-common.js";
import { uploadChatFile } from "./cloudinary.js";

const $ = (id) => document.getElementById(id);

const MAX_LENGTH = 1000;

let user = null;
let profile = null;
let unsubscribers = [];
let pendingFile = null;

$("logoutBtn").addEventListener("click", async () => {
  unsubscribers.forEach((u) => u());
  await signOut(auth);
  window.location.href = "customer-login.html";
});

onAuthStateChanged(auth, async (u) => {

  if (!u) {
    window.location.href = "customer-login.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", u.uid));

  if (!snap.exists()) {
    await signOut(auth);
    window.location.href = "customer-login.html";
    return;
  }

  user = u;
  profile = snap.data();

  $("userEmail").textContent = u.email || "-";
  document.documentElement.classList.remove("gate");

  unsubscribers.forEach((f) => f());
  unsubscribers = [];

  // Opening this page marks support replies as read
  unsubscribers.push(onSnapshot(doc(db, "chats", u.uid), (s) => {
    const d = s.data() || {};
    if ((d.customerUnread || 0) > 0) {
      updateDoc(s.ref, { customerUnread: 0 }).catch(console.error);
    }
  }, (error) => console.error(error)));

  // Live conversation
  unsubscribers.push(onSnapshot(
    query(collection(db, "chats", u.uid, "messages"), orderBy("createdAt", "asc")),
    (msgs) => renderBubbles($("chatBody"), msgs, "customer", "Send us a message to start the conversation."),
    (error) => {
      console.error(error);
      $("chatBody").innerHTML = `<p class="empty">Could not load messages.</p>`;
    }
  ));

});

// Choosing a file attaches it; it is sent with the next Send press
$("chatFile").addEventListener("change", () => {
  pendingFile = $("chatFile").files[0] || null;
  $("chatMsg").textContent = pendingFile
    ? `Ready to send: ${pendingFile.name}. Add a note or press Send.`
    : "";
});

$("chatForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  const input = $("chatInput");
  const fileInput = $("chatFile");
  const text = input.value.trim();
  const msg = $("chatMsg");
  const button = e.target.querySelector("button[type='submit']");

  msg.textContent = "";

  if (!user || (!text && !pendingFile)) return;

  if (text.length > MAX_LENGTH) {
    msg.textContent = `Please keep messages under ${MAX_LENGTH} characters.`;
    return;
  }

  const file = pendingFile;
  button.disabled = true;

  try {

    let attachment = null;

    if (file) {
      msg.textContent = `Uploading ${file.name}...`;
      attachment = await uploadChatFile(file);
    }

    await addDoc(collection(db, "chats", user.uid, "messages"), {
      text: text,
      from: "customer",
      senderEmail: user.email || "",
      createdAt: serverTimestamp(),
      ...(attachment ? { attachment } : {})
    });

    // Keep the conversation summary up to date and count the unread message for admins
    await setDoc(doc(db, "chats", user.uid), {
      customerUid: user.uid,
      customerName: profile.name || "",
      customerEmail: profile.email || user.email || "",
      trackingId: profile.trackingId || "",
      lastMessage: (text || `Attachment: ${attachment.name}`).slice(0, 140),
      lastAt: serverTimestamp(),
      adminUnread: increment(1)
    }, { merge: true });

    input.value = "";
    fileInput.value = "";
    pendingFile = null;
    msg.textContent = "";

  } catch (error) {
    console.error(error);
    msg.textContent = error.message;
  } finally {
    button.disabled = false;
  }

});
