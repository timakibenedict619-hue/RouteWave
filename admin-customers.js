// admin-customers.js: create customers, fund balances, manage admins

import { auth, db, app } from "./firebase.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signOut as signOutHelper
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    query,
    where,
    setDoc,
    addDoc,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// A second Firebase app lets the admin create other accounts
// without being signed out of their own session.
const helperApp = initializeApp(app.options, "adminHelper");
const helperAuth = getAuth(helperApp);

const $ = (id) => document.getElementById(id);

const money = (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
        .format(Number(n || 0));

const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

function setMsg(id, text, ok) {
    const el = $(id);
    el.textContent = text;
    el.style.color = ok ? "#34D399" : "#F87171";
}

function newTrackingId() {
    return "CUS" + Math.floor(10000000 + Math.random() * 90000000);
}

async function uniqueTrackingId() {
    while (true) {
        const id = newTrackingId();
        const snap = await getDocs(
            query(collection(db, "users"), where("trackingId", "==", id))
        );
        if (snap.empty) return id;
    }
}

// Credit a customer's balance and log the transaction
async function fundByTrackingId(trackingId, amount, note) {

    if (!(amount > 0)) {
        throw new Error("Enter an amount greater than 0.");
    }

    const snap = await getDocs(
        query(
            collection(db, "users"),
            where("trackingId", "==", trackingId.trim().toUpperCase())
        )
    );

    if (snap.empty) {
        throw new Error("No customer found with that tracking ID.");
    }

    const userRef = snap.docs[0].ref;

    await runTransaction(db, async (tx) => {

        const userSnap = await tx.get(userRef);
        const current = Number(userSnap.data().balance || 0);

        tx.update(userRef, { balance: current + amount });

        tx.set(doc(collection(db, "users", userRef.id, "transactions")), {
            amount: amount,
            type: "credit",
            note: note || "",
            by: auth.currentUser?.email || "",
            createdAt: serverTimestamp()
        });

    });

    return snap.docs[0].data().name;

}

// Customers table
async function loadCustomers() {

    const tbody = $("customerTable");
    tbody.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;

    const snap = await getDocs(collection(db, "users"));

    const rows = [];
    snap.forEach((d) => rows.push(d.data()));
    rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">No customers yet</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((c) => `
        <tr>
            <td>${escapeHtml(c.name || "-")}</td>
            <td><code>${escapeHtml(c.trackingId)}</code></td>
            <td>${escapeHtml(c.email)}</td>
            <td>${money(c.balance)}</td>
        </tr>
    `).join("");

}

// Admins table
async function loadAdmins() {

    const tbody = $("adminTable");

    const snap = await getDocs(collection(db, "admins"));

    const rows = [];
    snap.forEach((d) => rows.push(d.data()));

    tbody.innerHTML = rows.length
        ? rows.map((a) => `<tr><td>${escapeHtml(a.email)}</td></tr>`).join("")
        : `<tr><td>No admins found</td></tr>`;

}

// Create customer
$("createCustomerForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const name = $("cName").value.trim();
    const email = $("cEmail").value.trim();
    const password = $("cPassword").value;
    const opening = Number($("cBalance").value || 0);

    if (password.length < 6) {
        setMsg("customerMsg", "Password must be at least 6 characters.", false);
        return;
    }

    try {

        setMsg("customerMsg", "Creating customer...", true);

        const trackingId = await uniqueTrackingId();

        const credential = await createUserWithEmailAndPassword(helperAuth, email, password);

        await setDoc(doc(db, "users", credential.user.uid), {
            uid: credential.user.uid,
            name: name,
            email: email,
            trackingId: trackingId,
            balance: 0,
            role: "customer",
            createdAt: serverTimestamp()
        });

        await signOutHelper(helperAuth);

        if (opening > 0) {
            await fundByTrackingId(trackingId, opening, "Opening balance");
        }

        setMsg("customerMsg", `Customer created. Tracking ID: ${trackingId}`, true);
        e.target.reset();
        loadCustomers();

    } catch (error) {

        console.error(error);
        setMsg("customerMsg", error.message, false);

    }

});

// Fund customer by tracking ID
$("fundForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const trackingId = $("fundTrackingId").value;
    const amount = Number($("fundAmount").value);
    const note = $("fundNote").value.trim();

    try {

        setMsg("fundMsg", "Funding...", true);

        const name = await fundByTrackingId(trackingId, amount, note);

        setMsg("fundMsg", `Added ${money(amount)} to ${name || trackingId}.`, true);
        e.target.reset();
        loadCustomers();

    } catch (error) {

        console.error(error);
        setMsg("fundMsg", error.message, false);

    }

});

// Create admin account
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

loadCustomers().catch(console.error);
loadAdmins().catch(console.error);
