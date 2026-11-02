// edit-shipment.js

import { db } from "./firebase.js";
import { uploadImage } from "./cloudinary.js";
import { initTrackingField, readTrackingField } from "./tracking-field.js";
import { initItemsEditor, readItems } from "./items-editor.js";
import { formatMoney, populateCurrencySelect } from "./currencies.js";

import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    updateDoc,
    serverTimestamp,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const shipmentId = params.get("id");

if (!shipmentId) {
    alert("Invalid shipment.");
    window.location.href = "manage-shipments.html";
}

const $ = (id) => document.getElementById(id);

const form = $("editShipmentForm");
const newPhotosInput = $("newPhotos");
const photoList = $("photoList");
const submitBtn = form.querySelector('button[type="submit"]');

let currentShipment = {};

// Photos currently on the shipment (URLs). Admin can remove any of them.
let photos = [];

function renderPhotos() {

    photoList.innerHTML = "";

    if (photos.length === 0) {
        photoList.innerHTML = `<span style="color:#9CA3AF">No photos yet.</span>`;
        return;
    }

    photos.forEach((url, index) => {

        const wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;width:110px";

        wrap.innerHTML = `
            <img src="${url}" alt="Shipment photo"
                 style="width:110px;height:110px;object-fit:cover;border-radius:12px;border:1px solid #374151">
            <button type="button" data-index="${index}"
                style="position:absolute;top:6px;right:6px;width:28px;height:28px;margin:0;padding:0;
                       border-radius:50%;background:#EF4444;font-size:16px;line-height:28px">×</button>
        `;

        photoList.appendChild(wrap);

    });

}

photoList.addEventListener("click", (e) => {

    const btn = e.target.closest("button[data-index]");

    if (!btn) return;

    photos.splice(Number(btn.dataset.index), 1);
    renderPhotos();

});

// Load shipment and fill the form
async function loadShipment() {

    try {

        const snapshot = await getDoc(doc(db, "shipments", shipmentId));

        if (!snapshot.exists()) {
            alert("Shipment not found.");
            window.location.href = "manage-shipments.html";
            return;
        }

        const shipment = snapshot.data();
        currentShipment = shipment;

        photos = [...(shipment.photos || [])];
        renderPhotos();

        initItemsEditor(
            $("itemsEditor"),
            $("addItemBtn"),
            shipment.items || []
        );

        $("trackingId").value = shipment.trackingId || "";
        await initTrackingField($("trackingId"), $("trackingIdList"));
        await loadCustomerAccount(shipment.trackingId);

        const fields = {
            status: shipment.status,
            senderName: shipment.senderName,
            senderEmail: shipment.senderEmail,
            senderPhone: shipment.senderPhone,
            receiverName: shipment.receiverName,
            receiverEmail: shipment.receiverEmail,
            receiverPhone: shipment.receiverPhone,
            origin: shipment.origin,
            destination: shipment.destination,
            carrier: shipment.carrier,
            weight: shipment.weight,
            currentLocation: shipment.currentLocation,
            expectedDelivery: shipment.expectedDelivery,
            description: shipment.description,
            importantUpdate: shipment.importantUpdate
        };

        Object.entries(fields).forEach(([id, value]) => {
            const el = $(id);
            if (el) el.value = value || "";
        });

    } catch (error) {

        console.error(error);
        alert(error.message);

    }

}

// Customer account + currency for the tracking ID on this shipment
let customerAccount = null;
let currencyTouched = false;

async function loadCustomerAccount(trackingId) {

    const select = $("customerCurrency");
    const info = $("customerAccountInfo");

    customerAccount = null;
    currencyTouched = false;

    if (!trackingId) {
        info.textContent = "Enter a tracking ID to link a customer account.";
        populateCurrencySelect(select, "USD");
        select.disabled = true;
        return;
    }

    const snap = await getDocs(
        query(collection(db, "users"), where("trackingId", "==", trackingId))
    );

    if (snap.empty) {
        info.textContent = "No customer account for this tracking ID yet. Create one in Customers & Funding.";
        populateCurrencySelect(select, "USD");
        select.disabled = true;
        return;
    }

    const account = snap.docs[0];
    customerAccount = { ref: account.ref, ...account.data() };

    info.textContent =
        `${customerAccount.name || customerAccount.email} · balance ` +
        formatMoney(customerAccount.balance, customerAccount.currency || "USD");

    populateCurrencySelect(select, customerAccount.currency || "USD");
    select.disabled = false;

}

// Changing the tracking ID loads that customer's account instead
$("trackingId").addEventListener("change", () => {
    loadCustomerAccount($("trackingId").value.trim().toUpperCase()).catch(console.error);
});

$("customerCurrency").addEventListener("change", () => {
    currencyTouched = true;
});

// Save Changes
form.addEventListener("submit", async (e) => {

    e.preventDefault();

    const tracking = readTrackingField($("trackingId"));

    if (!tracking.trackingId) {
        alert("Enter or choose the customer's tracking ID.");
        return;
    }

    submitBtn.disabled = true;

    try {

        // Upload any newly chosen photos, then add them to the kept list
        const files = [...newPhotosInput.files];
        const uploaded = [];

        for (let i = 0; i < files.length; i++) {
            submitBtn.textContent = `Uploading photo ${i + 1} of ${files.length}...`;
            uploaded.push(await uploadImage(files[i]));
        }

        submitBtn.textContent = "Saving...";

        const status = $("status").value;
        const currentLocation = $("currentLocation").value;

        const historyItem = {
            at: Date.now(),
            status: status,
            location: currentLocation,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };

        const update = {

            trackingId: tracking.trackingId,
            customerTrackingId: tracking.trackingId,
            customerUid: tracking.uid || currentShipment.customerUid || "",
            customerName: tracking.name || currentShipment.customerName || "",

            status: status,
            senderName: $("senderName").value,
            senderEmail: $("senderEmail").value,
            senderPhone: $("senderPhone").value,
            receiverName: $("receiverName").value,
            receiverEmail: $("receiverEmail").value,
            receiverPhone: $("receiverPhone").value,
            origin: $("origin").value,
            destination: $("destination").value,
            carrier: $("carrier").value,
            weight: $("weight").value,
            currentLocation: currentLocation,
            expectedDelivery: $("expectedDelivery").value,
            description: $("description").value,
            importantUpdate: $("importantUpdate").value,

            photos: [...photos, ...uploaded],

            items: readItems($("itemsEditor")),

            updatedAt: serverTimestamp(),
            trackingHistory: arrayUnion(historyItem)

        };

        await updateDoc(doc(db, "shipments", shipmentId), update);

        // Save the account currency only if the admin changed it on this same account
        if (currencyTouched && customerAccount && tracking.trackingId === customerAccount.trackingId) {
            await updateDoc(customerAccount.ref, { currency: $("customerCurrency").value });
        }

        alert("Shipment updated successfully.");

        window.location.href = `view-shipment.html?id=${shipmentId}`;

    } catch (error) {

        console.error(error);

        alert(error.message);

        submitBtn.disabled = false;
        submitBtn.textContent = "Save Changes";

    }

});

loadShipment();
