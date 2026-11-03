// admin-support.js: admin inbox for customer chats

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { el, formatTime, renderBubbles } from "./chat-common.js";
import { uploadChatFile } from "./cloudinary.js";

const $ = (id) => document.getElementById(id);

const MAX_LENGTH = 1000;

let selectedUid = null;
let unsubMessages = null;
let listStarted = false;
let pendingFile = null;

// Conversation list, newest first
onAuthStateChanged(auth, (user) => {
  if (!user || listStarted) return;
  listStarted = true;
  onSnapshot(
    query(collection(db, "chats"), orderBy("lastAt", "desc")),
    renderList,
    (error) => console.error(error)
  );
});

function renderList(snap) {

  const list = $("chatList");
  list.innerHTML = "";

  if (snap.empty) {
    list.appendChild(el("p", "empty", "No customer messages yet."));
    return;
  }

  snap.forEach((d) => {

    const c = d.data();
    const item = el("button", "chat-item" + (d.id === selectedUid ? " active" : ""));
    item.type = "button";

    const row = el("div", "row");
    row.appendChild(el("span", "name", c.customerName || c.customerEmail || "Customer"));
    if ((c.adminUnread || 0) > 0) {
      row.appendChild(el("span", "unread-pill", String(c.adminUnread)));
    }

    item.appendChild(row);
    item.appendChild(el("div", "preview", c.lastMessage || ""));
    item.appendChild(el("div", "time", [c.trackingId, formatTime(c.lastAt)].filter(Boolean).join(" · ")));

    item.addEventListener("click", () => openChat(d.id, c));
    list.appendChild(item);

  });

}

function openChat(uid, c) {

  selectedUid = uid;

  $("chatEmpty").hidden = true;
  $("chatActive").hidden = false;
  $("chatName").textContent = c.customerName || "Customer";
  $("chatMeta").textContent = [c.trackingId, c.customerEmail].filter(Boolean).join(" · ");
  $("chatMsg").textContent = "";

  // Opening the conversation marks the customer's messages as read
  if ((c.adminUnread || 0) > 0) {
    updateDoc(doc(db, "chats", uid), { adminUnread: 0 }).catch(console.error);
  }

  if (unsubMessages) unsubMessages();

  unsubMessages = onSnapshot(
    query(collection(db, "chats", uid, "messages"), orderBy("createdAt", "asc")),
    (msgs) => renderBubbles($("chatBody"), msgs, "admin", "No messages yet."),
    (error) => console.error(error)
  );

}

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

  if (!text && !pendingFile) return;
  if (!selectedUid) return;

  if (text.length > MAX_LENGTH) {
    msg.textContent = `Please keep replies under ${MAX_LENGTH} characters.`;
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

    await addDoc(collection(db, "chats", selectedUid, "messages"), {
      text: text,
      from: "admin",
      senderEmail: auth.currentUser?.email || "",
      createdAt: serverTimestamp(),
      ...(attachment ? { attachment } : {})
    });

    // Update the summary and count the reply as unread for the customer
    await setDoc(doc(db, "chats", selectedUid), {
      lastMessage: (text || `Attachment: ${attachment.name}`).slice(0, 140),
      lastAt: serverTimestamp(),
      customerUnread: increment(1)
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
