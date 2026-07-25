// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Configuration
const const firebaseConfig = {
  apiKey: "AIzaSyDTso8vgiWM5-K9yIyyhR0z2mqx9FyIp_w",
  authDomain: "routewave-69c6e.firebaseapp.com",
  projectId: "routewave-69c6e",
  storageBucket: "routewave-69c6e.firebasestorage.app",
  messagingSenderId: "175645333092",
  appId: "1:175645333092:web:abde7acaa1ac4677adf171",
  measurementId: "G-KKG9DXBZXK"
};

    
    
    

    
   

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Authentication
const auth = getAuth(app);

// Firestore Database
const db = getFirestore(app);

// Export Firebase services
export { app, auth, db };
