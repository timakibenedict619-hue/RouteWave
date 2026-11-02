// my-dashboard.js: customer dashboard

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
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(Number(n || 0));

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

const shortDate = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleDateString() : "-";

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "customer-login.html";
});

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "customer-login.html";
    return;
  }

  const customerSnap = await getDoc(doc(db, "users", user.uid));

  if (!customerSnap.exists()) {
    await signOut(auth);
    window.location.href = "customer-login.html";
    return;
  }

  const me = customerSnap.data();

  $("welcomeName").textContent = me.name || me.email;
  $("myTrackingId").textContent = me.trackingId;
  $("myBalance").textContent = money(me.balance);

  loadTransactions(user.uid);
  loadShipments(me.trackingId);

});

async function loadTransactions(uid) {

  const list = $("transactionList");

  try {

    const snap = await getDocs(
      query(collection(db, "users", uid, "transactions"), orderBy("createdAt", "desc"))
    );

    if (snap.empty) {
      list.innerHTML = `<p class="muted">No transactions yet.</p>`;
      return;
    }

    list.innerHTML = snap.docs.map((d) => {
      const t = d.data();
      return `
        <div class="row">
          <div>
            <strong>+${money(t.amount)}</strong>
            <span class="muted"> · ${escapeHtml(t.note || "Funding")}</span>
          </div>
          <span class="muted">${shortDate(t.createdAt)}</span>
        </div>`;
    }).join("");

  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="muted">Could not load transactions.</p>`;
  }

}

async function loadShipments(trackingId) {

  const grid = $("shipmentGrid");

  try {

    const snap = await getDocs(
      query(collection(db, "shipments"), where("customerTrackingId", "==", trackingId))
    );

    const shipments = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    $("shipmentCount").textContent = shipments.length;

    if (shipments.length === 0) {
      grid.innerHTML = `<p class="muted">No shipments yet.</p>`;
      return;
    }

    grid.innerHTML = shipments.map((s) => {

      const photos = (s.photos || []).map((url) =>
        `<img src="${escapeHtml(url)}" alt="Shipment photo" loading="lazy">`
      ).join("");

      return `
        <div class="card">
          <div class="card-head">
            <strong>${escapeHtml(s.trackingId)}</strong>
            <span class="badge">${escapeHtml(s.status || "-")}</span>
          </div>
          <p class="muted">${escapeHtml(s.origin || "-")} → ${escapeHtml(s.destination || "-")}</p>
          <p class="muted">Current location: ${escapeHtml(s.currentLocation || "-")}</p>
          <p class="muted">Expected delivery: ${escapeHtml(s.expectedDelivery || "-")}</p>
          ${s.importantUpdate ? `<p class="update">${escapeHtml(s.importantUpdate)}</p>` : ""}
          ${photos ? `<div class="photos">${photos}</div>` : ""}
        </div>`;
    }).join("");

  } catch (error) {
    console.error(error);
    grid.innerHTML = `<p class="muted">Could not load shipments.</p>`;
  }

}
