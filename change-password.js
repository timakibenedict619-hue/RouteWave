// change-password.js: customer changes their own password

import { auth } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = (id) => document.getElementById(id);

const pwForm = $("passwordForm");
const pwMsg = $("passwordMsg");

function setPwMsg(text, ok) {
  pwMsg.textContent = text;
  pwMsg.className = "msg " + (ok ? "ok" : "err");
}

// Signed-out visitors go back to the customer login
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "customer-login.html";
    return;
  }
  $("userEmail").textContent = user.email || "-";
});

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "customer-login.html";
});

pwForm.addEventListener("submit", async (e) => {

  e.preventDefault();

  const current = $("pwCurrent").value;
  const next = $("pwNew").value;
  const confirm = $("pwConfirm").value;
  const user = auth.currentUser;

  if (!user) return;

  if (next.length < 6) {
    setPwMsg("The new password must be at least 6 characters.", false);
    return;
  }

  if (next !== confirm) {
    setPwMsg("The new passwords don't match.", false);
    return;
  }

  if (next === current) {
    setPwMsg("Choose a password different from your current one.", false);
    return;
  }

  const button = pwForm.querySelector("button[type='submit']");
  button.disabled = true;
  setPwMsg("Updating password...", true);

  try {

    // Re-check the current password before changing it
    const credential = EmailAuthProvider.credential(user.email, current);
    await reauthenticateWithCredential(user, credential);

    await updatePassword(user, next);

    setPwMsg("Your password has been changed.", true);
    pwForm.reset();

  } catch (error) {

    console.error(error);

    const messages = {
      "auth/invalid-credential": "The current password is incorrect.",
      "auth/wrong-password": "The current password is incorrect.",
      "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
      "auth/weak-password": "That password is too weak. Use at least 6 characters.",
      "auth/requires-recent-login": "Please sign out, sign in again, and then change your password."
    };

    setPwMsg(messages[error.code] || error.message, false);

  } finally {
    button.disabled = false;
  }

});
