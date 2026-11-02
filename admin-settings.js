// admin-settings.js

import { auth, db, app } from "./firebase.js";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./cloudinary.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut as signOutHelper
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    setDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Second app so creating an admin doesn't sign the current admin out
const helperApp = initializeApp(app.options, "settingsHelper");
const helperAuth = getAuth(helperApp);

const $ = (id) => document.getElementById(id);

const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

function setMsg(id, text, ok) {
    const el = $(id);
    el.textContent = text;
    el.style.color = ok ? "#34D399" : "#F87171";
}

// Account info
function showAccount(user) {
    $("accountEmail").textContent = user.email;
}

$("resetPasswordBtn").addEventListener("click", async () => {

    const email = auth.currentUser?.email;

    if (!email) return;

    try {
        await sendPasswordResetEmail(auth, email);
        setMsg("accountMsg", `Password reset link sent to ${email}.`, true);
    } catch (error) {
        console.error(error);
        setMsg("accountMsg", error.message, false);
    }

});

// Connections
$("cloudName").textContent = CLOUDINARY_CLOUD_NAME;
$("uploadPreset").textContent = CLOUDINARY_UPLOAD_PRESET;
$("projectId").textContent = app.options.projectId || "-";

// Admin accounts
async function loadAdmins() {

    const tbody = $("adminTable");

    const snapshot = await getDocs(collection(db, "admins"));

    const rows = [];
    snapshot.forEach((d) => rows.push(d.data()));

    tbody.innerHTML = rows.length
        ? rows.map((a) => `
            <tr>
                <td>${escapeHtml(a.email)}</td>
                <td>${escapeHtml(a.createdBy || "-")}</td>
            </tr>`).join("")
        : `<tr><td colspan="2">No admins found</td></tr>`;

}

$("adminForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = $("aEmail").value.trim();
    const password = $("aPassword").value;

    if (password.length < 6) {
        setMsg("adminMsg", "Password must be at least 6 characters.", false);
        return;
    }

    try {

        setMsg("adminMsg", "Creating admin...", true);

        const credential = await createUserWithEmailAndPassword(helperAuth, email, password);

        await setDoc(doc(db, "admins", credential.user.uid), {
            email: email,
            createdBy: auth.currentUser?.email || "",
            createdAt: serverTimestamp()
        });

        await signOutHelper(helperAuth);

        setMsg("adminMsg", `Admin account created for ${email}.`, true);
        e.target.reset();
        loadAdmins();

    } catch (error) {

        console.error(error);
        setMsg("adminMsg", error.message, false);

    }

});

// Maintenance mode: settings/site.maintenance closes the whole website
const siteRef = doc(db, "settings", "site");
const maintToggle = $("maintenanceToggle");

onSnapshot(siteRef, (snap) => {
    const on = snap.exists() && snap.data().maintenance === true;
    maintToggle.checked = on;
    const status = $("maintenanceStatus");
    status.textContent = on
        ? "ON: the website is closed for everyone."
        : "OFF: the website is open.";
    status.style.color = on ? "#F87171" : "#34D399";
}, (error) => console.error(error));

maintToggle.addEventListener("change", async () => {

    const on = maintToggle.checked;

    try {
        await setDoc(siteRef, {
            maintenance: on,
            updatedBy: auth.currentUser?.email || "",
            updatedAt: serverTimestamp()
        }, { merge: true });
        setMsg("maintenanceMsg", on ? "Maintenance mode is on." : "Maintenance mode is off.", true);
    } catch (error) {
        console.error(error);
        setMsg("maintenanceMsg", error.message, false);
        maintToggle.checked = !on;
    }

});

// Start
auth.onAuthStateChanged((user) => {
    if (user) {
        showAccount(user);
        loadAdmins().catch(console.error);
    }
});
