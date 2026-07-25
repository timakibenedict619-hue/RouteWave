import { db } from "./firebase.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Get Shipment ID
const params = new URLSearchParams(window.location.search);
const shipmentId = params.get("id");

if (!shipmentId) {
    alert("Invalid shipment.");
    window.location.href = "manage-shipments.html";
}

const form = document.getElementById("editShipmentForm");

// Load Shipment
async function loadShipment() {

    try {

        const shipmentRef = doc(db, "shipments", shipmentId);

        const snapshot = await getDoc(shipmentRef);

        if (!snapshot.exists()) {

            alert("Shipment not found.");

            window.location.href = "manage-shipments.html";

            return;

        }

        const shipment = snapshot.data();

        document.getElementById("trackingId").value = shipment.trackingId || "";

        document.getElementById("status").value = shipment.status || "";

        document.getElementById("senderName").value = shipment.senderName || "";

        document.getElementById("senderEmail").value = shipment.senderEmail || "";

        document.getElementById("senderPhone").value = shipment.senderPhone || "";

        document.getElementById("receiverName").value = shipment.receiverName || "";

        document.getElementById("receiverEmail").value = shipment.receiverEmail || "";

        document.getElementById("receiverPhone").value = shipment.receiverPhone || "";

        document.getElementById("origin").value = shipment.origin || "";

        document.getElementById("destination").value = shipment.destination || "";

        document.getElementById("carrier").value = shipment.carrier || "";

        document.getElementById("weight").value = shipment.weight || "";

        document.getElementById("currentLocation").value = shipment.currentLocation || "";

        document.getElementById("expectedDelivery").value = shipment.expectedDelivery || "";

        document.getElementById("description").value = shipment.description || "";

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

}

loadShipment();

// Save Changes
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        const shipmentRef = doc(db, "shipments", shipmentId);

        const status = document.getElementById("status").value;

        const location = document.getElementById("currentLocation").value;

        const historyItem = {

            status: status,

            location: location,

            date: new Date().toLocaleDateString(),

            time: new Date().toLocaleTimeString()

        };

        await updateDoc(shipmentRef, {

            status: status,

            senderName: document.getElementById("senderName").value,

            senderEmail: document.getElementById("senderEmail").value,

            senderPhone: document.getElementById("senderPhone").value,

            receiverName: document.getElementById("receiverName").value,

            receiverEmail: document.getElementById("receiverEmail").value,

            receiverPhone: document.getElementById("receiverPhone").value,

            origin: document.getElementById("origin").value,

            destination: document.getElementById("destination").value,

            carrier: document.getElementById("carrier").value,

            weight: document.getElementById("weight").value,

            currentLocation: location,

            expectedDelivery: document.getElementById("expectedDelivery").value,

            description: document.getElementById("description").value,

            updatedAt: serverTimestamp(),

            trackingHistory: arrayUnion(historyItem)

        });

        alert("Shipment updated successfully.");

        window.location.href =
            `view-shipment.html?id=${shipmentId}`;

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

});
