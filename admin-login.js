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

async function isAdmin(user) {
  const snapshot = await getDoc(doc(db, "admins", user.uid));
  return snapshot.exists();
}

// If already logged in as an admin, go directly to the dashboard
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    if (await isAdmin(user)) {
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    console.error(error);
  }
});

const loginBtn = document.getElementById("loginBtn");

loginBtn.addEventListener("click", async () => {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const error = document.getElementById("error");

  error.textContent = "";

  if (!email || !password) {
    error.textContent = "Please enter your email and password.";
    return;
  }

  try {

    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    const credential = await signInWithEmailAndPassword(auth, email, password);

    if (!(await isAdmin(credential.user))) {
      await signOut(auth);
      throw new Error("This account does not have admin access.");
    }

    window.location.href = "dashboard.html";

  } catch (err) {

    error.textContent = err.message;

    loginBtn.disabled = false;
    loginBtn.textContent = "Login";

  }

});
