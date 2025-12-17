import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { auth as authTrigger } from "firebase-functions/v1";
import { db } from "./firebase.js";

export const claimUsername = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be authenticated to claim a username. Context: " +
        JSON.stringify(request.auth)
    );
  }

  const uid = request.auth.uid;
  const newUsername = request.data.username.toLowerCase().trim();

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

  const userDocRef = db.collection("protected-users").doc(uid);
  const usernameSentinelDocRef = db.collection("usernames").doc(newUsername);

  try {
    await db.runTransaction(async (transaction) => {
      const currentUserDoc = await transaction.get(userDocRef);
      const oldUsername = currentUserDoc.exists
        ? currentUserDoc.data()?.username
        : null;

      const usernameSentinelDoc = await transaction.get(usernameSentinelDocRef);

      if (
        usernameSentinelDoc.exists &&
        usernameSentinelDoc.data()?.uid !== uid
      ) {
        throw new HttpsError(
          "already-exists",
          `The username "${newUsername}" is already taken.`
        );
      }

      if (oldUsername && oldUsername !== newUsername) {
        const oldUsernameSentinelRef = db
          .collection("usernames")
          .doc(oldUsername);
        transaction.delete(oldUsernameSentinelRef);
      }
      transaction.set(usernameSentinelDocRef, {
        uid,
        timestamp: FieldValue.serverTimestamp(),
      });
      transaction.set(
        userDocRef,
        {
          uid: uid,
          username: newUsername,
          updateTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Update leaderboard runs within the same transaction
      const runsQuery = await db
        .collection("public-runs")
        .where("uid", "==", uid)
        .get();

      if (!runsQuery.empty) {
        runsQuery.docs.forEach((doc) => {
          transaction.update(doc.ref, { username: newUsername });
        });
      }
    });
    return {
      success: true,
      message: `Username "${newUsername}" successfully claimed.`,
    };
  } catch (error) {
    logger.error("Error claiming username:", error);
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while claiming the username.",
      error.message
    );
  }
});

// Authentication trigger to delete user data upon account deletion.
// Only supported with v1 functions. https://firebase.google.com/docs/functions/1st-gen/auth-events
export const deleteUser = authTrigger.user().onDelete(async (user) => {
  // Get uid from request.
  const uid = user.uid;
  // Get user's doc.
  const userDocRef = db.collection("protected-users").doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      // Query all runs for this user.
      const runsQuery = await db
        .collection("public-runs")
        .where("uid", "==", uid)
        .get();

      // Query the user document.
      const currentUserDoc = await transaction.get(userDocRef);

      if (!currentUserDoc.exists) {
        logger.error(`User document for uid "${uid}" does not exist.`);
        // Delete all runs for this user.
        if (!runsQuery.empty) {
          runsQuery.docs.forEach((doc) => {
            transaction.delete(doc.ref);
          });
        }
        return;
      }

      // If the username exists, query it from the sentinel document.
      const username = currentUserDoc.data()?.username;
      let usernameSentinelDocRef = null;
      let usernameSentinelDoc = null;

      if (username === null) {
        logger.warn(
          `User with uid "${uid}" does not have a username. Cancelling deletion of sentinel document.`
        );
      } else {
        usernameSentinelDocRef = db.collection("usernames").doc(username);
        usernameSentinelDoc = await transaction.get(usernameSentinelDocRef);
        // Verify that this username belongs to this user.
        if (
          usernameSentinelDoc.exists &&
          usernameSentinelDoc.data()?.uid !== uid
        ) {
          logger.error(
            `The username "${username}" is owned by a different user.`
          );
          return;
        }
      }

      // Delete the user doc.
      transaction.delete(userDocRef);

      // Delete all runs for this user.
      if (!runsQuery.empty) {
        runsQuery.docs.forEach((doc) => {
          transaction.delete(doc.ref);
        });
      }

      // Delete username from sentinel document if it exists.
      if (usernameSentinelDoc !== null && usernameSentinelDoc.exists) {
        transaction.delete(usernameSentinelDocRef);
      }
    });

    return {
      success: true,
      message: `User ${uid} successfully deleted.`,
    };
  } catch (error) {
    logger.error("Error deleting user:", error);
  }
});
