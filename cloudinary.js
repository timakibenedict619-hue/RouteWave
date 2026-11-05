// cloudinary.js
// Image uploads for shipment photos.
// Uses an UNSIGNED upload preset so no API secret is ever exposed in the browser.

export const CLOUDINARY_CLOUD_NAME = "v9ef25wm";

// Create an UNSIGNED upload preset in Cloudinary:
// Settings > Upload > Upload presets > Add upload preset > Signing Mode: Unsigned
// Then replace the value below with that preset's name.
export const CLOUDINARY_UPLOAD_PRESET = "savage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadImage(file, folder = "routewave/shipments") {

    if (!file.type.startsWith("image/")) {
        throw new Error(`"${file.name}" is not an image.`);
    }

    if (file.size > MAX_BYTES) {
        throw new Error(`"${file.name}" is larger than 10 MB.`);
    }

    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    body.append("folder", folder);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "Photo upload failed.");
    }

    // Permanent HTTPS URL, stored in Firestore
    return data.secure_url;
}

// Chat attachments: photos and common documents only
const CHAT_FILE_TYPES = /\.(jpe?g|png|gif|webp|pdf|docx?|xlsx?|csv|txt|zip)$/i;

export async function uploadChatFile(file, folder = "routewave/chat") {

    if (!CHAT_FILE_TYPES.test(file.name)) {
        throw new Error(`"${file.name}" is not a supported file type.`);
    }

    if (file.size > MAX_BYTES) {
        throw new Error(`"${file.name}" is larger than 10 MB.`);
    }

    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    body.append("folder", folder);

    // "auto" accepts both photos and documents
    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        { method: "POST", body }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "File upload failed.");
    }

    return {
        url: data.secure_url,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size
    };
}

// Encrypted attachments: the browser has already encrypted the file, so it goes up as a raw blob
export async function uploadRawBlob(blob, folder = "routewave/chat-encrypted") {

    if (blob.size > MAX_BYTES + 1024) {
        throw new Error("This file is larger than 10 MB.");
    }

    const body = new FormData();
    body.append("file", blob, "encrypted.bin");
    body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    body.append("folder", folder);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
        { method: "POST", body }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "File upload failed.");
    }

    return data.secure_url;
}
