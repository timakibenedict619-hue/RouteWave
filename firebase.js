// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC1rb8p4KsKaxQK_QVtjWbFE5IStV1F5CI",
    authDomain: "swifttrans-logistics.firebaseapp.com",
    projectId: "swifttrans-logistics",
    storageBucket: "swifttrans-logistics.firebasestorage.app",
    messagingSenderId: "336087148680",
    appId: "1:336087148680:web:d3fb690dd18d2337ca973d",
    measurementId: "G-0W702ZGW7M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Authentication
const auth = getAuth(app);

// Firestore Database
const db = getFirestore(app);

// Export Firebase services
export { app, auth, db };
