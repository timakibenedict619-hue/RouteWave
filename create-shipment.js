// shipment.js

import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Generate Tracking ID
function generateTrackingId() {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `TRK${Date.now()}${random}`;
}

// Display Tracking ID when page loads
const trackingInput = document.getElementById("trackingId");
trackingInput.value = generateTrackingId();

// Form
const shipmentForm = document.getElementById("shipmentForm");

shipmentForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        await addDoc(collection(db, "shipments"), {

            trackingId: trackingInput.value,

            status: document.getElementById("status").value,

            senderName: document.getElementById("senderName").value,

            senderEmail: document.getElementById("senderEmail").value,

            senderPhone: document.getElementById("senderPhone").value,

            receiverName: document.getElementById("receiverName").value,

            receiverEmail: document.getElementById("receiverEmail").value,

            receiverPhone: document.getElementById("receiverPhone").value,

            origin: document.getElementById("origin").value,

            destination: document.getElementById("destination").value,

            weight: document.getElementById("weight").value,

            carrier: document.getElementById("carrier").value,

            currentLocation: document.getElementById("currentLocation").value,

            expectedDelivery: document.getElementById("expectedDelivery").value,

            description: document.getElementById("description").value,

            createdAt: serverTimestamp()

        });

        alert("Shipment created successfully!");

        window.location.href = "dashboard.html";

    } catch (error) {

        console.error(error);

        alert("Error creating shipment: " + error.message);

    }

});
