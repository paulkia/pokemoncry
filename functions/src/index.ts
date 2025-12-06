// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
import { onCall, HttpsError } from "firebase-functions/https";

// The Firebase Admin SDK to access Firestore.
import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  Transaction,
} from "firebase-admin/firestore";

const app = initializeApp();

// Get the Firestore instance using the modular function
const db = getFirestore(app);

/**
 * Callable Cloud Function to claim a unique username for the authenticated user.
 * It uses a Firestore transaction to ensure atomicity and prevent race conditions.
 *
 * @param data The request payload, expected to contain 'username'.
 * @param context The function context, containing authentication information.
 * @returns A Promise that resolves with a success message or rejects with an HttpsError.
 */
export const claimUsername = onCall(async (request: any) => {
  if (!request.auth) {
    return;
  }
  // 1. Authenticate the user
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be authenticated to claim a username. Context: " +
        JSON.stringify(request.auth)
    );
  }

  const uid = request.auth.uid;
  const newUsername = request.data.username.toLowerCase().trim(); // Good practice: normalize username

  // 2. Basic validation for the username
  if (
    !newUsername ||
    newUsername.length < 3 ||
    newUsername.length > 20 ||
    !/^[a-z0-9_]+$/.test(newUsername)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Username must be between 3-20 characters long, alphanumeric, and can include underscores."
    );
  }

  // Define references for the documents involved
  const userDocRef = db.collection("users").doc(uid);
  const usernameSentinelDocRef = db.collection("usernames").doc(newUsername); // Sentinel document

  try {
    // 3. Run a Firestore transaction to ensure atomicity
    await db.runTransaction(async (transaction: Transaction) => {
      // Check if the user already has a username to potentially free up the old one
      const currentUserDoc = await transaction.get(userDocRef);
      const oldUsername = currentUserDoc.exists
        ? currentUserDoc.data()?.username
        : null;

      // 4. Check if the new username is already claimed by another user
      const usernameSentinelDoc = await transaction.get(usernameSentinelDocRef);

      if (
        usernameSentinelDoc.exists &&
        usernameSentinelDoc.data()?.uid !== uid
      ) {
        // If the sentinel document exists AND it's claimed by a different user,
        // then the username is taken.
        throw new HttpsError(
          "already-exists",
          `The username "${newUsername}" is already taken.`
        );
      }

      // If the old username exists and is different from the new one, free it up
      if (oldUsername && oldUsername !== newUsername) {
        const oldUsernameSentinelRef = db
          .collection("usernames")
          .doc(oldUsername);
        transaction.delete(oldUsernameSentinelRef); // Delete the old sentinel
      }

      // 5. Claim the new username and update the user's profile
      transaction.set(usernameSentinelDocRef, {
        uid,
        timestamp: FieldValue.serverTimestamp(),
      }); // Create/update sentinel
      transaction.update(userDocRef, {
        username: newUsername,
        updateTimestamp: FieldValue.serverTimestamp(),
        // Keep other existing fields like firebaseId if they are part of the update
        // or ensure they are present if this is an initial creation scenario.
        // For existing users, update would just change 'username'.
      });
    });

    // 6. Return success
    return {
      success: true,
      message: `Username "${newUsername}" successfully claimed.`,
    };
  } catch (error: any) {
    if (error.code) {
      // Re-throw HttpsErrors
      throw error;
    }
    // Log unexpected errors and throw a generic internal error
    console.error("Error claiming username:", error);
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while claiming the username.",
      error.message
    );
  }
});
