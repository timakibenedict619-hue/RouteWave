// tracking-field.js: one shared tracking ID field for customers and shipments

import { db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Same format as the original shipment IDs (TRK + timestamp + digits)
export function generateTrackingId() {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `TRK${Date.now()}${random}`;
}

// Registered customers (users) and every tracking ID that appears on a shipment
export async function loadKnownTrackingIds() {

    const users = new Map(); // trackingId -> { uid, name }
    const ids = new Set();

    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.forEach((d) => {
        const u = d.data();
        if (u.trackingId) {
            users.set(u.trackingId, { uid: u.uid || "", name: u.name || u.email || "" });
            ids.add(u.trackingId);
        }
    });

    const shipmentsSnap = await getDocs(collection(db, "shipments"));
    shipmentsSnap.forEach((d) => {
        const t = d.data().trackingId;
        if (t) ids.add(t);
    });

    return { users, ids };

}

// Fills the suggestion list and keeps the matched customer on the input
export async function initTrackingField(input, datalist) {

    const known = await loadKnownTrackingIds();

    datalist.innerHTML = [...known.ids]
        .sort()
        .map((id) => {
            const user = known.users.get(id);
            return `<option value="${id}">${user ? user.name : "no account yet"}</option>`;
        })
        .join("");

    const sync = () => {
        const id = input.value.trim().toUpperCase();
        input.value = id;
        const user = known.users.get(id);
        input.dataset.uid = user ? user.uid : "";
        input.dataset.name = user ? user.name : "";
    };

    input.addEventListener("change", sync);
    input.addEventListener("blur", sync);

    sync();

    return known;

}

// Returns the tracking ID typed or chosen, plus the matched customer if any
export function readTrackingField(input) {

    return {
        trackingId: input.value.trim().toUpperCase(),
        uid: input.dataset.uid || "",
        name: input.dataset.name || ""
    };

}
