// chat-common.js: shared helpers for the customer and admin chat.
// Rendering, presence, read receipts and sending. Encryption lives in secure-chat.js.

import { db } from "./firebase.js";

import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  encryptMessage,
  decryptMessage,
  encryptFile,
  decryptFile,
  checkChatFile,
  currentDeviceId
} from "./secure-chat.js";

import { uploadRawBlob } from "./cloudinary.js";

// Someone is online if they were seen in the last minute
export const ONLINE_WINDOW_MS = 60 * 1000;
const TYPING_WINDOW_MS = 6 * 1000;
const SAFE_URL = /^https:\/\/res\.cloudinary\.com\//;

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function isVisible() {
  return document.visibilityState === "visible";
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------- time and names ----------

export function toDate(ts) {
  return ts?.toDate ? ts.toDate() : null;
}

function ageMs(ts) {
  const d = toDate(ts);
  return d ? Date.now() - d.getTime() : 0;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function clock(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

// Short time for conversation lists: clock time today, date otherwise
export function shortTime(ts) {
  const d = toDate(ts);
  if (!d) return "";
  if (sameDay(d, new Date())) return clock(d);
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((w) => (w[0] || "").toUpperCase()).join("") || "?";
}

export function avatar(name, { online = false, size = "" } = {}) {
  const node = el("div", "wa-avatar" + (size ? " " + size : "") + (online ? " online" : ""));
  node.textContent = initials(name);
  return node;
}

// ---------- presence ----------

export function isOnline(lastSeen) {
  const d = toDate(lastSeen);
  return !!d && Date.now() - d.getTime() < ONLINE_WINDOW_MS;
}

// True when this presence record is typing in the given chat right now
export function typingNow(p, chatUid) {
  return !!p && p.typingIn === chatUid && ageMs(p.typingAt) < TYPING_WINDOW_MS;
}

export function lastSeenText(lastSeen) {
  const d = toDate(lastSeen);
  if (!d) return "";
  if (isOnline(lastSeen)) return "online";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, new Date())) return `last seen today at ${clock(d)}`;
  if (sameDay(d, yesterday)) return `last seen yesterday at ${clock(d)}`;
  return `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })} at ${clock(d)}`;
}

// Text and online flag for a chat header
export function headerStatus(lastSeen, typing) {
  if (typing) return { text: "typing…", online: true };
  if (!toDate(lastSeen)) return { text: "", online: false };
  return { text: lastSeenText(lastSeen), online: isOnline(lastSeen) };
}

// The record seen most recently, for a team with several admins
export function freshest(list) {
  let best = null;
  let bestTime = -Infinity;
  for (const p of list) {
    const d = toDate(p.lastSeen);
    const t = d ? d.getTime() : 0;
    if (t > bestTime) {
      best = p;
      bestTime = t;
    }
  }
  return best;
}

// Live presence for one account
export function watchPresence(uid, cb) {
  return onSnapshot(doc(db, "presence", uid),
    (s) => cb(s.exists() ? s.data() : null),
    (error) => console.error(error));
}

// Live presence for every account with a role ("admin" or "customer"); each has an id
export function watchRolePresence(role, cb) {
  return onSnapshot(query(collection(db, "presence"), where("role", "==", role)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => console.error(error));
}

// ---------- rendering ----------

function fileIcon(name = "") {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "fa-file-pdf";
  if (/\.(xlsx?|csv)$/.test(n)) return "fa-file-excel";
  if (/\.docx?$/.test(n)) return "fa-file-word";
  if (n.endsWith(".zip")) return "fa-file-zipper";
  if (/\.(jpe?g|png|gif|webp)$/.test(n)) return "fa-file-image";
  return "fa-file-lines";
}

async function downloadAttachment(file, card) {
  const sizeNode = card.querySelector(".wa-file-size");
  const original = sizeNode.textContent;
  card.disabled = true;
  sizeNode.textContent = "Decrypting...";
  try {
    const blob = await decryptFile(file.url, file.key, file.iv);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = file.name || "file";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    sizeNode.textContent = original;
  } catch (error) {
    console.error(error);
    sizeNode.textContent = error.message || "Could not download";
  } finally {
    card.disabled = false;
  }
}

function fileCard(file) {
  const card = el("button", "wa-file");
  card.type = "button";
  card.title = "Download";
  card.appendChild(el("i", "fa-solid " + fileIcon(file.name)));
  const info = el("span", "wa-file-info");
  info.appendChild(el("span", "wa-file-name", file.name || "File"));
  info.appendChild(el("span", "wa-file-size", formatSize(file.size)));
  card.appendChild(info);
  card.addEventListener("click", () => downloadAttachment(file, card));
  return card;
}

function legacyLink(att) {
  const link = el("a", "wa-file");
  link.href = SAFE_URL.test(att.url || "") ? att.url : "#";
  link.target = "_blank";
  link.rel = "noopener";
  link.appendChild(el("i", "fa-solid " + fileIcon(att.name)));
  const info = el("span", "wa-file-info");
  info.appendChild(el("span", "wa-file-name", att.name || "File"));
  info.appendChild(el("span", "wa-file-size", formatSize(att.size)));
  link.appendChild(info);
  return link;
}

function ticks(m) {
  if (!m.createdAt) return el("span", "wa-ticks", "✓");
  const node = el("span", "wa-ticks" + (m.read ? " read" : ""));
  node.textContent = m.delivered ? "✓✓" : "✓";
  node.title = m.read ? "Read" : m.delivered ? "Delivered" : "Sent";
  return node;
}

function bubble(m) {
  const row = el("div", "wa-row " + (m.mine ? "out" : "in"));
  const b = el("div", "wa-bubble");

  if (m.legacyAtt) b.appendChild(legacyLink(m.legacyAtt));
  if (m.body?.file) b.appendChild(fileCard(m.body.file));
  if (m.body?.text) b.appendChild(el("div", "wa-text", m.body.text));
  if (m.legacy) b.appendChild(el("div", "wa-note", "Sent before end-to-end encryption was turned on"));
  if (m.error) b.appendChild(el("div", "wa-note", m.error));

  const meta = el("div", "wa-meta");
  meta.appendChild(el("span", "", m.createdAt ? clock(m.createdAt) : ""));
  if (m.mine && !m.legacy) meta.appendChild(ticks(m));
  b.appendChild(meta);

  row.appendChild(b);
  return row;
}

// Draw the conversation. Messages from `mine` side sit on the right.
export function renderThread(container, items, emptyText) {

  // Keep the reader's place if they scrolled up
  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;

  container.innerHTML = "";

  if (items.length === 0) {
    container.appendChild(el("p", "wa-empty", emptyText));
    return;
  }

  let lastDay = "";
  for (const m of items) {
    if (m.createdAt) {
      const label = dayLabel(m.createdAt);
      if (label !== lastDay) {
        container.appendChild(el("div", "wa-day", label));
        lastDay = label;
      }
    }
    container.appendChild(bubble(m));
  }

  if (nearBottom) container.scrollTop = container.scrollHeight;
}

// ---------- reading messages ----------

// Decrypted bodies by message id. Keys are random, so a body never changes.
const bodyCache = new Map();

// Turn a Firestore snapshot into display items, decrypting with `key` when present
export async function buildItems(snap, { chatUid, key, role }) {
  const out = [];
  for (const d of snap.docs) {
    const data = d.data();
    const base = {
      id: d.id,
      mine: data.from === role,
      createdAt: toDate(data.createdAt),
      delivered: !!data.deliveredAt,
      read: !!data.readAt
    };

    if (typeof data.ct === "string") {
      if (bodyCache.has(d.id)) {
        out.push({ ...base, body: bodyCache.get(d.id) });
        continue;
      }
      if (!key) {
        out.push({ ...base, body: null, error: "🔒 Waiting for this chat's key" });
        continue;
      }
      try {
        const body = await decryptMessage(chatUid, key, data);
        bodyCache.set(d.id, body);
        out.push({ ...base, body });
      } catch (error) {
        console.warn("Could not decrypt", d.id, error);
        out.push({ ...base, body: null, error: "🔒 This message cannot be read on this device" });
      }
    } else {
      // Messages written before encryption existed are plain text
      out.push({
        ...base,
        legacy: true,
        body: { text: data.text || "", file: null },
        legacyAtt: data.attachment || null
      });
    }
  }
  return out;
}

// Mark the other side's messages as delivered (and read, when the chat is on screen)
const sentReceipts = new Set();

export function acknowledge(chatUid, items, read) {
  for (const m of items) {
    if (m.mine || m.legacy) continue;

    if (!m.delivered && !sentReceipts.has(m.id + ":d")) {
      sentReceipts.add(m.id + ":d");
      updateDoc(doc(db, "chats", chatUid, "messages", m.id), { deliveredAt: serverTimestamp() })
        .catch(() => sentReceipts.delete(m.id + ":d"));
    }

    if (read && !m.read && !sentReceipts.has(m.id + ":r")) {
      sentReceipts.add(m.id + ":r");
      updateDoc(doc(db, "chats", chatUid, "messages", m.id), { readAt: serverTimestamp() })
        .catch(() => sentReceipts.delete(m.id + ":r"));
    }
  }
}

// ---------- sending ----------

// Encrypt and store one message, then update the conversation summary.
// `role` is "customer" or "admin"; `unreadField` is the counter the other side reads.
export async function sendSecure({ chatUid, key, role, senderUid, text, file, unreadField, summary = {} }) {

  let attachment = null;
  if (file) {
    checkChatFile(file);
    const enc = await encryptFile(file);
    const url = await uploadRawBlob(enc.blob);
    attachment = {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      url,
      key: enc.key,
      iv: enc.iv
    };
  }

  // The text, file name and file key are all inside the ciphertext
  const payload = await encryptMessage(chatUid, key, { body: text, file: attachment });
  const deviceId = await currentDeviceId();

  await addDoc(collection(db, "chats", chatUid, "messages"), {
    v: 2,
    iv: payload.iv,
    ct: payload.ct,
    from: role,
    senderUid,
    senderDeviceId: deviceId,
    createdAt: serverTimestamp(),
    deliveredAt: null,
    readAt: null
  });

  await setDoc(doc(db, "chats", chatUid), {
    ...summary,
    lastMessage: attachment ? "🔒 Attachment" : "🔒 Encrypted message",
    lastAt: serverTimestamp(),
    [unreadField]: increment(1)
  }, { merge: true });
}

// ---------- background work ----------

// Run task now and then every `ms`, until task returns true or the returned stop function is called
export function retryUntil(task, ms) {
  let stopped = false;
  let timer = null;
  const run = async () => {
    if (stopped) return;
    try {
      if (await task()) return;
    } catch (error) {
      console.warn(error);
    }
    if (!stopped) timer = setTimeout(run, ms);
  };
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
