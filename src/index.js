import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { connectStorageEmulator } from "firebase/storage";

// Import Firebase SDKs
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { app, db, storage, auth } from "./firebase";

import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

if (
  process.env.NODE_ENV === "development" ||
  window.location.hostname === "localhost"
) {
  console.log("hostname = ", window.location.hostname);
  console.log("Connecting to Firebase Emulators...");
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

  // Get service instances
  const functions = getFunctions(app);

  // Connect to Emulators
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);

  connectAuthEmulator(auth, "http://127.0.0.1:9099");

  connectFirestoreEmulator(db, "127.0.0.1", 8080);

  // Connect to Storage Emulator
  connectStorageEmulator(storage, "127.0.0.1", 9199);

  // Important: If you use the Firebase Admin SDK for any client-side mocks
  // or a hybrid approach (less common), you might need more specific setup
  // but for typical client-side React, this is sufficient.
} else {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      "6LecaBksAAAAAFHwGfjPN1Y6G76k4iWkJsqcB367"
    ),
    isTokenAutoRefreshEnabled: true,
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
