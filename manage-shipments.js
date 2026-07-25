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
initializeEmail(); 
   


const tableBody = document.getElementById("shipmentTable");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const refreshBtn = document.getElementById("refreshBtn");

let shipments = [];

// Load Shipments
async function loadShipments() {

    tableBody.innerHTML = `
        <tr>
            <td colspan="5">Loading...</td>
        </tr>
    `;

    try {

        const snapshot = await getDocs(collection(db, "shipments"));

        shipments = [];

        snapshot.forEach((docSnap) => {

            shipments.push({
                id: docSnap.id,
                ...docSnap.data()
            });

        });

        displayShipments(shipments);

    } catch (error) {

        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">Failed to load shipments.</td>
            </tr>
        `;

    }

}

// Display Shipments
function displayShipments(data) {

    tableBody.innerHTML = "";

    if (data.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">No shipments found.</td>
            </tr>
        `;

        return;

    }

    data.forEach((shipment) => {

        tableBody.innerHTML += `
        <tr>

            <td>${shipment.trackingId || ""}</td>

            <td>${shipment.receiverName || ""}</td>

            <td>${shipment.destination || ""}</td>

            <td>${shipment.status || ""}</td>

            <td>

                <button class="action-btn view"
                    onclick="viewShipment('${shipment.id}')">
                    View
                </button>

                <button class="action-btn edit"
                    onclick="editShipment('${shipment.id}')">
                    Edit
                </button>

                <button class="action-btn delete"
                    onclick="deleteShipment('${shipment.id}')">
                    Delete
                </button>

                <button class="action-btn email"
                    onclick="sendEmail('${shipment.id}')">
                    Email
                </button>

            </td>

        </tr>
        `;

    });

}

// Search
searchBtn.addEventListener("click", () => {

    const keyword = searchInput.value.trim().toLowerCase();

    if (!keyword) {

        displayShipments(shipments);

        return;

    }

    const filtered = shipments.filter(shipment =>
        shipment.trackingId &&
        shipment.trackingId.toLowerCase().includes(keyword)
    );

    displayShipments(filtered);

});

// Refresh
refreshBtn.addEventListener("click", () => {

    searchInput.value = "";

    loadShipments();

});

// Delete Shipment
window.deleteShipment = async function(id) {

    const confirmDelete = confirm(
        "Delete this shipment?"
    );

    if (!confirmDelete) return;

    try {

        await deleteDoc(doc(db, "shipments", id));

        alert("Shipment deleted.");

        loadShipments();

    } catch (error) {

        console.error(error);

        alert("Failed to delete shipment.");

    }

};

// Placeholder Functions
// View Shipment
window.viewShipment = function(id){

    window.location.href = `view-shipment.html?id=${id}`;

};

// Edit Shipment
window.editShipment = function(id){

    window.location.href = `edit-shipment.html?id=${id}`;

};

// Send Email



initializeEmail();

window.sendEmail = async function(id){

    try{

        const shipmentRef = doc(db,"shipments",id);

        const snapshot = await getDoc(shipmentRef);

        if(!snapshot.exists()){

            alert("Shipment not found.");

            return;

        }

        const shipment = snapshot.data();

        await sendShipmentEmail({
    customerName: shipment.receiverName || shipment.customer,
    customerEmail: shipment.receiverEmail || shipment.email,
    trackingId: shipment.trackingId,
    status: shipment.status,
    origin: shipment.origin,
    destination: shipment.destination,
    description: shipment.description
});

            

            

            

            

            

            

    

        alert("Email sent successfully.");

    }

    catch(error){

        console.error(error);

        alert(error.message);

    }

};

// Initial Load
loadShipments();
