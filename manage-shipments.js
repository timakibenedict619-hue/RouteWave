import { db } from "./firebase.js";

import {
    initializeEmail,
    sendShipmentEmail
} from "./email.js";

import {
    collection,
    getDocs,
    getDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// Initialize EmailJS once
initializeEmail();


const tableBody = document.getElementById("shipmentTable");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const refreshBtn = document.getElementById("refreshBtn");

let shipments = [];


// ===============================
// LOAD SHIPMENTS
// ===============================

async function loadShipments() {

    tableBody.innerHTML = `
        <tr>
            <td colspan="5">Loading...</td>
        </tr>
    `;

    try {

        const snapshot = await getDocs(
            collection(db, "shipments")
        );

        shipments = [];

        snapshot.forEach((docSnap) => {

            shipments.push({
                id: docSnap.id,
                ...docSnap.data()
            });

        });

        displayShipments(shipments);

    } catch (error) {

        console.error("Load shipments error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    Failed to load shipments.
                </td>
            </tr>
        `;

    }

}


// ===============================
// DISPLAY SHIPMENTS
// ===============================

function displayShipments(data) {

    tableBody.innerHTML = "";

    if (data.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No shipments found.
                </td>
            </tr>
        `;

        return;

    }


    data.forEach((shipment) => {

        tableBody.innerHTML += `
        <tr>

            <td>
                ${shipment.trackingId || ""}
            </td>

            <td>
                ${shipment.receiverName || ""}
            </td>

            <td>
                ${shipment.destination || ""}
            </td>

            <td>
                ${shipment.status || ""}
            </td>

            <td>

                <button
                    class="action-btn view"
                    onclick="viewShipment('${shipment.id}')">
                    View
                </button>

                <button
                    class="action-btn edit"
                    onclick="editShipment('${shipment.id}')">
                    Edit
                </button>

                <button
                    class="action-btn delete"
                    onclick="deleteShipment('${shipment.id}')">
                    Delete
                </button>

                <button
                    class="action-btn email"
                    onclick="sendEmail('${shipment.id}')">
                    Email
                </button>

            </td>

        </tr>
        `;

    });

}


// ===============================
// SEARCH
// ===============================

searchBtn.addEventListener("click", () => {

    const keyword =
        searchInput.value.trim().toLowerCase();


    if (!keyword) {

        displayShipments(shipments);

        return;

    }


    const filtered = shipments.filter((shipment) => {

        return (
            shipment.trackingId &&
            shipment.trackingId
                .toLowerCase()
                .includes(keyword)
        );

    });


    displayShipments(filtered);

});


// ===============================
// REFRESH
// ===============================

refreshBtn.addEventListener("click", () => {

    searchInput.value = "";

    loadShipments();

});


// ===============================
// DELETE SHIPMENT
// ===============================

window.deleteShipment = async function(id) {

    const confirmDelete = confirm(
        "Delete this shipment?"
    );

    if (!confirmDelete) return;


    try {

        await deleteDoc(
            doc(db, "shipments", id)
        );

        alert("Shipment deleted.");

        await loadShipments();

    } catch (error) {

        console.error(
            "Delete shipment error:",
            error
        );

        alert(
            "Failed to delete shipment."
        );

    }

};


// ===============================
// VIEW SHIPMENT
// ===============================

window.viewShipment = function(id) {

    window.location.href =
        `view-shipment.html?id=${id}`;

};


// ===============================
// EDIT SHIPMENT
// ===============================

window.editShipment = function(id) {

    window.location.href =
        `edit-shipment.html?id=${id}`;

};


// ===============================
// SEND EMAIL
// ===============================

window.sendEmail = async function(id) {

    try {

        // Find the shipment
        const shipmentRef =
            doc(db, "shipments", id);

        const snapshot =
            await getDoc(shipmentRef);


        if (!snapshot.exists()) {

            alert("Shipment not found.");

            return;

        }


        const shipment =
            snapshot.data();


        // Find customer email
        const customerName =
            shipment.receiverName ||
            shipment.customer ||
            "";

        const customerEmail =
            shipment.receiverEmail ||
            shipment.email ||
            "";


        // Make sure an email exists
        if (!customerEmail) {

            alert(
                "No customer email address was found for this shipment."
            );

            return;

        }


        console.log(
            "Sending shipment email to:",
            customerEmail
        );


        // Send through EmailJS
        await sendShipmentEmail({

            customerName:
                customerName,

            customerEmail:
                customerEmail,

            trackingId:
                shipment.trackingId || "",

            status:
                shipment.status || "",

            origin:
                shipment.origin || "",

            destination:
                shipment.destination || "",

            description:
                shipment.description || "",

            importantUpdate:
                shipment.importantUpdate || ""

        });


        // EmailJS completed successfully
        alert(
            "Email sent successfully."
        );


    } catch (error) {

        console.error(
            "Email sending error:",
            error
        );


        // EmailJS normally gives useful information
        // through status and text.
        const status =
            error?.status || "";

        const text =
            error?.text || "";

        const message =
            error?.message || "";


        let errorMessage =
            text ||
            message ||
            "The email could not be sent.";


        if (status) {

            errorMessage =
                `Email failed (${status}): ${errorMessage}`;

        }


        alert(errorMessage);

    }

};


// ===============================
// INITIAL LOAD
// ===============================

loadShipments();
