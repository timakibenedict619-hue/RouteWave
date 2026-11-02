// customer-picker.js: shared customer dropdown for shipment forms

import { db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Fills the dropdown with customers and keeps the tracking ID box in sync.
// Returns a promise that resolves once the list is loaded.
export async function initCustomerPicker(selectEl, trackingInputEl, selectedTrackingId = "") {

    const snapshot = await getDocs(collection(db, "users"));

    const customers = [];
    snapshot.forEach((d) => customers.push(d.data()));

    customers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Keep the placeholder option that is already in the HTML
    const placeholder = selectEl.querySelector("option[value='']");
    selectEl.innerHTML = "";
    if (placeholder) selectEl.appendChild(placeholder);

    customers.forEach((customer) => {

        const option = document.createElement("option");
        option.value = customer.trackingId;
        option.textContent = `${customer.name || customer.email} · ${customer.trackingId}`;
        option.dataset.uid = customer.uid || "";
        option.dataset.name = customer.name || "";
        selectEl.appendChild(option);

    });

    selectEl.value = selectedTrackingId || "";

    const sync = () => {
        trackingInputEl.value = selectEl.value || "";
    };

    selectEl.addEventListener("change", sync);
    sync();

}

// Returns { uid, trackingId, name } for the chosen customer, or null
export function getSelectedCustomer(selectEl) {

    const option = selectEl.selectedOptions[0];

    if (!option || !option.value) return null;

    return {
        uid: option.dataset.uid,
        trackingId: option.value,
        name: option.dataset.name
    };

}
