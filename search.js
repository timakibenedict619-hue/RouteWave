import { db } from "./firebase.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Search shipments
export async function searchShipments(searchText) {

    const snapshot = await getDocs(collection(db, "shipments"));

    const results = [];

    const keyword = searchText.trim().toLowerCase();

    snapshot.forEach((doc) => {

        const shipment = {
            id: doc.id,
            ...doc.data()
        };

        const trackingId = (shipment.trackingId || "").toLowerCase();
        const customer = (shipment.customer || "").toLowerCase();
        const origin = (shipment.origin || "").toLowerCase();
        const destination = (shipment.destination || "").toLowerCase();
        const status = (shipment.status || "").toLowerCase();

        if (
            trackingId.includes(keyword) ||
            customer.includes(keyword) ||
            origin.includes(keyword) ||
            destination.includes(keyword) ||
            status.includes(keyword)
        ) {
            results.push(shipment);
        }

    });

    return results;
}

// Display search results
export function renderSearchResults(results, containerId) {

    const container = document.getElementById(containerId);

    if (!container) return;

    if (results.length === 0) {

        container.innerHTML = `
            <div class="text-center p-4">
                No shipments found.
            </div>
        `;

        return;
    }

    let html = "";

    results.forEach((shipment) => {

        html += `
            <div class="border rounded-lg p-4 mb-3 bg-white shadow">

                <h3><strong>${shipment.trackingId}</strong></h3>

                <p><strong>Customer:</strong> ${shipment.customer}</p>

                <p><strong>Route:</strong> ${shipment.origin} → ${shipment.destination}</p>

                <p><strong>Status:</strong> ${shipment.status}</p>

            </div>
        `;

    });

    container.innerHTML = html;
}
