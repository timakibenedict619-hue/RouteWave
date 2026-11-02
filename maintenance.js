// maintenance.js: closes the site when an admin switches maintenance mode on.
// Included on every public, customer and admin page except the two below.

import { db } from "./firebase.js";

import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// These stay open so an admin can sign in and switch maintenance off.
const OPEN_PAGES = ["admin-login.html", "admin-settings.html"];

// Admin pages get a link to Settings; public and customer pages get an admin sign-in link.
const ADMIN_PAGES = [
  "dashboard.html",
  "create-shipment.html",
  "manage-shipments.html",
  "view-shipment.html",
  "edit-shipment.html",
  "admin-customers.html"
];

const page = window.location.pathname.split("/").pop() || "index.html";

if (!OPEN_PAGES.includes(page)) {

  let overlay = null;

  function showOverlay() {

    if (overlay) return;

    const isAdminPage = ADMIN_PAGES.includes(page);

    const adminLink = isAdminPage
      ? `<a href="admin-settings.html" style="${linkStyle}">Open Settings to turn maintenance off</a>`
      : `<a href="admin-login.html" style="${linkStyle}">Admin sign in</a>`;

    overlay = document.createElement("div");
    overlay.id = "maintenanceOverlay";
    overlay.setAttribute("role", "alert");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:#0B1220;color:#fff;" +
      "display:flex;align-items:center;justify-content:center;padding:24px;" +
      "text-align:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;";

    overlay.innerHTML = `
      <div style="max-width:520px">
        <div style="width:72px;height:72px;margin:0 auto 22px;border-radius:20px;background:linear-gradient(135deg,#6D28D9,#0E7490);display:flex;align-items:center;justify-content:center;font-size:28px">
          <i class="fa-solid fa-screwdriver-wrench"></i>
        </div>
        <h1 style="color:#fff;font-size:32px;margin:0 0 12px;letter-spacing:-.02em">We'll be right back</h1>
        <p style="color:#CBD5E1;font-size:16px;line-height:1.6;margin:0 0 26px">
          RouteWave is temporarily closed while we make improvements. Please check back shortly.
        </p>
        <div style="display:flex;gap:18px;justify-content:center;flex-wrap:wrap;font-size:14px">
          ${adminLink}
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

  }

  function hideOverlay() {

    if (overlay) overlay.remove();
    overlay = null;
    document.body.style.overflow = "";

  }

  // Live: the site closes or reopens without a reload
  onSnapshot(
    doc(db, "settings", "site"),
    (snap) => {
      if (snap.exists() && snap.data().maintenance === true) {
        showOverlay();
      } else {
        hideOverlay();
      }
    },
    (error) => {
      // If the settings can't be read, keep the site open rather than locking everyone out
      console.error("Maintenance check failed:", error);
      hideOverlay();
    }
  );

}

const linkStyle = "color:#A5F3FC;font-weight:600;text-decoration:underline;";
