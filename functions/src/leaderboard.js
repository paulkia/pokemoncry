import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { genToMons } from "./util.js";
import { logger } from "firebase-functions";

const EVERY_HOUR = "every 1 hours";
const BATCH_SIZE = 500;
const GEN_COUNT = Object.keys(genToMons).length;

/**
 * Deletes anonymous users who last signed in more than 6 hours ago.
 * This function is scheduled to run daily.
 */
export const recalculateRanks = onSchedule(
  {
    schedule: EVERY_HOUR,
  },
  async (_) => {
    const collectionRef = db.collection("public-runs");

    // 1. Identify all unique categories (Gen/Mode combinations)
    // In a production app, you might hardcode these or fetch from a 'config' doc
    const modes = ["fast", "full"];
    for (const mode of modes) {
      for (let gen = 0; gen < GEN_COUNT + 1; gen++) {
        logger.info(`Updating ranks for Mode: ${mode}, Gen: ${gen}`);

        // 2. Fetch all runs for this category ordered by score
        // We only select the ID to keep memory usage low
        const snapshot = await collectionRef
          .where("mode", "==", mode)
          .where("gen", "==", gen)
          .orderBy("score", "desc")
          .select() // Optimization: Don't pull full doc body, just the reference
          .get();

        if (snapshot.empty) continue;

        // 3. Prepare Batched Writes (Firestore limit is 500 per batch)
        let batch = db.batch();
        let count = 0;
        const timestamp = FieldValue.serverTimestamp();

        for (let i = 0; i < snapshot.docs.length; i++) {
          const docRef = snapshot.docs[i].ref;
          const rank = i + 1;

          batch.update(docRef, {
            globalRank: rank,
            rankUpdatedAt: timestamp,
          });

          count++;

          // If we hit enough operations, commit and start a new batch
          if (count === BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            count = 0;
          }
        }

        // Commit any remaining updates
        if (count > 0) {
          await batch.commit();
        }
      }
    }

    logger.info("Global rank recalculation complete.");
  }
);
