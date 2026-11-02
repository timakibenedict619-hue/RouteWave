// create-shipment.js

import { db } from "./firebase.js";
import { uploadImage } from "./cloudinary.js";

import {
    collection,
    addDoc,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Generate Tracking ID
function generateTrackingId() {
    const random = Math.floor(100000 + Math.random() * 900000);
    return `TRK${Date.now()}${random}`;
}

const trackingInput = document.getElementById("trackingId");
trackingInput.value = generateTrackingId();

const customerSelect = document.getElementById("customerTrackingId");
const photosInput = document.getElementById("photos");
const photoPreview = document.getElementById("photoPreview");
const shipmentForm = document.getElementById("shipmentForm");
const submitBtn = shipmentForm.querySelector('button[type="submit"]');

// Load customers so the shipment can be assigned to one
async function loadCustomers() {

    const snapshot = await getDocs(collection(db, "users"));

    const customers = [];

    snapshot.forEach((docSnap) => customers.push(docSnap.data()));

    customers
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .forEach((customer) => {

            const option = document.createElement("option");
            option.value = customer.trackingId;
            option.textContent = `${customer.name || customer.email} (${customer.trackingId})`;
            option.dataset.name = customer.name || "";
            customerSelect.appendChild(option);

        });

}

loadCustomers().catch(console.error);

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

// Form
shipmentForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const files = [...photosInput.files];

    submitBtn.disabled = true;

    try {

        // Upload photos to Cloudinary first, then save their URLs
        const photos = [];

        for (let i = 0; i < files.length; i++) {
            submitBtn.textContent = `Uploading photo ${i + 1} of ${files.length}...`;
            photos.push(await uploadImage(files[i]));
        }

        submitBtn.textContent = "Saving shipment...";

        const status = document.getElementById("status").value;
        const currentLocation = document.getElementById("currentLocation").value;
        const selectedCustomer = customerSelect.selectedOptions[0];

        await addDoc(collection(db, "shipments"), {

            trackingId: trackingInput.value,

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

            // Links the shipment to a customer's dashboard
            customerTrackingId: customerSelect.value || "",

            customerName: selectedCustomer?.dataset.name || "",

            // Cloudinary image URLs
            photos: photos,

            trackingHistory: [{
                status: status,
                location: currentLocation,
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString()
            }],

            createdAt: serverTimestamp()

        });

        alert("Shipment created successfully!");

        window.location.href = "dashboard.html";

    } catch (error) {

        console.error(error);

        alert("Error creating shipment: " + error.message);

        submitBtn.disabled = false;
        submitBtn.textContent = "Create & Save Shipment";

    }

});
