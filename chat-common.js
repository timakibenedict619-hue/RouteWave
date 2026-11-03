// chat-common.js: shared helpers for the customer and admin support chat

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatTime(ts) {
  // Server timestamps are null for a moment after sending
  return ts?.toDate
    ? ts.toDate().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Sending...";
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Only links to our Cloudinary account are rendered as clickable
const SAFE_URL = /^https:\/\/res\.cloudinary\.com\//;

function fileIcon(att) {
  const name = (att.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "fa-file-pdf";
  if (/\.(xlsx?|csv)$/.test(name)) return "fa-file-excel";
  if (/\.docx?$/.test(name)) return "fa-file-word";
  if (name.endsWith(".zip")) return "fa-file-zipper";
  return "fa-file-lines";
}

function attachmentNode(att) {

  const url = SAFE_URL.test(att.url || "") ? att.url : "#";
  const isImage = (att.type || "").startsWith("image/");

  if (isImage) {
    const link = el("a", "bubble attach-image");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    const img = el("img");
    img.src = url;
    img.alt = att.name || "Photo";
    img.loading = "lazy";
    link.appendChild(img);
    return link;
  }

  const link = el("a", "bubble attach-file");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.appendChild(el("i", "fa-solid " + fileIcon(att)));

  const info = el("span");
  info.appendChild(el("span", "attach-name", att.name || "File"));
  info.appendChild(el("span", "attach-size", formatSize(att.size)));
  link.appendChild(info);

  return link;

}

// Draw the message bubbles. viewerRole is "customer" or "admin";
// messages from the viewer appear on the right.
export function renderBubbles(container, snap, viewerRole, emptyText) {

  container.innerHTML = "";

  if (snap.empty) {
    container.appendChild(el("p", "empty", emptyText));
    return;
  }

  snap.forEach((d) => {
    const m = d.data();
    const mine = m.from === viewerRole;
    const row = el("div", "bubble-row " + (mine ? "me" : "them"));
    if (m.attachment) row.appendChild(attachmentNode(m.attachment));
    if (m.text) row.appendChild(el("div", "bubble", m.text));
    row.appendChild(el("div", "bubble-time", formatTime(m.createdAt)));
    container.appendChild(row);
  });

  container.scrollTop = container.scrollHeight;

}

// Show an unread count on a badge element; hidden when zero
export function setBadge(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;
  const n = Number(count) || 0;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.hidden = n <= 0;
}
