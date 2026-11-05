// admin-support.js: admin inbox for customer chats

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
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
const MAX_RESULTS = 20;

let selectedUid = null;
let unsubMessages = null;
let listStarted = false;
let pendingFile = null;
let customers = null; // loaded once when the picker is first opened

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
    list.appendChild(el("p", "empty", "No conversations yet. Press New chat to message a customer."));
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
    item.appendChild(el("div", "preview", c.lastMessage || "No messages yet"));
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
    (msgs) => renderBubbles($("chatBody"), msgs, "admin", "No messages yet. Send the first message below."),
    (error) => console.error(error)
  );

}

// ---------- Start a chat with any customer ----------

async function loadCustomers() {
  if (customers) return customers;
  const snap = await getDocs(collection(db, "users"));
  customers = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  return customers;
}

function renderPicker(term) {

  const results = $("pickerResults");
  results.innerHTML = "";

  if (!customers) {
    results.appendChild(el("div", "picker-note", "Loading customers..."));
    return;
  }

  const q = term.trim().toLowerCase();

  const matches = customers
    .filter((c) => {
      if (!q) return true;
      return [c.name, c.email, c.trackingId]
        .some((value) => String(value || "").toLowerCase().includes(q));
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .slice(0, MAX_RESULTS);

  if (matches.length === 0) {
    results.appendChild(el("div", "picker-note",
      customers.length === 0 ? "No customers yet. Create one in Customers & Funding." : "No customer matches that search."));
    return;
  }

  matches.forEach((c) => {
    const item = el("button", "picker-item");
    item.type = "button";
    item.appendChild(el("div", "pname", c.name || "Unnamed customer"));
    item.appendChild(el("div", "psub", [c.trackingId, c.email].filter(Boolean).join(" · ")));
    item.addEventListener("click", () => startChatWith(c));
    results.appendChild(item);
  });

}

async function startChatWith(customer) {

  const msg = $("chatMsg");
  const ref = doc(db, "chats", customer.uid);

  try {

    // Create the conversation only if it does not exist yet
    let existing = await getDoc(ref);

    if (!existing.exists()) {
      await setDoc(ref, {
        customerUid: customer.uid,
        customerName: customer.name || "",
        customerEmail: customer.email || "",
        trackingId: customer.trackingId || "",
        lastMessage: "",
        lastAt: serverTimestamp(),
        adminUnread: 0,
        customerUnread: 0
      });
      existing = await getDoc(ref);
    }

    closePicker();
    openChat(customer.uid, existing.data());

  } catch (error) {
    console.error(error);
    msg.textContent = error.message;
  }

}

function openPicker() {
  $("pickerPanel").hidden = false;
  $("pickerSearch").value = "";
  $("pickerSearch").focus();
  renderPicker("");
  loadCustomers()
    .then(() => renderPicker($("pickerSearch").value))
    .catch((error) => {
      console.error(error);
      $("pickerResults").innerHTML = "";
      $("pickerResults").appendChild(el("div", "picker-note", "Could not load customers."));
    });
}

function closePicker() {
  $("pickerPanel").hidden = true;
}

$("newChatBtn").addEventListener("click", () => {
  if ($("pickerPanel").hidden) openPicker(); else closePicker();
});

$("pickerSearch").addEventListener("input", (e) => renderPicker(e.target.value));

// ---------- Sending ----------

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
