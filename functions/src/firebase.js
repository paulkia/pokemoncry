import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getFunctions } from "firebase-admin/functions";
import { getAuth } from "firebase-admin/auth";

const app = initializeApp();
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
const auth = getAuth(app);

export { db, functions, storage, auth };
