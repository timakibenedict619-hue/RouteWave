import { db } from "./firebase.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const trackingInput = document.getElementById("trackingInput");
const trackBtn = document.getElementById("trackBtn");

const resultCard = document.getElementById("resultCard");
const notFound = document.getElementById("notFound");
const timeline = document.getElementById("timeline");

trackBtn.addEventListener("click", trackShipment);

trackingInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        trackShipment();
    }
});

async function trackShipment() {

    const trackingId = trackingInput.value.trim();

if (!trackingId) {

    resultCard.style.display = "none";

    notFound.style.display = "block";

    notFound.innerHTML = `
        <div style="text-align:center;padding:30px;">
            <h3 style="color:#e53935;margin-bottom:10px;">
                Tracking Number Required
            </h3>
            <p style="color:#666;">
                Please enter your tracking number to track your shipment.
            </p>
        </div>
    `;

    trackingInput.focus();

    return;

}
        
        
    

    resultCard.style.display = "none";
    notFound.style.display = "none";

    try {

        const q = query(
            collection(db, "shipments"),
            where("trackingId", "==", trackingId)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {

            notFound.style.display = "block";

            return;

        }

        const shipment = snapshot.docs[0].data();

        displayShipment(shipment);

    } catch (error) {

        console.error(error);

        alert(error.message);

    }

}

function displayShipment(shipment) {

    resultCard.style.display = "block";

    document.getElementById("trackingId").textContent =
        shipment.trackingId || "-";

    document.getElementById("status").textContent =
        shipment.status || "-";

    document.getElementById("origin").textContent =
        shipment.origin || "-";

    document.getElementById("destination").textContent =
        shipment.destination || "-";

    document.getElementById("currentLocation").textContent =
        shipment.currentLocation || "-";

    document.getElementById("expectedDelivery").textContent =
        shipment.expectedDelivery || "-";

    document.getElementById("carrier").textContent =
        shipment.carrier || "-";

    document.getElementById("weight").textContent =
        shipment.weight || "-";

    buildTimeline(shipment);

    updateProgress(shipment.status);

}

function buildTimeline(shipment) {

    timeline.innerHTML = "";

    if (!shipment.trackingHistory ||
        shipment.trackingHistory.length === 0) {

        timeline.innerHTML =
            "<li>No tracking history available.</li>";

        return;

    }

    shipment.trackingHistory.forEach(item => {

        timeline.innerHTML += `

        <li>

            <strong>${item.status}</strong><br>

            📍 ${item.location}<br>

            <small>${item.date} ${item.time}</small>

        </li>

        `;

    });

}

function updateProgress(status) {

    const progressFill =
        document.getElementById("progressFill");

    let width = 0;

    switch (status) {

        case "Pending":
            width = 10;
            break;

        case "Processing":
            width = 20;
            break;

        case "Picked Up":
            width = 35;
            break;

        case "In Transit":
            width = 60;
            break;

        case "Arrived at Hub":
            width = 75;
            break;

        case "Customs Clearance":
            width = 85;
            break;

        case "Out For Delivery":
            width = 95;
            break;

        case "Delivered":
            width = 100;
            break;

        default:
            width = 0;

    }

    progressFill.style.width = width + "%";

          }
