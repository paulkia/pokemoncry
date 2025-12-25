import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db, auth } from "./firebase.js";
import { Filter } from "firebase-admin/firestore";

// Uncomment later. currently using small interval for debugging
const DAILY = "every 1 hours"; // "every 24 hours";
const FREQUENT = "every 1 hours"; // "every 6 hours";

const OLD_ANONYMOUS_USER_THRESHOLD_HOURS = 1; // 6;
const OLD_ANONYMOUS_RUN_THRESHOLD_HOURS = 1; // 12;
const OLD_SESSION_THRESHOLD_HOURS = 1; // 3;

/**
 * Deletes anonymous users who last signed in more than 6 hours ago.
 * This function is scheduled to run daily.
 */
export const deleteOldAnonymousUsers = onSchedule(
  {
    schedule: DAILY,
  },
  async (_) => {
    // Current time minus 6 hours in milliseconds
    const expiredSignInTime =
      Date.now() - OLD_ANONYMOUS_USER_THRESHOLD_HOURS * 60 * 60 * 1000;
    let usersToDelete = [];
    let nextPageToken;

    try {
      // List all users, handling pagination
      do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken); // Fetch up to 1000 users at a time
        nextPageToken = listUsersResult.pageToken;

        listUsersResult.users.forEach((user) => {
          // Check if the user is anonymous and their last sign-in was more than 6 hours ago
          // Anonymous users have a provider data entry like { providerId: 'anonymous' }
          const isAnonymous =
            user.providerData.length === 0 ||
            user.providerData.some(
              (provider) =>
                provider.providerId === "anonymous" ||
                (provider.providerId === "firebase" && user.isAnonymous)
            );
          if (isAnonymous && user.metadata && user.metadata.lastSignInTime) {
            const lastSignInTimestamp = new Date(
              user.metadata.lastSignInTime
            ).getTime();
            if (lastSignInTimestamp < expiredSignInTime) {
              usersToDelete.push(user);
            }
          }
        });
      } while (nextPageToken);

      if (usersToDelete.length > 0) {
        logger.info(
          `Found ${usersToDelete.length} anonymous users older than 6 hours to delete.`
        );
        // Iterate and delete individually to trigger onDelete function for each
        for (const user of usersToDelete) {
          try {
            await auth.deleteUser(user.uid);
            logger.info(`Successfully deleted anonymous user: ${user.uid}`);
          } catch (deleteError) {
            logger.error(
              `Error deleting anonymous user ${user.uid}:`,
              deleteError
            );
            // Continue with other deletions even if one fails
          }
        }
        logger.info("Finished attempting to delete old anonymous users.");
      } else {
        logger.info(
          "No anonymous users older than 6 hours found for deletion."
        );
      }
    } catch (error) {
      logger.error("Error listing or deleting users:", error);
      // You might want to rethrow or report this error for alerting
    }
  }
);

export const deleteOldAnonymousRuns = onSchedule(
  {
    schedule: FREQUENT,
  },
  async (_) => {
    const expiredRunTime =
      Date.now() - OLD_ANONYMOUS_RUN_THRESHOLD_HOURS * 60 * 60 * 1000;

    try {
      const runsQuery = db
        .collection("public-runs")
        .where("username", "==", "Anonymous")
        .where("createdAt", "<", new Date(expiredRunTime));

      const runsSnapshot = await runsQuery.get();

      if (runsSnapshot.empty) {
        logger.info("No old anonymous runs found for deletion.");
        return;
      }

      let deleteCount = 0;
      const batch = db.batch();

      runsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleteCount++;
      });

      await batch.commit();
      logger.info(`Successfully deleted ${deleteCount} old anonymous runs.`);
    } catch (error) {
      logger.error("Error deleting old anonymous runs:", error);
    }
  }
);

export const deleteOldSessions = onSchedule(
  {
    schedule: FREQUENT,
  },
  async (_) => {
    const expiredSessionTime =
      Date.now() - OLD_SESSION_THRESHOLD_HOURS * 60 * 60 * 1000;
    try {
      const sessionsQuery = db
        .collection("sessions")
        .where("lastActivityAt", "<", new Date(expiredSessionTime));
      const sessionsSnapshot = await sessionsQuery.get();

      if (sessionsSnapshot.empty) {
        logger.info("No old sessions found for deletion.");
        return;
      }

      let deleteCount = 0;
      const batch = db.batch();

      sessionsSnapshot.docs.forEach((doc) => {
        db.collection("protected-sessions").doc(doc.id).delete();
        batch.delete(doc.ref);
        deleteCount++;
      });

      await batch.commit();
      logger.info(`Successfully deleted ${deleteCount} old sessions.`);
    } catch (error) {
      logger.error("Error deleting old sessions:", error);
    }
  }
);

/**
 * Helper function to efficiently query and delete all documents in the 'runs'
 * collection for a given zombie UID, handling the 500 batch limit.
 *
 * @param zombieUid The Firebase Auth UID of the zombie user.
 * @returns The total count of runs documents deleted.
 */
async function deleteRunsForZombieUser(zombieUid) {
  let totalDeleted = 0;
  let keepDeleting = true;
  const batchSize = 499; // Using 499 to be safe, as the max is 500 batched writes.

  while (keepDeleting) {
    // Query for a batch of documents where 'uid' matches the zombieUid
    // The query is ordered and limited to ensure we grab distinct batches.
    const runsQuery = db
      .collection("public-runs")
      .where("uid", "==", zombieUid)
      .limit(batchSize);

    const runsSnapshot = await runsQuery.get();

    // If no documents are found, we are done.
    if (runsSnapshot.size === 0) {
      keepDeleting = false;
      break;
    }

    const deleteBatch = db.batch();
    runsSnapshot.docs.forEach((doc) => {
      deleteBatch.delete(doc.ref);
      totalDeleted++;
    });

    // Commit the batch delete
    await deleteBatch.commit();
    logger.info(
      `Deleted a batch of ${runsSnapshot.size} runs for UID ${zombieUid}. Total deleted: ${totalDeleted}`
    );

    // If the number of documents retrieved is less than the limit,
    // it means we reached the end of the matching documents.
    if (runsSnapshot.size < batchSize) {
      keepDeleting = false;
    }

    // Note: For a true large-scale deletion, you might want to introduce
    // a small delay here (e.g., await new Promise(resolve => setTimeout(resolve, 500));)
    // to avoid hitting Firestore write limits, though not strictly required.
  }
  return totalDeleted;
}

/**
 * Deletes user data from Firestore for accounts that no longer exist in Firebase Authentication (Zombie accounts).
 *
 * Runs every day at midnight (00:00).
 */
export const deleteZombieUserData = onSchedule(
  {
    schedule: DAILY,
  },
  async (_) => {
    logger.info("Starting zombie user data cleanup...");

    const zombieUids = [];
    let usersDeleted = 0;
    let usernamesDeleted = 0;
    let runsDeleted = 0;

    try {
      // 1. Fetch all documents from the 'users' collection
      const usersSnapshot = await db.collection("protected-users").get();

      // 2. Determine which 'users' documents are zombies (no corresponding auth user)
      // This is the most expensive part of this step, as it calls the Auth API for every user.
      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        try {
          // Attempt to get the user from Firebase Auth
          await auth.getUser(uid);
          // If successful, the user is NOT a zombie. Continue to the next one.
        } catch (error) {
          // The typical error for a user not found is 'auth/user-not-found'
          if (
            error.code === "auth/user-not-found" ||
            error.message.includes("No user record found")
          ) {
            logger.info(`Found zombie UID: ${uid}`);
            zombieUids.push(uid);
          } else {
            // Log other unexpected errors with Auth API access
            logger.error(`Error checking Auth for UID ${uid}:`, error);
          }
        }
      }

      if (zombieUids.length === 0) {
        logger.info("No zombie users found. Cleanup finished.");
        return null;
      }

      logger.info(`Identified ${zombieUids.length} zombie users for deletion.`);

      // 3. Delete the zombie user data from 'users' and 'usernames' collections using a batch.
      const batch = db.batch();
      const usernamesRef = db.collection("usernames");

      for (const uid of zombieUids) {
        const userDocRef = db.collection("protected-users").doc(uid);
        const userData = userDocRef.get(); // Pre-fetch to get 'username'

        // a. Delete the document from the 'users' collection
        batch.delete(userDocRef);
        usersDeleted++;

        // b. Check and conditionally delete from the 'usernames' collection
        const username = (await userData).data()?.username;
        if (username) {
          const usernameDocRef = usernamesRef.doc(username);
          const usernameDoc = await usernameDocRef.get();

          // Only delete the username entry if its 'uid' field matches the zombie uid
          if (usernameDoc.exists && usernameDoc.data()?.uid === uid) {
            batch.delete(usernameDocRef);
            usernamesDeleted++;
          }
        }
      }

      // Commit the batch for 'users' and 'usernames'
      await batch.commit();
      logger.info(
        `Successfully completed batch delete for ${usersDeleted} users and ${usernamesDeleted} usernames.`
      );

      // 4. Delete associated documents from the 'runs' collection.
      // NOTE: This step is handled separately outside the batch because batched writes are limited to 500 operations.
      // This is the step where efficiency is key.
      for (const uid of zombieUids) {
        runsDeleted += await deleteRunsForZombieUser(uid);
      }

      logger.info(
        `Successfully deleted ${runsDeleted} documents from the 'runs' collection.`
      );
    } catch (error) {
      logger.error("An error occurred during zombie user cleanup:", error);
      // Throw the error to indicate the function execution failed.
      throw error;
    }

    logger.info("Zombie user data cleanup completed successfully.");
    return {
      zombieUsersFound: zombieUids.length,
      usersDeleted: usersDeleted,
      usernamesDeleted: usernamesDeleted,
      runsDeleted: runsDeleted,
    };
  }
);
