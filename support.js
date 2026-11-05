// support.js: customer side of the RouteWave support chat.
// Messages and files are encrypted in this browser before they are sent.

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
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  renderThread,
  buildItems,
  acknowledge,
  sendSecure,
  watchRolePresence,
  freshest,
  headerStatus,
  typingNow,
  retryUntil,
  isVisible
} from "./chat-common.js";
import { registerDevice, ensureChatKey, checkChatFile } from "./secure-chat.js";
import { notifyTyping, stopTyping } from "./presence.js";

const $ = (id) => document.getElementById(id);

const MAX_LENGTH = 1000;

let user = null;
let profile = null;
let unsubscribers = [];
let stopKeyLoop = null;
let pendingFile = null;
let key = null;
let lastSnap = null;
let items = [];
let adminPresence = [];

function stopAll() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  if (stopKeyLoop) stopKeyLoop();
  stopKeyLoop = null;
}

$("logoutBtn").addEventListener("click", async () => {
  stopTyping();
  stopAll();
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

  stopAll();
  key = null;
  lastSnap = null;
  items = [];
  updateLock();

  // Publish this browser's key before asking for the chat key
  try {
    await registerDevice("customer");
  } catch (error) {
    console.error(error);
  }

  unsubscribers.push(watchRolePresence("admin", (list) => {
    adminPresence = list;
    renderStatus();
  }));

  // Opening this page marks support replies as read
  unsubscribers.push(onSnapshot(doc(db, "chats", u.uid), (s) => {
    const d = s.data() || {};
    if ((d.customerUnread || 0) > 0) {
      updateDoc(s.ref, { customerUnread: 0 }).catch(console.error);
    }
  }, (error) => console.error(error)));

  unsubscribers.push(onSnapshot(
    query(collection(db, "chats", u.uid, "messages"), orderBy("createdAt", "asc")),
    async (msgs) => {
      lastSnap = msgs;
      await renderMessages();
    },
    (error) => {
      console.error(error);
      $("chatBody").innerHTML = `<p class="wa-empty">Could not load messages.</p>`;
    }
  ));

  // Get the chat key, and keep trying until it is available
  stopKeyLoop = retryUntil(async () => {
    const k = await ensureChatKey(u.uid);
    if (k && k !== key) {
      key = k;
      updateLock();
      await renderMessages();
    }
    return false;
  }, 20000);

});

async function renderMessages() {
  if (!user || !lastSnap) return;
  items = await buildItems(lastSnap, { chatUid: user.uid, key, role: "customer" });
  renderThread($("chatBody"), items, "Send us a message to start the conversation.");
  acknowledge(user.uid, items, isVisible());
}

function renderStatus() {
  const typing = adminPresence.some((p) => typingNow(p, user?.uid));
  const status = headerStatus(freshest(adminPresence)?.lastSeen ?? null, typing);
  const node = $("chatStatus");
  node.textContent = status.text || "Support team";
  node.classList.toggle("online", status.online);
}

function updateLock() {
  $("lockText").textContent = key
    ? "Messages and files are end-to-end encrypted. Only you and RouteWave support can read them."
    : "Securing this chat. Messages appear here as soon as the key is ready.";
}

// When the page comes back into view, mark what is now on screen as read
document.addEventListener("visibilitychange", () => {
  if (isVisible() && user && items.length) acknowledge(user.uid, items, true);
});

// Choosing a file attaches it; it is sent with the next Send press
$("chatFile").addEventListener("change", () => {
  pendingFile = $("chatFile").files[0] || null;
  $("chatMsg").textContent = pendingFile ? `Ready to send: ${pendingFile.name}` : "";
});

$("chatInput").addEventListener("input", () => {
  if (!user) return;
  if ($("chatInput").value.trim()) notifyTyping(user.uid);
  else stopTyping();
});

$("chatInput").addEventListener("blur", () => stopTyping());

$("chatForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  const input = $("chatInput");
  const fileInput = $("chatFile");
  const msg = $("chatMsg");
  const button = $("sendBtn");
  const text = input.value.trim();
  const file = pendingFile;

  msg.textContent = "";

  if (!user || (!text && !file)) return;

  if (text.length > MAX_LENGTH) {
    msg.textContent = `Please keep messages under ${MAX_LENGTH} characters.`;
    return;
  }

  button.disabled = true;

  try {

    if (!key) key = await ensureChatKey(user.uid);
    if (!key) {
      msg.textContent = "This chat is still being secured. Please try again in a moment.";
      return;
    }

    if (file) {
      checkChatFile(file);
      msg.textContent = `Encrypting and uploading ${file.name}...`;
    }

    await sendSecure({
      chatUid: user.uid,
      key,
      role: "customer",
      senderUid: user.uid,
      text,
      file,
      unreadField: "adminUnread",
      summary: {
        customerUid: user.uid,
        customerName: profile.name || "",
        customerEmail: profile.email || user.email || "",
        trackingId: profile.trackingId || ""
      }
    });

    input.value = "";
    fileInput.value = "";
    pendingFile = null;
    msg.textContent = "";
    stopTyping();

  } catch (error) {
    console.error(error);
    msg.textContent = error.message;
  } finally {
    button.disabled = false;
  }

});
