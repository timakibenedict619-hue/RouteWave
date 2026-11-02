# RouteWave Setup

## 1. Cloudinary (photo uploads)

1. In Cloudinary, go to **Settings → Upload → Upload presets → Add upload preset**.
2. Set **Signing Mode** to **Unsigned**. Set the folder to `routewave/shipments` (optional).
3. Save it, then copy the preset name into `cloudinary.js`:

```js
export const CLOUDINARY_CLOUD_NAME = "v9ef25wm";
export const CLOUDINARY_UPLOAD_PRESET = "YOUR_PRESET_NAME";
```

Never put the Cloudinary API secret in any of these files.

## 2. Firebase

1. **Authentication → Sign-in method:** enable **Email/Password**.
2. **Firestore Database:** create the database if it doesn't exist.
3. **Firestore → Rules:** paste the contents of `firestore.rules` and publish.

## 3. First admin account

The dashboard can only create admins after one admin exists.

1. In **Authentication → Users**, click **Add user** and enter the admin's email and password.
2. Copy that user's **UID**.
3. In **Firestore**, create collection `admins`, then add a document with the UID as its ID and a field `email` (string).

After that, sign in at `admin-login.html` and create more admins from **Customers & Funding**.

## 4. Using the admin panel

- **Create customers:** Customers & Funding → Create Customer. Each customer gets a tracking ID (`CUS…`) to log in with.
- **Fund balances:** enter the customer's tracking ID and an amount. The change is logged under the customer's transactions.
- **Create shipments:** Create Shipment. Choose a customer, add photos (uploaded to Cloudinary), and save. The shipment appears on that customer's dashboard.

## 5. Customer login

Customers go to `customer-login.html` (or the login icon on the main page) and sign in with their **tracking ID, email, and password**. The tracking ID must match the account.

## Known limits

- Shipments are readable by anyone with the Firestore config, so the customer dashboard only *filters* by tracking ID in the browser. For stricter privacy, move shipment reads to Cloud Functions.
- Site content editing (text and images on the main page) is not built yet.
- Editing an existing shipment does not yet add photos or change the assigned customer. Those fields are set on creation only.
