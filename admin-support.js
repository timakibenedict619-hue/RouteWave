// admin-support.js: admin side of the customer chat.
// Messages and files are encrypted in this browser before they are sent.

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
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  el,
  avatar,
  initials,
  shortTime,
  isOnline,
  renderThread,
  buildItems,
  acknowledge,
  sendSecure,
  watchRolePresence,
  headerStatus,
  typingNow,
  retryUntil,
  isVisible
} from "./chat-common.js";
import { registerDevice, ensureChatKey, checkChatFile } from "./secure-chat.js";
import { notifyTyping, stopTyping } from "./presence.js";

const $ = (id) => document.getElementById(id);

const MAX_LENGTH = 1000;
const MAX_RESULTS = 20;

let selectedUid = null;
let selected = null;        // summary of the open conversation
let key = null;             // chat key for selectedUid
let lastSnap = null;
let items = [];
let unsubMessages = null;
let stopKeyLoop = null;
let listStarted = false;
let pendingFile = null;
let customers = null;       // loaded once when the picker is first opened
let chatsSnap = null;
let customerPresence = new Map();

// Conversation list and customer presence
onAuthStateChanged(auth, async (user) => {

  if (!user || listStarted) return;
  listStarted = true;

  try {
    await registerDevice("admin");
  } catch (error) {
    console.error(error);
  }

  onSnapshot(
    query(collection(db, "chats"), orderBy("lastAt", "desc")),
    (snap) => {
      chatsSnap = snap;
      renderList();
      renderHeader();
    },
    (error) => console.error(error)
  );

  watchRolePresence("customer", (list) => {
    customerPresence = new Map(list.map((p) => [p.id, p]));
    renderList();
    renderHeader();
  });

  // Refresh "last seen" wording once a minute
  setInterval(() => {
    renderList();
    renderHeader();
  }, 60000);

});

function renderList() {

  const list = $("chatList");
  list.innerHTML = "";

  if (!chatsSnap) return;

  if (chatsSnap.empty) {
    list.appendChild(el("p", "empty", "No conversations yet. Press New chat to message a customer."));
    return;
  }

  chatsSnap.forEach((d) => {

    const c = d.data();
    const name = c.customerName || c.customerEmail || "Customer";
    const presence = customerPresence.get(d.id);

    const item = el("button", "wa-item" + (d.id === selectedUid ? " active" : ""));
    item.type = "button";

    item.appendChild(avatar(name, { online: isOnline(presence?.lastSeen), size: "sm" }));

    const body = el("div", "wa-item-body");

    const top = el("div", "wa-item-top");
    top.appendChild(el("span", "wa-item-name", name));
    top.appendChild(el("span", "wa-item-time", shortTime(c.lastAt)));
    body.appendChild(top);

    const bottom = el("div", "wa-item-bottom");
    bottom.appendChild(el("span", "wa-item-preview", c.lastMessage || "No messages yet"));
    if ((c.adminUnread || 0) > 0) {
      bottom.appendChild(el("span", "wa-count", String(c.adminUnread)));
    }
    body.appendChild(bottom);

    item.appendChild(body);
    item.addEventListener("click", () => openChat(d.id, c));
    list.appendChild(item);

  });

}

function renderHeader() {
  if (!selectedUid) return;
  const p = customerPresence.get(selectedUid);
  const status = headerStatus(p?.lastSeen ?? null, typingNow(p, selectedUid));
  const node = $("chatStatus");
  node.textContent = status.text;
  node.classList.toggle("online", status.online);
}

function updateLock() {
  $("lockText").textContent = key
    ? "End-to-end encrypted. Messages and files can be read only on signed-in team and customer devices."
    : "Waiting for this chat's key. It appears here automatically once a device that holds it shares it.";
}

function stopThread() {
  if (unsubMessages) unsubMessages();
  unsubMessages = null;
  if (stopKeyLoop) stopKeyLoop();
  stopKeyLoop = null;
}

function openChat(uid, c) {

  selectedUid = uid;
  selected = c;

  const name = c.customerName || c.customerEmail || "Customer";
  $("chatEmpty").hidden = true;
  $("chatActive").hidden = false;
  $("chatName").textContent = name;
  $("chatAvatar").textContent = initials(name);
  $("chatMeta").textContent = [c.trackingId, c.customerEmail].filter(Boolean).join(" · ");
  $("chatMsg").textContent = "";

  // Opening the conversation marks the customer's messages as read
  if ((c.adminUnread || 0) > 0) {
    updateDoc(doc(db, "chats", uid), { adminUnread: 0 }).catch(console.error);
  }

  stopThread();
  key = null;
  lastSnap = null;
  items = [];
  updateLock();
  renderHeader();

  unsubMessages = onSnapshot(
    query(collection(db, "chats", uid, "messages"), orderBy("createdAt", "asc")),
    async (msgs) => {
      lastSnap = msgs;
      await renderMessages();
    },
    (error) => console.error(error)
  );

  // Get this chat's key, and keep trying until it is available
  stopKeyLoop = retryUntil(async () => {
    const k = await ensureChatKey(uid);
    if (uid !== selectedUid) return true;
    if (k && k !== key) {
      key = k;
      updateLock();
      await renderMessages();
    }
    return false;
  }, 20000);

  renderList();

}

async function renderMessages() {
  const uid = selectedUid;
  if (!uid || !lastSnap) return;
  const built = await buildItems(lastSnap, { chatUid: uid, key, role: "admin" });
  if (uid !== selectedUid) return; // the reader has moved to another chat
  items = built;
  renderThread($("chatBody"), items, "No messages yet. Send the first message below.");
  acknowledge(uid, items, isVisible());
}

document.addEventListener("visibilitychange", () => {
  if (isVisible() && selectedUid && items.length) acknowledge(selectedUid, items, true);
});

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
  $("chatMsg").textContent = pendingFile ? `Ready to send: ${pendingFile.name}` : "";
});

$("chatInput").addEventListener("input", () => {
  if (!selectedUid) return;
  if ($("chatInput").value.trim()) notifyTyping(selectedUid);
  else stopTyping();
});

$("chatInput").addEventListener("blur", () => stopTyping());

$("chatForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  const uid = selectedUid;
  if (!uid) return;

  const input = $("chatInput");
  const fileInput = $("chatFile");
  const msg = $("chatMsg");
  const button = $("sendBtn");
  const text = input.value.trim();
  const file = pendingFile;

  msg.textContent = "";

  if (!text && !file) return;

  if (text.length > MAX_LENGTH) {
    msg.textContent = `Please keep replies under ${MAX_LENGTH} characters.`;
    return;
  }

  button.disabled = true;

  try {

    const k = key || await ensureChatKey(uid);
    if (uid === selectedUid && !key) key = k;

    if (!k) {
      msg.textContent = "This chat is still waiting for its key. Ask the customer to sign in on their device, then try again.";
      return;
    }

    if (file) {
      checkChatFile(file);
      msg.textContent = `Encrypting and uploading ${file.name}...`;
    }

    await sendSecure({
      chatUid: uid,
      key: k,
      role: "admin",
      senderUid: auth.currentUser.uid,
      text,
      file,
      unreadField: "customerUnread",
      summary: {}
    });

    if (uid === selectedUid) {
      input.value = "";
      fileInput.value = "";
      pendingFile = null;
      msg.textContent = "";
    }
    stopTyping();

  } catch (error) {
    console.error(error);
    msg.textContent = error.message;
  } finally {
    button.disabled = false;
  }

});
