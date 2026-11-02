// my-dashboard.js: live customer dashboard

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { formatMoney } from "./currencies.js";

import {
  doc,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

// Firestore timestamp → seconds (0 when missing)
const secs = (ts) => ts?.seconds || 0;

const when = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleString() : "";

// Time of a tracking history entry, in ms
const historyTime = (h) =>
  h.at || Date.parse(`${h.date || ""} ${h.time || ""}`) || 0;

let unsubscribers = [];
let shipmentsStarted = false;

$("logoutBtn").addEventListener("click", async () => {
  unsubscribers.forEach((u) => u());
  await signOut(auth);
  window.location.href = "customer-login.html";
});

onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "customer-login.html";
    return;
  }

  $("userEmail").textContent = user.email || "-";

  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  shipmentsStarted = false;

  // Profile + balance (updates when admin funds or withdraws)
  unsubscribers.push(onSnapshot(doc(db, "users", user.uid), (snap) => {

    if (!snap.exists()) {
      signOut(auth).then(() => (window.location.href = "customer-login.html"));
      return;
    }

    const me = snap.data();

    // Confirmed customer: show the page
    document.documentElement.classList.remove("gate");

    $("welcomeName").textContent = me.name || me.email;
    $("myTrackingId").textContent = me.trackingId;
    $("myBalance").textContent = formatMoney(me.balance, me.currency || "USD");

    if (!shipmentsStarted && me.trackingId) {
      shipmentsStarted = true;
      listenToShipments(me.trackingId);
    }

  }));

});

// Shipments (updates live when admin adds or edits)
function listenToShipments(trackingId) {

  unsubscribers.push(onSnapshot(
    query(collection(db, "shipments"), where("trackingId", "==", trackingId)),
    (snap) => {

      const shipments = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          Math.max(secs(b.updatedAt), secs(b.createdAt)) -
          Math.max(secs(a.updatedAt), secs(a.createdAt))
        );

      $("shipmentCount").textContent = shipments.length;

      renderMessages(shipments);
      renderShipments(shipments);
      renderHistory(shipments);

    },
    (error) => {
      console.error(error);
      $("shipmentGrid").innerHTML = `<p class="empty">Could not load shipments.</p>`;
    }
  ));

}

// Messages: important updates from RouteWave, newest first
function renderMessages(shipments) {

  const messages = shipments
    .filter((s) => s.importantUpdate)
    .map((s) => ({
      trackingId: s.trackingId,
      text: s.importantUpdate,
      time: Math.max(secs(s.updatedAt), secs(s.createdAt)),
      when: when(s.updatedAt || s.createdAt)
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 10);

  $("messageList").innerHTML = messages.length
    ? messages.map((m) => `
        <div class="list-row" style="display:block">
          <div class="muted" style="font-size:13px">${esc(m.trackingId)} · ${esc(m.when)}</div>
          <div class="note" style="margin-top:8px">${esc(m.text)}</div>
        </div>`).join("")
    : `<p class="empty">No messages yet.</p>`;

}

// Shipment cards: details, description, items, photos
function renderShipments(shipments) {

  const grid = $("shipmentGrid");

  if (shipments.length === 0) {
    grid.innerHTML = `<div class="card"><p class="empty">No shipments yet.</p></div>`;
    return;
  }

  grid.innerHTML = shipments.map((s) => {

    const items = (s.items || []).length
      ? `<div class="table-wrap"><table class="items-table">
           <thead><tr><th>Item</th><th>Qty</th><th>Notes</th></tr></thead>
           <tbody>${s.items.map((i) => `
             <tr>
               <td>${esc(i.name)}</td>
               <td>${esc(i.quantity)}</td>
               <td>${esc(i.notes || "-")}</td>
             </tr>`).join("")}
           </tbody>
         </table></div>`
      : `<p class="muted">No items listed.</p>`;

    const photos = (s.photos || []).length
      ? `<div class="photo-grid">${s.photos.map((url) =>
          `<img src="${esc(url)}" alt="Shipment photo" loading="lazy">`).join("")}</div>`
      : "";

    return `
      <div class="card shipment-card">
        <div class="shipment-head">
          <div>
            <div class="id">${esc(s.trackingId)}</div>
            <div class="muted" style="font-size:13px">${esc(s.carrier || "")}</div>
          </div>
          <span class="badge">${esc(s.status || "-")}</span>
        </div>

        <div class="route">
          <span>${esc(s.origin || "-")}</span><i class="fa-solid fa-arrow-right"></i><span>${esc(s.destination || "-")}</span>
        </div>

        <div class="meta-grid">
          <div><div class="k">Current location</div><div class="v">${esc(s.currentLocation || "-")}</div></div>
          <div><div class="k">Expected delivery</div><div class="v">${esc(s.expectedDelivery || "-")}</div></div>
          <div><div class="k">Weight</div><div class="v">${esc(s.weight || "-")}</div></div>
        </div>

        ${s.description ? `<p>${esc(s.description)}</p>` : ""}

        <div>
          <div class="k" style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Items</div>
          ${items}
        </div>

        ${photos ? `<div><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Photos</div>${photos}</div>` : ""}
      </div>`;

  }).join("");

}

// Tracking history, shown last on the page, one block per shipment
function renderHistory(shipments) {

  const withHistory = shipments.filter((s) => (s.trackingHistory || []).length);

  if (withHistory.length === 0) {
    $("historyList").innerHTML = `<div class="card"><p class="empty">No tracking history yet.</p></div>`;
    return;
  }

  $("historyList").innerHTML = withHistory.map((s) => {

    const entries = [...s.trackingHistory]
      .sort((a, b) => historyTime(b) - historyTime(a))
      .map((h) => `
        <li>
          <div class="t-title">${esc(h.status || "-")}</div>
          <div class="t-meta">${esc(h.location || "-")} · ${esc(h.date || "")} ${esc(h.time || "")}</div>
        </li>`).join("");

    return `
      <div class="card">
        <div class="shipment-head" style="margin-bottom:14px">
          <div>
            <div class="id">${esc(s.trackingId)}</div>
            <div class="muted" style="font-size:13px">${esc(s.origin || "-")} → ${esc(s.destination || "-")}</div>
          </div>
          <span class="badge">${esc(s.status || "-")}</span>
        </div>
        <ul class="timeline">${entries}</ul>
      </div>`;

  }).join("");

}
