// create-shipment.js

import { db } from "./firebase.js";
import { uploadImage } from "./cloudinary.js";
import { initTrackingField, readTrackingField } from "./tracking-field.js";
import { initItemsEditor, readItems } from "./items-editor.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const trackingInput = document.getElementById("trackingId");
const trackingList = document.getElementById("trackingIdList");
const photosInput = document.getElementById("photos");
const photoPreview = document.getElementById("photoPreview");
const shipmentForm = document.getElementById("shipmentForm");
const submitBtn = shipmentForm.querySelector('button[type="submit"]');

// Customer tracking ID (type it or pick from the list)
initTrackingField(trackingInput, trackingList);

// Items / products
initItemsEditor(document.getElementById("itemsEditor"), document.getElementById("addItemBtn"));

// Preview selected photos before upload
photosInput.addEventListener("change", () => {

    photoPreview.innerHTML = "";

    [...photosInput.files].forEach((file) => {

        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        img.style.cssText =
            "width:110px;height:110px;object-fit:cover;border-radius:12px;border:1px solid #374151";

        photoPreview.appendChild(img);

    });

});

shipmentForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const tracking = readTrackingField(trackingInput);

    if (!tracking.trackingId) {
        alert("Enter or choose the customer's tracking ID.");
        return;
    }

    const files = [...photosInput.files];

    submitBtn.disabled = true;

    try {

        const photos = [];

        for (let i = 0; i < files.length; i++) {
            submitBtn.textContent = `Uploading photo ${i + 1} of ${files.length}...`;
            photos.push(await uploadImage(files[i]));
        }

        submitBtn.textContent = "Saving shipment...";

        const status = document.getElementById("status").value;
        const currentLocation = document.getElementById("currentLocation").value;

        await addDoc(collection(db, "shipments"), {

            // Same tracking ID the customer uses to log in
            trackingId: tracking.trackingId,
            customerTrackingId: tracking.trackingId,
            customerUid: tracking.uid,
            customerName: tracking.name,

            status: status,

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
            currentLocation: currentLocation,
            expectedDelivery: document.getElementById("expectedDelivery").value,
            description: document.getElementById("description").value,
            importantUpdate: document.getElementById("importantUpdate").value,

            photos: photos,

            items: readItems(document.getElementById("itemsEditor")),

            trackingHistory: [{
                at: Date.now(),
                status: status,
                location: currentLocation,
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString()
            }],

            createdAt: serverTimestamp()

        });

        alert("Shipment created successfully!");

        window.location.href = "manage-shipments.html";

    } catch (error) {

        console.error(error);

        alert("Error creating shipment: " + error.message);

        submitBtn.disabled = false;
        submitBtn.textContent = "Create & Save Shipment";

    }

});
