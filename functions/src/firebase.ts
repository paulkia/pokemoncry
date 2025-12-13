import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const app = initializeApp();
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
