import { auth } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Protect admin pages
onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "admin-login.html";
    return;
  }

  const adminEmail = document.getElementById("adminEmail");

  if (adminEmail) {
    adminEmail.textContent = user.email;
  }

});

// Logout
window.logout = async function () {

  if (!confirm("Are you sure you want to logout?")) return;

  try {

    await signOut(auth);

    window.location.href = "admin-login.html";

  } catch (error) {

    alert(error.message);

  }

};
