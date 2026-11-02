import { auth, db } from "./firebase.js";
import { formatMoney } from "./currencies.js";

import {
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "admin-login.html";
});

const $ = (id) => document.getElementById(id);

const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

const money = (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
        .format(Number(n || 0));

// Shipment counts by status
async function loadDashboard() {

    try {

        const snapshot = await getDocs(collection(db, "shipments"));

        let total = 0;
        let pending = 0;
        let transit = 0;
        let delivered = 0;

        snapshot.forEach((d) => {

            total++;

            switch ((d.data().status || "").trim().toLowerCase()) {

                case "pending":
                case "processing":
                    pending++;
                    break;

                case "picked up":
                case "in transit":
                case "arrived at hub":
                case "customs clearance":
                case "out for delivery":
                    transit++;
                    break;

                case "delivered":
                    delivered++;
                    break;
            }

        });

        $("totalShipments").textContent = total;
        $("pendingShipments").textContent = pending;
        $("transitShipments").textContent = transit;
        $("deliveredShipments").textContent = delivered;

    } catch (error) {
        console.error(error);
    }

}

// Customer count and total balance held, grouped by currency
async function loadCustomerStats() {

    try {

        const snapshot = await getDocs(collection(db, "users"));

        let count = 0;
        const totals = {};

        snapshot.forEach((d) => {
            const u = d.data();
            const code = u.currency || "USD";
            count++;
            totals[code] = (totals[code] || 0) + Number(u.balance || 0);
        });

        $("totalCustomers").textContent = count;

        const parts = Object.entries(totals).map(([code, value]) => formatMoney(value, code));
        $("totalBalance").textContent = parts.length ? parts.join(" · ") : formatMoney(0, "USD");

    } catch (error) {
        console.error(error);
    }

}

// Recent shipments
async function loadRecentShipments() {

    const shipmentTable = $("shipmentTable");

    shipmentTable.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;

    try {

        const snapshot = await getDocs(
            query(collection(db, "shipments"), orderBy("createdAt", "desc"), limit(10))
        );

        if (snapshot.empty) {
            shipmentTable.innerHTML = `
                <tr><td colspan="4" style="text-align:center">No shipments available</td></tr>`;
            return;
        }

        shipmentTable.innerHTML = snapshot.docs.map((d) => {
            const s = d.data();
            return `
                <tr>
                    <td>${escapeHtml(s.trackingId || "-")}</td>
                    <td>${escapeHtml(s.receiverName || "-")}</td>
                    <td>${escapeHtml(s.status || "-")}</td>
                    <td>${escapeHtml(s.destination || "-")}</td>
                </tr>`;
        }).join("");

    } catch (error) {
        console.error(error);
    }

}

loadDashboard();
loadCustomerStats();
loadRecentShipments();
