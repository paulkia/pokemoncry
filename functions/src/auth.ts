import { onCall, HttpsError } from "firebase-functions/https";
import { FieldValue, Transaction } from "firebase-admin/firestore";
import { db } from "./firebase";

export const claimUsername = onCall(async (request: any) => {
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

  const userDocRef = db.collection("users").doc(uid);
  const usernameSentinelDocRef = db.collection("usernames").doc(newUsername);

  try {
    await db.runTransaction(async (transaction: Transaction) => {
      const currentUserDoc: any = await transaction.get(userDocRef);
      const oldUsername = currentUserDoc.exists
        ? currentUserDoc.data()?.username
        : null;

      const usernameSentinelDoc: any = await transaction.get(
        usernameSentinelDocRef
      );

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
      transaction.update(userDocRef, {
        username: newUsername,
        updateTimestamp: FieldValue.serverTimestamp(),
      });
    });

    try {
      const runsQuery = await db
        .collection("runs")
        .where("userId", "==", uid)
        .get();

      if (!runsQuery.empty) {
        const batch = db.batch();
        runsQuery.docs.forEach((doc: any) => {
          batch.update(doc.ref, { username: newUsername });
        });
        await batch.commit();
        console.log(
          `Updated ${runsQuery.size} leaderboard run(s) for user ${uid} with new username: ${newUsername}`
        );
      }
    } catch (leaderboardError) {
      console.error("Error updating leaderboard runs:", leaderboardError);
    }

    return {
      success: true,
      message: `Username "${newUsername}" successfully claimed.`,
    };
  } catch (error: any) {
    if (error.code) {
      throw error;
    }
    console.error("Error claiming username:", error);
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while claiming the username.",
      error.message
    );
  }
});
