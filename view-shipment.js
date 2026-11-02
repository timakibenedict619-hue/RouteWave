// view-shipment.js: read-only shipment detail with live customer info

import { db } from "./firebase.js";

import {
    doc,
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(window.location.search);
const shipmentId = params.get("id");

if (!shipmentId) {
    alert("Shipment not found.");
    window.location.href = "manage-shipments.html";
}

$("editBtn").href = `edit-shipment.html?id=${shipmentId}`;

const money = (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
        .format(Number(n || 0));

const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

const text = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value || "-";
};

// Newest-first history time in ms
const historyTime = (h) =>
    h.at || Date.parse(`${h.date || ""} ${h.time || ""}`) || 0;

let unsubCustomer = null;

// Live shipment
onSnapshot(doc(db, "shipments", shipmentId), (snap) => {

    if (!snap.exists()) {
        alert("Shipment not found.");
        window.location.href = "manage-shipments.html";
        return;
    }

    const s = snap.data();

    // Shipment information
    text("trackingId", s.trackingId);
    const statusEl = $("status");
    statusEl.textContent = s.status || "-";
    text("carrier", s.carrier);
    text("weight", s.weight);
    text("origin", s.origin);
    text("destination", s.destination);
    text("currentLocation", s.currentLocation);
    text("expectedDelivery", s.expectedDelivery);

    // Sender and receiver
    text("senderName", s.senderName);
    text("senderEmail", s.senderEmail);
    text("senderPhone", s.senderPhone);
    text("receiverName", s.receiverName);
    text("receiverEmail", s.receiverEmail);
    text("receiverPhone", s.receiverPhone);

    // Description and important update
    $("description").textContent = s.description || "No description.";
    $("importantUpdate").textContent = s.importantUpdate || "No update sent yet.";

    renderItems(s.items || []);
    renderPhotos(s.photos || []);
    renderTimeline(s);

    // Customer account linked by tracking ID
    listenToCustomer(s.trackingId);

});

// Customer account (name, email, balance) for this tracking ID
function listenToCustomer(trackingId) {

    if (unsubCustomer) unsubCustomer();

    if (!trackingId) {
        renderCustomer(null);
        return;
    }

    unsubCustomer = onSnapshot(
        query(collection(db, "users"), where("trackingId", "==", trackingId)),
        (snap) => renderCustomer(snap.empty ? null : snap.docs[0].data())
    );

}

function renderCustomer(c) {

    if (!c) {
        text("customerName", "No account yet");
        text("customerEmail", "-");
        text("customerBalance", "-");
        $("customerStatus").textContent = "Not linked";
        $("customerStatus").className = "badge amber";
        return;
    }

    text("customerName", c.name);
    text("customerEmail", c.email);
    text("customerBalance", money(c.balance));
    $("customerStatus").textContent = "Account active";
    $("customerStatus").className = "badge green";

}

function renderItems(items) {

    const body = $("itemsBody");

    body.innerHTML = items.length
        ? items.map((i) => `
            <tr>
                <td>${esc(i.name)}</td>
                <td>${esc(i.quantity)}</td>
                <td>${esc(i.notes || "-")}</td>
            </tr>`).join("")
        : `<tr><td colspan="3" class="empty">No items listed.</td></tr>`;

}

function renderPhotos(photos) {

    const grid = $("photoGrid");

    grid.innerHTML = photos.length
        ? photos.map((url) =>
            `<a href="${esc(url)}" target="_blank" rel="noopener">
               <img src="${esc(url)}" alt="Shipment photo" loading="lazy">
             </a>`).join("")
        : `<p class="empty" style="width:100%">No photos uploaded.</p>`;

}

// Real tracking history (newest first); falls back to the status when empty
function renderTimeline(s) {

    const timeline = $("timeline");

    const history = [...(s.trackingHistory || [])]
        .sort((a, b) => historyTime(b) - historyTime(a));

    if (history.length === 0) {
        timeline.innerHTML = `<li><div class="t-title">${esc(s.status || "Shipment created")}</div>
            <div class="t-meta">${esc(s.currentLocation || s.origin || "")}</div></li>`;
        return;
    }

    timeline.innerHTML = history.map((h) => `
        <li>
            <div class="t-title">${esc(h.status || "-")}</div>
            <div class="t-meta">${esc(h.location || "-")} · ${esc(h.date || "")} ${esc(h.time || "")}</div>
        </li>`).join("");

}
