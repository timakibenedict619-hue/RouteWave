// customer-login.js

import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let signingIn = false;

async function getCustomer(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

// Already logged in as a customer? Go to the dashboard
onAuthStateChanged(auth, async (user) => {
  if (!user || signingIn) return;
  try {
    if (await getCustomer(user.uid)) {
      window.location.href = "my-dashboard.html";
    }
  } catch (error) {
    console.error(error);
  }
});

const loginBtn = document.getElementById("loginBtn");
const errorEl = document.getElementById("error");

loginBtn.addEventListener("click", async () => {

  const trackingId = document.getElementById("trackingId").value.trim().toUpperCase();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  errorEl.textContent = "";

  if (!trackingId || !email || !password) {
    errorEl.textContent = "Please enter your tracking ID, email and password.";
    return;
  }

  try {

    signingIn = true;
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    const credential = await signInWithEmailAndPassword(auth, email, password);

    const customer = await getCustomer(credential.user.uid);

    if (!customer || (customer.trackingId || "").toUpperCase() !== trackingId) {
      await signOut(auth);
      throw new Error("Tracking ID does not match this account.");
    }

    window.location.href = "my-dashboard.html";

  } catch (error) {

    signingIn = false;
    errorEl.textContent = error.message;

    loginBtn.disabled = false;
    loginBtn.textContent = "Login";

  }

});
