import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Get shipment ID from URL
const params = new URLSearchParams(window.location.search);
const shipmentId = params.get("id");

// Redirect if no ID
if (!shipmentId) {
    alert("Shipment not found.");
    window.location.href = "manage-shipments.html";
}

// Edit button
const editBtn = document.getElementById("editBtn");
editBtn.href = `edit-shipment.html?id=${shipmentId}`;

// Load Shipment
async function loadShipment() {

    try {

        const shipmentRef = doc(db, "shipments", shipmentId);

        const shipmentSnap = await getDoc(shipmentRef);

        if (!shipmentSnap.exists()) {

            alert("Shipment not found.");

            window.location.href = "manage-shipments.html";

            return;

        }

        const shipment = shipmentSnap.data();

        // Shipment Information
        document.getElementById("trackingId").textContent =
            shipment.trackingId || "-";

        document.getElementById("status").textContent =
            shipment.status || "-";

        document.getElementById("carrier").textContent =
            shipment.carrier || "-";

        document.getElementById("weight").textContent =
            shipment.weight || "-";

        document.getElementById("origin").textContent =
            shipment.origin || "-";

        document.getElementById("destination").textContent =
            shipment.destination || "-";

        document.getElementById("currentLocation").textContent =
            shipment.currentLocation || "-";

        document.getElementById("expectedDelivery").textContent =
            shipment.expectedDelivery || "-";

        // Sender
        document.getElementById("senderName").textContent =
            shipment.senderName || "-";

        document.getElementById("senderEmail").textContent =
            shipment.senderEmail || "-";

        document.getElementById("senderPhone").textContent =
            shipment.senderPhone || "-";

        // Receiver
        document.getElementById("receiverName").textContent =
            shipment.receiverName || "-";

        document.getElementById("receiverEmail").textContent =
            shipment.receiverEmail || "-";

        document.getElementById("receiverPhone").textContent =
            shipment.receiverPhone || "-";

        // Description
        document.getElementById("description").textContent =
            shipment.description || "No description.";

        // Timeline
        createTimeline(shipment);

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// Timeline Builder
function createTimeline(shipment) {

    const timeline = document.getElementById("timeline");

    timeline.innerHTML = "";

    const events = [];

    events.push({
        title: "Shipment Created",
        location: shipment.origin || "",
        date: "Created"
    });

    if (shipment.status === "Pending") {

        events.push({
            title: "Pending Dispatch",
            location: shipment.currentLocation || "",
            date: ""
        });

    }

    if (shipment.status === "In Transit") {

        events.push({
            title: "Shipment In Transit",
            location: shipment.currentLocation || "",
            date: ""
        });

    }

    if (shipment.status === "Delivered") {

        events.push({
            title: "Shipment Delivered",
            location: shipment.destination || "",
            date: ""
        });

    }

    events.forEach(event => {

        timeline.innerHTML += `

        <li>

            <strong>${event.title}</strong>

            <br>

            ${event.location}

            <br>

            <small>${event.date}</small>

        </li>

        `;

    });

}

loadShipment();
