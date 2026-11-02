// items-editor.js: add / remove shipment items (products) on admin forms

const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));

// container: element that holds the item rows
// addBtn:    button that adds a new empty row
// items:     existing items to show, e.g. [{ name, quantity, notes }]
export function initItemsEditor(container, addBtn, items = []) {

    const addRow = (item = {}) => {

        const row = document.createElement("div");
        row.className = "item-row";
        row.style.cssText =
            "display:grid;grid-template-columns:2fr 1fr 2fr auto;gap:10px;margin-bottom:10px;align-items:center";

        row.innerHTML = `
            <input type="text" data-field="name" placeholder="Item name"
                   value="${esc(item.name)}">
            <input type="number" min="1" step="1" data-field="quantity" placeholder="Qty"
                   value="${esc(item.quantity ?? 1)}">
            <input type="text" data-field="notes" placeholder="Notes (optional)"
                   value="${esc(item.notes)}">
            <button type="button" class="remove-item"
                    style="width:auto;margin:0;padding:12px 16px;background:#EF4444">✕</button>
        `;

        row.querySelector(".remove-item").addEventListener("click", () => row.remove());

        container.appendChild(row);

    };

    addBtn.addEventListener("click", () => addRow());

    items.forEach((item) => addRow(item));

}

// Returns [{ name, quantity, notes }] for every row with a name
export function readItems(container) {

    return [...container.querySelectorAll(".item-row")]
        .map((row) => ({
            name: row.querySelector('[data-field="name"]').value.trim(),
            quantity: Number(row.querySelector('[data-field="quantity"]').value) || 1,
            notes: row.querySelector('[data-field="notes"]').value.trim()
        }))
        .filter((item) => item.name);

}
