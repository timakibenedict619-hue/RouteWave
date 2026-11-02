// my-dashboard.js: live customer dashboard

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(Number(n || 0));

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

// Firestore timestamp → seconds (works for missing values)
const secs = (ts) => ts?.seconds || 0;

const when = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleString() : "";

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

  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  shipmentsStarted = false;

  // Customer profile + balance (updates when admin funds the account)
  unsubscribers.push(onSnapshot(doc(db, "users", user.uid), (snap) => {

    if (!snap.exists()) {
      signOut(auth).then(() => (window.location.href = "customer-login.html"));
      return;
    }

    const me = snap.data();

    $("welcomeName").textContent = me.name || me.email;
    $("myTrackingId").textContent = me.trackingId;
    $("myBalance").textContent = money(me.balance);

    // Start shipments once we know the tracking ID
    if (!shipmentsStarted && me.trackingId) {
      shipmentsStarted = true;
      listenToShipments(me.trackingId);
    }

  }));

  // Funding history (updates when admin adds funds)
  unsubscribers.push(onSnapshot(
    query(collection(db, "users", user.uid, "transactions"), orderBy("createdAt", "desc")),
    (snap) => renderTransactions(snap.docs.map((d) => d.data()))
  ));

});

// Shipments, items, descriptions, updates (updates when admin adds or edits)
function listenToShipments(trackingId) {

  unsubscribers.push(onSnapshot(
    query(collection(db, "shipments"), where("customerTrackingId", "==", trackingId)),
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

    },
    (error) => {
      console.error(error);
      $("shipmentGrid").innerHTML = `<p class="muted">Could not load shipments.</p>`;
    }
  ));

}

// Messages: important updates from the admin, newest first
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
        <div class="row" style="display:block">
          <div class="muted">${esc(m.trackingId)} · ${esc(m.when)}</div>
          <div class="update" style="margin-top:6px">${esc(m.text)}</div>
        </div>`).join("")
    : `<p class="muted">No messages yet.</p>`;

}

function renderShipments(shipments) {

  const grid = $("shipmentGrid");

  if (shipments.length === 0) {
    grid.innerHTML = `<p class="muted">No shipments yet.</p>`;
    return;
  }

  grid.innerHTML = shipments.map((s) => {

    const items = (s.items || []).length
      ? `<table class="items">
           <thead><tr><th>Item</th><th>Qty</th><th>Notes</th></tr></thead>
           <tbody>${s.items.map((i) => `
             <tr>
               <td>${esc(i.name)}</td>
               <td>${esc(i.quantity)}</td>
               <td>${esc(i.notes || "-")}</td>
             </tr>`).join("")}
           </tbody>
         </table>`
      : `<p class="muted">No items listed.</p>`;

    const history = (s.trackingHistory || []).slice().reverse().map((h) => `
        <li>
          <strong>${esc(h.status)}</strong> · ${esc(h.location || "-")}
          <span class="muted">${esc(h.date || "")} ${esc(h.time || "")}</span>
        </li>`).join("");

    const photos = (s.photos || []).map((url) =>
      `<img src="${esc(url)}" alt="Shipment photo" loading="lazy">`
    ).join("");

    return `
      <div class="card wide">
        <div class="card-head">
          <strong>${esc(s.trackingId)}</strong>
          <span class="badge">${esc(s.status || "-")}</span>
        </div>

        <p>${esc(s.origin || "-")} → ${esc(s.destination || "-")}</p>
        <p class="muted">Current location: ${esc(s.currentLocation || "-")}</p>
        <p class="muted">Expected delivery: ${esc(s.expectedDelivery || "-")}</p>
        <p class="muted">Carrier: ${esc(s.carrier || "-")} · Weight: ${esc(s.weight || "-")}</p>

        ${s.description ? `<p class="desc">${esc(s.description)}</p>` : ""}
        ${s.importantUpdate ? `<p class="update">${esc(s.importantUpdate)}</p>` : ""}

        <h4 class="sub-title">Items</h4>
        ${items}

        ${photos ? `<h4 class="sub-title">Photos</h4><div class="photos">${photos}</div>` : ""}

        ${history ? `<h4 class="sub-title">Tracking history</h4><ul class="timeline">${history}</ul>` : ""}
      </div>`;

  }).join("");

}

function renderTransactions(transactions) {

  $("transactionList").innerHTML = transactions.length
    ? transactions.map((t) => `
        <div class="row">
          <div>
            <strong>+${money(t.amount)}</strong>
            <span class="muted"> · ${esc(t.note || "Funding")}</span>
          </div>
          <span class="muted">${esc(when(t.createdAt))}</span>
        </div>`).join("")
    : `<p class="muted">No transactions yet.</p>`;

}
