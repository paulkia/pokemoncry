import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKC0eQeUK_H2yn8EIKOxCU0p8i_WPKisU",
  authDomain: "guessthecry.firebaseapp.com",
  projectId: "guessthecry",
  storageBucket: "guessthecry.firebasestorage.app",
  messagingSenderId: "120789701006",
  appId: "1:120789701006:web:ce6c186dd5a3ebec0e54df",
  measurementId: "G-3PJM1S7EPR",
};

// Initialize Firebase (ensure single instance)
const app = initializeApp(firebaseConfig);
// Modular SDK: derive service instances from the initialized app
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// Initialize Analytics and get a reference to the service
const analytics = getAnalytics(app);

// Named exports for convenience; keep default for legacy imports
export { auth, db, storage, app, analytics };
export default app;
