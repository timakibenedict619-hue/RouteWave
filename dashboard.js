import { auth, db } from "./firebase.js";

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

// Dashboard Elements
const totalShipments = document.getElementById("totalShipments");
const pendingShipments = document.getElementById("pendingShipments");
const transitShipments = document.getElementById("transitShipments");
const deliveredShipments = document.getElementById("deliveredShipments");
const shipmentTable = document.getElementById("shipmentTable");

// Load Dashboard
async function loadDashboard() {

    try {

        const snapshot = await getDocs(collection(db, "shipments"));

        let total = 0;
        let pending = 0;
        let transit = 0;
        let delivered = 0;

        snapshot.forEach((doc) => {

            total++;

            const shipment = doc.data();

            switch ((shipment.status || "").trim().toLowerCase()) {

                case "pending":
                    pending++;
                    break;

                case "processing":
                    pending++;
                    break;

                case "picked up":
                    transit++;
                    break;

                case "in transit":
                    transit++;
                    break;

                case "arrived at hub":
                    transit++;
                    break;

                case "customs clearance":
                    transit++;
                    break;

                case "out for delivery":
                    transit++;
                    break;

                case "delivered":
                    delivered++;
                    break;
            }

        });

        totalShipments.textContent = total;
        pendingShipments.textContent = pending;
        transitShipments.textContent = transit;
        deliveredShipments.textContent = delivered;

    } catch (error) {

        console.error(error);

    }

}

// Recent Shipments
async function loadRecentShipments() {

    shipmentTable.innerHTML = `
        <tr>
            <td colspan="4">Loading...</td>
        </tr>
    `;

    try {

        const q = query(
            collection(db, "shipments"),
            orderBy("createdAt", "desc"),
            limit(10)
        );

        const snapshot = await getDocs(q);

        shipmentTable.innerHTML = "";

        if (snapshot.empty) {

            shipmentTable.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center">
                        No shipments available
                    </td>
                </tr>
            `;

            return;

        }

        snapshot.forEach((doc) => {

            const shipment = doc.data();

            shipmentTable.innerHTML += `
                <tr>

                    <td>${shipment.trackingId || "-"}</td>

                    <td>${shipment.receiverName || "-"}</td>

                    <td>${shipment.status || "-"}</td>

                    <td>${shipment.destination || "-"}</td>

                </tr>
            `;

        });

    } catch (error) {

        console.error(error);

    }

}

// Initialize Dashboard
loadDashboard();
loadRecentShipments();
