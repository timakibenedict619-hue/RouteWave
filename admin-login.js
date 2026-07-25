import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// If already logged in, go directly to admin dashboard
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "dashboard.html";
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

    await signInWithEmailAndPassword(auth, email, password);

    window.location.href = "dashboard.html";

  } catch (err) {

    error.textContent = err.message;

    loginBtn.disabled = false;
    loginBtn.textContent = "Login";

  }

});