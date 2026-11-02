import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Only accounts listed in the "admins" collection may use admin pages
export async function isAdmin(user) {
  const snapshot = await getDoc(doc(db, "admins", user.uid));
  return snapshot.exists();
}

// Protect admin pages
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "admin-login.html";
    return;
  }

  let allowed = false;

  try {
    allowed = await isAdmin(user);
  } catch (error) {
    console.error(error);
  }

  if (!allowed) {
    alert("This account does not have admin access.");
    await signOut(auth);
    window.location.href = "admin-login.html";
    return;
  }

  const adminEmail = document.getElementById("adminEmail");

  if (adminEmail) {
    adminEmail.textContent = user.email;
  }

  // Admin confirmed: show the page
  document.documentElement.classList.remove("gate");

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
