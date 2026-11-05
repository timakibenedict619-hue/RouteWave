// secure-chat.js: end-to-end encryption for the support chat. Runs only in the browser.
//
// - Each browser has its own key pair (ECDH P-256, Web Crypto). The private key is
//   stored in this browser's IndexedDB and never leaves it.
// - Each chat has one random AES-256 key. That key is locked (wrapped) separately
//   for every member device, so the server only holds locked copies.
// - Messages and attachments are encrypted with AES-GCM before they are sent.
//   The server stores ciphertext only.

import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const DB_NAME = "routewave-e2e";
const STORE = "identities";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_FILE = /\.(jpe?g|png|gif|webp|pdf|docx?|xlsx?|csv|txt|zip)$/i;

// ---------- base64 helpers ----------

export function b64(bytes) {
  const u = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

export function unb64(str) {
  const s = atob(str);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

function myUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Please sign in again.");
  return uid;
}

// ---------- device identity (IndexedDB) ----------

function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db2 = await openStore();
  return new Promise((resolve, reject) => {
    const r = db2.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key, value) {
  const db2 = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db2.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let identityCache = null;

// One identity per signed-in account in this browser
async function identity() {
  const uid = myUid();
  if (identityCache && identityCache.uid === uid) return identityCache;

  let saved = await idbGet("identity:" + uid);
  if (!saved) {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"]
    );
    const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
    saved = {
      deviceId: crypto.randomUUID(),
      privateKey: pair.privateKey,
      publicKey: b64(raw)
    };
    await idbSet("identity:" + uid, saved);
  }

  identityCache = { uid, ...saved };
  return identityCache;
}

// Publish this browser's public key so others can lock chat keys for it
export async function registerDevice(role) {
  const me = await identity();
  const ref = doc(db, "publicKeys", me.deviceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: me.uid,
      role: role,
      publicKey: me.publicKey,
      createdAt: serverTimestamp()
    });
  }
  return me;
}

export async function currentDeviceId() {
  return (await identity()).deviceId;
}

// ---------- key agreement ----------

const pubCache = new Map();

function importPublic(b64Key) {
  if (!pubCache.has(b64Key)) {
    pubCache.set(b64Key, crypto.subtle.importKey(
      "raw",
      unb64(b64Key),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    ));
  }
  return pubCache.get(b64Key);
}

// Shared AES key between my device and another device
async function pairKey(myPrivate, theirPublicB64) {
  const theirs = await importPublic(theirPublicB64);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirs },
    myPrivate,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ---------- per-chat key ----------

const keyCache = new Map(); // chat uid -> CryptoKey

// Devices that should hold the key: every admin device and the customer's devices
async function devicesFor(chatUid) {
  const [admins, customer] = await Promise.all([
    getDocs(query(collection(db, "publicKeys"), where("role", "==", "admin"))),
    getDocs(query(collection(db, "publicKeys"), where("uid", "==", chatUid)))
  ]);
  const map = new Map();
  admins.forEach((d) => map.set(d.id, { deviceId: d.id, ...d.data() }));
  customer.forEach((d) => map.set(d.id, { deviceId: d.id, ...d.data() }));
  return [...map.values()];
}

async function writeWrap(chatUid, me, rawKey, target) {
  const pair = await pairKey(me.privateKey, target.publicKey);
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, pair, rawKey);
  try {
    await setDoc(doc(db, "chats", chatUid, "keys", target.deviceId), {
      recipientUid: target.uid,
      senderDeviceId: me.deviceId,
      iv: b64(iv),
      wrapped: b64(wrapped),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    // Another member may have written this entry at the same moment
    console.warn("Key entry already exists for", target.deviceId, error);
  }
}

// Lock the chat key for every member device that does not have it yet
async function wrapForMissing(chatUid, me, key) {
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const [devices, existing] = await Promise.all([
    devicesFor(chatUid),
    getDocs(collection(db, "chats", chatUid, "keys"))
  ]);
  const have = new Set(existing.docs.map((d) => d.id));
  for (const device of devices) {
    if (!have.has(device.deviceId)) {
      await writeWrap(chatUid, me, rawKey, device);
    }
  }
}

// The chat key this device can read, or null if it has not received one yet
export async function getChatKey(chatUid) {

  const slot = myUid() + ":" + chatUid;
  if (keyCache.has(slot)) return keyCache.get(slot);

  const me = await identity();
  const snap = await getDoc(doc(db, "chats", chatUid, "keys", me.deviceId));
  if (!snap.exists()) return null;

  const wrap = snap.data();
  const sender = await getDoc(doc(db, "publicKeys", wrap.senderDeviceId));
  if (!sender.exists()) return null;

  const pair = await pairKey(me.privateKey, sender.data().publicKey);
  const rawKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(wrap.iv) },
    pair,
    unb64(wrap.wrapped)
  );

  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );

  keyCache.set(slot, key);
  return key;
}

// Make sure this chat has a key this device can use.
// - If we hold the key, lock it for any new member devices.
// - If nobody has a key yet, create one and lock it for everyone.
// - Otherwise return null and wait for a member to share it with us.
export async function ensureChatKey(chatUid) {

  const me = await identity();
  const key = await getChatKey(chatUid);

  if (key) {
    await wrapForMissing(chatUid, me, key);
    return key;
  }

  const existing = await getDocs(collection(db, "chats", chatUid, "keys"));
  if (!existing.empty) return null;

  const created = await crypto.subtle.importKey(
    "raw",
    randomBytes(32),
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );

  keyCache.set(myUid() + ":" + chatUid, created);
  await wrapForMissing(chatUid, me, created);
  return created;
}

// ---------- messages ----------

// Body shape: { body: "text", file: { name, type, size, url, key, iv } | null }
export async function encryptMessage(chatUid, key, content) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(chatUid) },
    key,
    encoder.encode(JSON.stringify(content))
  );
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptMessage(chatUid, key, data) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(data.iv), additionalData: encoder.encode(chatUid) },
    key,
    unb64(data.ct)
  );
  return JSON.parse(decoder.decode(plain));
}

// ---------- attachments ----------

export function checkChatFile(file) {
  if (!ALLOWED_FILE.test(file.name)) {
    throw new Error(`"${file.name}" is not a supported file type.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" is larger than 10 MB.`);
  }
}

// Encrypts a file with its own random key. The key travels inside the encrypted message.
export async function encryptFile(file) {
  const rawKey = randomBytes(32);
  const iv = randomBytes(12);
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await file.arrayBuffer());
  return {
    blob: new Blob([ct], { type: "application/octet-stream" }),
    key: b64(rawKey),
    iv: b64(iv)
  };
}

export async function decryptFile(url, keyB64, ivB64) {
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url || "")) {
    throw new Error("Unexpected file address.");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("This file could not be downloaded.");
  const ct = await res.arrayBuffer();
  const key = await crypto.subtle.importKey("raw", unb64(keyB64), { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB64) }, key, ct);
  return new Blob([plain]);
}
