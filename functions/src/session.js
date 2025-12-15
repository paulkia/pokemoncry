// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
import { onCall, HttpsError } from "firebase-functions/https";

// The Firebase Admin SDK to access Firestore.
import { FieldValue } from "firebase-admin/firestore";
import { db, storage } from "./firebase.js";
import { genToMons } from "./util.js";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Gets the list of Mon names based on generation selection
 */
function getMonList(generation, mode) {
  let allMon = [];

  if (generation === 0) {
    allMon = Object.values(genToMons).flat();
  } else {
    // Fetch specific generation
    allMon = genToMons[generation];
  }

  // Shuffle the list
  const shuffled = shuffle(allMon);

  // Return 20 or all based on mode
  if (mode === "fast") {
    return shuffled.slice(0, 20);
  }
  return shuffled;
}

/**
 * Calculates score increment based on answer time
 */
function calculateScoreIncrement(timeMs) {
  const x = timeMs / 1000;
  return Math.exp(-0.5 * x + 2.5) + 1;
}

/**
 * Gets the Firebase Storage path for a Mon cry
 */
function getCryPath(monName, useLegacy) {
  const cryType = useLegacy ? "legacy" : "latest";
  return `cries/${monName}-${cryType}.mp3`;
}

/**
 * Downloads a cry file from Firebase Storage and returns it as base64
 */
async function getCryAudioData(monName, useLegacy) {
  try {
    const path = getCryPath(monName, useLegacy);
    const bucket = storage.bucket();
    const file = bucket.file(path);

    // Download the file as a buffer
    const [fileBuffer] = await file.download();

    // Convert to base64 for easy transmission
    return fileBuffer.toString("base64");
  } catch (error) {
    console.error(`Error downloading cry for ${monName}:`, error);
    throw new HttpsError(
      "internal",
      `Failed to load audio file for ${monName}`
    );
  }
}

// ============================================================================
// CLOUD FUNCTIONS
// ============================================================================

/**
 * Cloud Function: startSession
 *
 * Creates a new game session for the authenticated user.
 *
 * @param data.generation - Generation to play: 1-9 or 0 ("all")
 *   Note: Client currently supports selecting multiple generations (e.g., [1,2,3]).
 *   For now, if you need multi-gen support, either:
 *   1. Pass 0 when multiple generations are selected, or
 *   2. Modify this function to accept an array of generation numbers
 * @param data.mode - "fast" (20 mon) or "full" (all mon)
 * @param data.useLegacyCries - boolean, whether to use legacy cries
 *
 * @returns sessionId, firstMonCryUrl, totalMonCount
 */
export const startSession = onCall(async (request) => {
  // 1. Authenticate the user
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be authenticated to start a session."
    );
  }

  const uid = request.auth.uid;
  const { generation, mode, useLegacyCries } = request.data;

  // 2. Validate inputs
  if (
    generation !== 0 &&
    (typeof generation !== "number" || generation < 1 || generation > 9)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Generation must be a number between 1-9 or 0."
    );
  }

  if (mode !== "fast" && mode !== "full") {
    throw new HttpsError(
      "invalid-argument",
      "Mode must be either 'fast' or 'full'."
    );
  }

  if (typeof useLegacyCries !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "useLegacyCries must be a boolean."
    );
  }

  try {
    // 3. Get user's username from Firestore
    const userDoc = await db.collection("users").doc(uid).get();
    const username = userDoc.exists ? userDoc.data()?.username || null : null;

    // 4. Generate Mon list
    const monList = getMonList(generation, mode);

    if (monList.length === 0) {
      throw new HttpsError(
        "internal",
        "Failed to generate Mon list for the session."
      );
    }

    // 5. Create session document
    const sessionData = {
      userId: uid,
      username,
      generation,
      mode,
      useLegacyCries,
      monList,
      currentIndex: 0,
      correct: [],
      incorrect: [],
      answerTimes: [],
      streak: 0,
      longestStreak: 0,
      score: 0,
      fastestTimeMs: Number.MAX_SAFE_INTEGER,
      bestMon: "",
      startedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
      status: "active",
    };

    const sessionRef = await db.collection("sessions").add(sessionData);

    // 6. Get the first Mon's cry audio data
    const firstMonCryData = await getCryAudioData(monList[0], useLegacyCries);

    return {
      success: true,
      sessionId: sessionRef.id,
      firstMonCryData, // Base64 encoded audio
      totalMonCount: monList.length,
    };
  } catch (error) {
    if (error.code) {
      throw error;
    }
    console.error("Error starting session:", error);
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while starting the session.",
      error.message
    );
  }
});

/**
 * Cloud Function: checkAnswer
 *
 * Validates the user's answer for the current Mon in the session,
 * updates the session state, calculates score, and provides the next cry audio data.
 * If the game is complete, updates the leaderboard if it's a new high score.
 *
 * @param data.sessionId - The session ID
 * @param data.answer - The user's guess (mon name)
 *
 * @returns AnswerResult with correctness, score updates, and next cry data (base64) or final stats
 */
export const checkAnswer = onCall(async (request) => {
  // 1. Authenticate the user
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be authenticated to submit an answer."
    );
  }

  const uid = request.auth.uid;
  const { sessionId, answer } = request.data;

  // 2. Validate inputs
  if (!sessionId || typeof sessionId !== "string") {
    throw new HttpsError("invalid-argument", "Valid sessionId is required.");
  }

  if (!answer || typeof answer !== "string") {
    throw new HttpsError("invalid-argument", "Valid answer is required.");
  }

  try {
    const sessionRef = db.collection("sessions").doc(sessionId);

    // 3. Use a transaction to ensure atomicity
    const result = await db.runTransaction(async (transaction) => {
      const sessionDoc = await transaction.get(sessionRef);

      if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "Session not found.");
      }

      const session = sessionDoc.data();

      // Verify session belongs to user
      if (session.userId !== uid) {
        throw new HttpsError(
          "permission-denied",
          "You do not have permission to access this session."
        );
      }

      // Check if session is still active
      if (session.status !== "active") {
        throw new HttpsError(
          "failed-precondition",
          "Session is not active. It may have already been completed."
        );
      }

      const timeMs = Date.now() - session.lastActivityAt.toMillis();

      // Get current Mon
      const currentMon = session.monList[session.currentIndex];
      const isCorrect =
        answer.toLowerCase().trim() === currentMon.toLowerCase().trim();

      // Calculate score
      let newStreak = session.streak;
      let scoreIncrement = 0;

      if (isCorrect) {
        newStreak += 1;
        const baseScore = calculateScoreIncrement(timeMs);
        const streakMultiplier = Math.min(newStreak, 10) / 5 + 1;
        scoreIncrement = baseScore * streakMultiplier;
      } else {
        newStreak = 0;
      }

      let newScore = session.score + scoreIncrement;
      const newLongestStreak = Math.max(session.longestStreak, newStreak);

      // Track fastest time and best mon
      let newFastestTimeMs = session.fastestTimeMs;
      let newBestMon = session.bestMon;
      if (isCorrect && timeMs < session.fastestTimeMs) {
        newFastestTimeMs = timeMs;
        newBestMon = currentMon;
      }

      // Update arrays
      const newCorrect = isCorrect
        ? [...session.correct, currentMon]
        : session.correct;
      const newIncorrect = !isCorrect
        ? [...session.incorrect, currentMon]
        : session.incorrect;
      const newAnswerTimes = [...session.answerTimes, timeMs];

      // Move to next mon
      const newIndex = session.currentIndex + 1;
      const isGameComplete = newIndex >= session.monList.length;
      if (isGameComplete) {
        newScore = Math.ceil(newScore);
      }

      // Update session
      const updates = {
        currentIndex: newIndex,
        correct: newCorrect,
        incorrect: newIncorrect,
        answerTimes: newAnswerTimes,
        streak: newStreak,
        longestStreak: newLongestStreak,
        score: newScore,
        fastestTimeMs: newFastestTimeMs,
        bestMon: newBestMon,
        lastActivityAt: FieldValue.serverTimestamp(),
      };

      if (isGameComplete) {
        updates.status = "completed";
        updates.completedAt = FieldValue.serverTimestamp();
      }

      transaction.update(sessionRef, updates);

      // Prepare result
      const answerResult = {
        correct: isCorrect,
        correctAnswer: currentMon,
        timeMs,
        newStreak,
        newTotalScore: newScore,
        isGameComplete,
      };

      if (!isGameComplete) {
        // Provide next Mon cry audio data
        const nextMon = session.monList[newIndex];
        const nextCryData = await getCryAudioData(
          nextMon,
          session.useLegacyCries
        );
        answerResult.nextMonCryData = nextCryData;
      } else {
        // Game complete - provide final stats
        answerResult.finalStats = {
          totalScore: newScore,
          longestStreak: newLongestStreak,
          fastestTimeMs: newFastestTimeMs,
          bestMon: newBestMon,
          correctCount: newCorrect.length,
          totalCount: session.monList.length,
        };
      }

      return answerResult;
    });

    // 4. If game is complete, check and update leaderboard
    if (result.isGameComplete && result.finalStats) {
      await updateLeaderboard(
        uid,
        sessionId,
        result.finalStats,
        sessionId // We'll fetch session data again for generation/mode
      );
    }

    return result;
  } catch (error) {
    if (error.code) {
      throw error;
    }
    console.error("Error checking answer:", error);
    throw new HttpsError(
      "internal",
      "An unexpected error occurred while checking the answer.",
      error.message
    );
  }
});

/**
 * Helper function to update leaderboard if this is a new high score
 * Replaces all previous runs for the same user/gen/mode with the new run if score is higher
 */
async function updateLeaderboard(userId, sessionId, finalStats, sessionDocId) {
  try {
    // Get session to determine generation and mode
    const sessionDoc = await db.collection("sessions").doc(sessionDocId).get();
    if (!sessionDoc.exists) return;

    const session = sessionDoc.data();
    const { generation, mode, username } = session;

    // Get all existing runs for this user/gen/mode
    const existingRunsQuery = await db
      .collection("runs")
      .where("userId", "==", userId)
      .where("gen", "==", generation)
      .where("mode", "==", mode)
      .get();

    // Check if new score beats the previous best
    let shouldUpdateLeaderboard = true;

    if (!existingRunsQuery.empty) {
      const bestScore = Math.max(
        ...existingRunsQuery.docs.map((doc) => doc.data().score)
      );
      if (bestScore >= finalStats.totalScore) {
        shouldUpdateLeaderboard = false;
      }
    }

    if (shouldUpdateLeaderboard) {
      // Delete all old runs for this user/gen/mode, then add the new one
      const batch = db.batch();

      existingRunsQuery.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Add new run to leaderboard
      const newRunRef = db.collection("runs").doc();
      batch.set(newRunRef, {
        userId,
        username: username || "Anonymous",
        gen: generation,
        mode,
        score: finalStats.totalScore,
        longestStreak: finalStats.longestStreak,
        fastestTimeMs: finalStats.fastestTimeMs,
        bestMon: finalStats.bestMon,
        correctCount: finalStats.correctCount,
        totalCount: finalStats.totalCount,
        sessionId,
        createdAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
    }
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    // Don't throw - leaderboard update failure shouldn't break the game
  }
}
