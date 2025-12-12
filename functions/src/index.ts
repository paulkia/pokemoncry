/**
 * Guessthecry Cloud Functions
 *
 * This file contains Firebase Cloud Functions for the Guessthecry Mon game.
 *
 * GAME FLOW:
 * 1. Client calls `startSession` with generation (1-9 or 0), mode ("fast" or "full"),
 *    and useLegacyCries (boolean)
 * 2. Server creates a session, selects random mon, and returns the first cry URL
 * 3. For each mon, client submits answer via `checkAnswer` with sessionId, answer, and timeMs
 * 4. Server validates answer, calculates score, and returns next cry URL or final stats
 * 5. When game completes, server automatically updates leaderboard if it's a new high score
 *
 * LEADERBOARD STRUCTURE:
 * - 18 total leaderboards: (9 generations + 0) × 2 modes (fast/full)
 * - Each run is stored in "runs" collection with: userId, username, gen, mode, score, stats
 * - Only the best score per user per gen/mode combination is shown on leaderboard
 *
 * SCORING ALGORITHM (matches Challenge.js):
 * - Base score: 5 pts (<2s), 3 pts (<5s), 2 pts (<10s), 1 pt (else)
 * - Streak multiplier: min(streak, 10) / 5 + 1 (max 3x at 10 streak)
 * - Final score = base × streakMultiplier
 * - Tracks: longestStreak, fastestTimeMs, bestMon (fastest answered mon)
 */

// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
import { onCall, HttpsError } from "firebase-functions/https";

// The Firebase Admin SDK to access Firestore.
import { initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  Transaction,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const app = initializeApp();

// Get the Firestore instance using the modular function
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SessionData {
  userId: string;
  username: string | null;
  generation: number; // 1-9 or 0
  mode: "fast" | "full"; // fast = 20 mon, full = all mon from selected generation(s)
  useLegacyCries: boolean;
  monList: string[]; // ordered list of mon names to guess
  currentIndex: number; // which mon the user is currently on
  correct: string[]; // list of correctly guessed mon
  incorrect: string[]; // list of incorrectly guessed mon
  answerTimes: number[]; // time in ms for each answer
  streak: number; // current streak
  longestStreak: number;
  score: number; // running score
  fastestTimeMs: number;
  bestMon: string;
  startedAt: FirebaseFirestore.Timestamp;
  lastActivityAt: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
  status: "active" | "completed" | "abandoned";
}

interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  timeMs: number;
  newStreak: number;
  newTotalScore: number;
  isGameComplete: boolean;
  nextMonCryData?: string; // Base64 encoded audio
  finalStats?: {
    totalScore: number;
    longestStreak: number;
    fastestTimeMs: number;
    bestMon: string;
    correctCount: number;
    totalCount: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
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
function getMonList(generation: number, mode: "fast" | "full"): string[] {
  let allMon: Array<string> = [];

  if (generation === 0) {
    allMon = Object.values(genToMons).flat();
  } else {
    // Fetch specific generation
    allMon = genToMons[generation];
  }

  // Shuffle the list
  const shuffled = shuffle(allMon);

  console.log("shuffled = ", shuffled);

  // Return 20 or all based on mode
  if (mode === "fast") {
    return shuffled.slice(0, 20);
  }
  return shuffled;
}

/**
 * Calculates score increment based on answer time
 */
function calculateScoreIncrement(timeMs: number): number {
  const x = timeMs / 1000;
  return Math.exp(-0.5 * x + 2.5) + 1;
}

/**
 * Gets the Firebase Storage path for a Mon cry
 */
function getCryPath(monName: string, useLegacy: boolean): string {
  const cryType = useLegacy ? "legacy" : "latest";
  return `cries/${monName}-${cryType}.mp3`;
}

/**
 * Downloads a cry file from Firebase Storage and returns it as base64
 */
async function getCryAudioData(
  monName: string,
  useLegacy: boolean
): Promise<string> {
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
export const startSession = onCall(async (request: any) => {
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
    const sessionData: SessionData = {
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
      startedAt: FieldValue.serverTimestamp() as any,
      lastActivityAt: FieldValue.serverTimestamp() as any,
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
  } catch (error: any) {
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
 * If the game is complete, updates the leaderboard if it's a high score.
 *
 * @param data.sessionId - The session ID
 * @param data.answer - The user's guess (mon name)
 *
 * @returns AnswerResult with correctness, score updates, and next cry data (base64) or final stats
 */
export const checkAnswer = onCall(async (request: any) => {
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
    const result = await db.runTransaction(async (transaction: Transaction) => {
      const sessionDoc = await transaction.get(sessionRef);

      if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "Session not found.");
      }

      const session = sessionDoc.data() as SessionData;

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
      const updates: any = {
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
      const answerResult: AnswerResult = {
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
  } catch (error: any) {
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
async function updateLeaderboard(
  userId: string,
  sessionId: string,
  finalStats: any,
  sessionDocId: string
): Promise<void> {
  try {
    // Get session to determine generation and mode
    const sessionDoc = await db.collection("sessions").doc(sessionDocId).get();
    if (!sessionDoc.exists) return;

    const session = sessionDoc.data() as SessionData;
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
      console.log(
        `Replaced ${existingRunsQuery.size} old run(s) with new run for user ${userId}, gen ${generation}, mode ${mode}`
      );
    }
  } catch (error) {
    console.error("Error updating leaderboard:", error);
    // Don't throw - leaderboard update failure shouldn't break the game
  }
}

// ============================================================================
// EXISTING FUNCTION: claimUsername
// ============================================================================

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

    // 6. Update all existing leaderboard runs with the new username
    // This happens outside the transaction to avoid conflicts
    try {
      const runsQuery = await db
        .collection("runs")
        .where("userId", "==", uid)
        .get();

      if (!runsQuery.empty) {
        // Update all runs in a batch
        const batch = db.batch();
        runsQuery.docs.forEach((doc) => {
          batch.update(doc.ref, { username: newUsername });
        });
        await batch.commit();
        console.log(
          `Updated ${runsQuery.size} leaderboard run(s) for user ${uid} with new username: ${newUsername}`
        );
      }
    } catch (leaderboardError) {
      // Log error but don't fail the username claim
      console.error("Error updating leaderboard runs:", leaderboardError);
    }

    // 7. Return success
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

const genToMons: { [key: number]: string[] } = {
  1: [
    "bulbasaur",
    "charmander",
    "squirtle",
    "caterpie",
    "weedle",
    "pidgey",
    "rattata",
    "spearow",
    "ekans",
    "sandshrew",
    "nidoran-f",
    "nidoran-m",
    "vulpix",
    "zubat",
    "oddish",
    "paras",
    "venonat",
    "diglett",
    "meowth",
    "psyduck",
    "mankey",
    "growlithe",
    "poliwag",
    "abra",
    "machop",
    "bellsprout",
    "tentacool",
    "geodude",
    "venusaur",
    "charmeleon",
    "charizard",
    "wartortle",
    "blastoise",
    "metapod",
    "butterfree",
    "kakuna",
    "beedrill",
    "pidgeotto",
    "pidgeot",
    "raticate",
    "fearow",
    "arbok",
    "pikachu",
    "raichu",
    "sandslash",
    "nidorina",
    "nidoqueen",
    "nidorino",
    "nidoking",
    "clefairy",
    "clefable",
    "ninetales",
    "jigglypuff",
    "wigglytuff",
    "golbat",
    "gloom",
    "vileplume",
    "parasect",
    "venomoth",
    "dugtrio",
    "persian",
    "golduck",
    "primeape",
    "arcanine",
    "poliwhirl",
    "poliwrath",
    "kadabra",
    "alakazam",
    "machoke",
    "machamp",
    "weepinbell",
    "victreebel",
    "tentacruel",
    "graveler",
    "ponyta",
    "slowpoke",
    "magnemite",
    "farfetchd",
    "doduo",
    "seel",
    "grimer",
    "shellder",
    "gastly",
    "onix",
    "drowzee",
    "krabby",
    "voltorb",
    "exeggcute",
    "cubone",
    "lickitung",
    "koffing",
    "rhyhorn",
    "tangela",
    "kangaskhan",
    "horsea",
    "goldeen",
    "staryu",
    "scyther",
    "pinsir",
    "tauros",
    "magikarp",
    "lapras",
    "ditto",
    "eevee",
    "porygon",
    "omanyte",
    "kabuto",
    "aerodactyl",
    "articuno",
    "zapdos",
    "moltres",
    "dratini",
    "mewtwo",
    "rapidash",
    "slowbro",
    "magneton",
    "dodrio",
    "dewgong",
    "muk",
    "cloyster",
    "haunter",
    "gengar",
    "hypno",
    "kingler",
    "electrode",
    "exeggutor",
    "marowak",
    "hitmonlee",
    "hitmonchan",
    "weezing",
    "rhydon",
    "chansey",
    "seadra",
    "seaking",
    "starmie",
    "mr-mime",
    "jynx",
    "electabuzz",
    "magmar",
    "gyarados",
    "vaporeon",
    "jolteon",
    "flareon",
    "omastar",
    "kabutops",
    "snorlax",
    "dragonair",
    "dragonite",
    "mew",
    "ivysaur",
    "golem",
  ],
  2: [
    "chikorita",
    "cyndaquil",
    "totodile",
    "sentret",
    "hoothoot",
    "ledyba",
    "spinarak",
    "chinchou",
    "pichu",
    "cleffa",
    "igglybuff",
    "togepi",
    "natu",
    "mareep",
    "hoppip",
    "aipom",
    "sunkern",
    "yanma",
    "wooper",
    "murkrow",
    "misdreavus",
    "unown",
    "girafarig",
    "pineco",
    "dunsparce",
    "gligar",
    "snubbull",
    "qwilfish",
    "shuckle",
    "heracross",
    "sneasel",
    "teddiursa",
    "slugma",
    "swinub",
    "corsola",
    "remoraid",
    "delibird",
    "meganium",
    "quilava",
    "typhlosion",
    "croconaw",
    "feraligatr",
    "furret",
    "noctowl",
    "ledian",
    "ariados",
    "crobat",
    "lanturn",
    "togetic",
    "xatu",
    "flaaffy",
    "ampharos",
    "bellossom",
    "marill",
    "azumarill",
    "sudowoodo",
    "politoed",
    "skiploom",
    "jumpluff",
    "sunflora",
    "quagsire",
    "espeon",
    "umbreon",
    "slowking",
    "wobbuffet",
    "forretress",
    "steelix",
    "granbull",
    "scizor",
    "ursaring",
    "magcargo",
    "piloswine",
    "octillery",
    "skarmory",
    "houndour",
    "phanpy",
    "stantler",
    "smeargle",
    "tyrogue",
    "smoochum",
    "elekid",
    "magby",
    "miltank",
    "raikou",
    "entei",
    "suicune",
    "larvitar",
    "lugia",
    "ho-oh",
    "celebi",
    "houndoom",
    "kingdra",
    "donphan",
    "porygon",
    "hitmontop",
    "blissey",
    "pupitar",
    "tyranitar",
    "bayleef",
    "mantine",
  ],
  3: [
    "treecko",
    "torchic",
    "mudkip",
    "poochyena",
    "zigzagoon",
    "wurmple",
    "lotad",
    "seedot",
    "taillow",
    "wingull",
    "ralts",
    "surskit",
    "shroomish",
    "slakoth",
    "nincada",
    "whismur",
    "makuhita",
    "azurill",
    "nosepass",
    "skitty",
    "grovyle",
    "sceptile",
    "combusken",
    "blaziken",
    "marshtomp",
    "swampert",
    "mightyena",
    "linoone",
    "silcoon",
    "beautifly",
    "cascoon",
    "dustox",
    "lombre",
    "ludicolo",
    "nuzleaf",
    "shiftry",
    "swellow",
    "pelipper",
    "kirlia",
    "gardevoir",
    "masquerain",
    "breloom",
    "vigoroth",
    "slaking",
    "ninjask",
    "shedinja",
    "loudred",
    "exploud",
    "hariyama",
    "sableye",
    "mawile",
    "aron",
    "meditite",
    "electrike",
    "plusle",
    "minun",
    "volbeat",
    "illumise",
    "gulpin",
    "carvanha",
    "wailmer",
    "numel",
    "torkoal",
    "spoink",
    "spinda",
    "trapinch",
    "cacnea",
    "swablu",
    "zangoose",
    "seviper",
    "lunatone",
    "solrock",
    "barboach",
    "corphish",
    "baltoy",
    "lileep",
    "anorith",
    "feebas",
    "castform",
    "kecleon",
    "shuppet",
    "duskull",
    "tropius",
    "absol",
    "wynaut",
    "snorunt",
    "spheal",
    "clamperl",
    "relicanth",
    "luvdisc",
    "bagon",
    "beldum",
    "lairon",
    "aggron",
    "medicham",
    "manectric",
    "roselia",
    "swalot",
    "sharpedo",
    "wailord",
    "camerupt",
    "grumpig",
    "vibrava",
    "flygon",
    "cacturne",
    "altaria",
    "whiscash",
    "crawdaunt",
    "claydol",
    "cradily",
    "armaldo",
    "milotic",
    "banette",
    "dusclops",
    "chimecho",
    "glalie",
    "sealeo",
    "walrein",
    "huntail",
    "gorebyss",
    "shelgon",
    "salamence",
    "metang",
    "regirock",
    "regice",
    "registeel",
    "latias",
    "latios",
    "kyogre",
    "groudon",
    "rayquaza",
    "jirachi",
    "deoxys",
    "delcatty",
    "metagross",
  ],
  4: [
    "turtwig",
    "chimchar",
    "piplup",
    "starly",
    "bidoof",
    "kricketot",
    "shinx",
    "budew",
    "cranidos",
    "shieldon",
    "burmy",
    "combee",
    "pachirisu",
    "buizel",
    "cherubi",
    "shellos",
    "drifloon",
    "buneary",
    "glameow",
    "chingling",
    "stunky",
    "bronzor",
    "bonsly",
    "mime-jr",
    "happiny",
    "chatot",
    "spiritomb",
    "gible",
    "munchlax",
    "riolu",
    "hippopotas",
    "skorupi",
    "croagunk",
    "grotle",
    "torterra",
    "infernape",
    "prinplup",
    "empoleon",
    "staravia",
    "staraptor",
    "bibarel",
    "kricketune",
    "luxio",
    "luxray",
    "roserade",
    "rampardos",
    "bastiodon",
    "wormadam",
    "mothim",
    "vespiquen",
    "floatzel",
    "cherrim",
    "ambipom",
    "drifblim",
    "lopunny",
    "mismagius",
    "honchkrow",
    "purugly",
    "skuntank",
    "bronzong",
    "gabite",
    "garchomp",
    "lucario",
    "hippowdon",
    "drapion",
    "carnivine",
    "finneon",
    "mantyke",
    "snover",
    "rotom",
    "uxie",
    "mesprit",
    "azelf",
    "dialga",
    "palkia",
    "heatran",
    "regigigas",
    "giratina",
    "cresselia",
    "phione",
    "manaphy",
    "darkrai",
    "shaymin",
    "arceus",
    "lumineon",
    "abomasnow",
    "weavile",
    "magnezone",
    "lickilicky",
    "rhyperior",
    "tangrowth",
    "electivire",
    "magmortar",
    "togekiss",
    "yanmega",
    "leafeon",
    "glaceon",
    "gliscor",
    "porygon-z",
    "gallade",
    "probopass",
    "dusknoir",
    "froslass",
    "monferno",
    "gastrodon",
    "toxicroak",
    "mamoswine",
  ],
  5: [
    "victini",
    "snivy",
    "tepig",
    "oshawott",
    "patrat",
    "lillipup",
    "purrloin",
    "pansage",
    "pansear",
    "panpour",
    "munna",
    "pidove",
    "blitzle",
    "roggenrola",
    "woobat",
    "drilbur",
    "audino",
    "servine",
    "serperior",
    "pignite",
    "emboar",
    "dewott",
    "samurott",
    "watchog",
    "stoutland",
    "liepard",
    "simisage",
    "simisear",
    "simipour",
    "musharna",
    "tranquill",
    "unfezant",
    "zebstrika",
    "boldore",
    "gigalith",
    "swoobat",
    "excadrill",
    "timburr",
    "tympole",
    "throh",
    "sawk",
    "sewaddle",
    "venipede",
    "cottonee",
    "petilil",
    "basculin",
    "sandile",
    "darumaka",
    "maractus",
    "dwebble",
    "scraggy",
    "sigilyph",
    "yamask",
    "tirtouga",
    "archen",
    "trubbish",
    "zorua",
    "minccino",
    "gothita",
    "solosis",
    "ducklett",
    "vanillite",
    "deerling",
    "emolga",
    "karrablast",
    "foongus",
    "frillish",
    "alomomola",
    "joltik",
    "ferroseed",
    "klink",
    "tynamo",
    "elgyem",
    "litwick",
    "conkeldurr",
    "palpitoad",
    "seismitoad",
    "swadloon",
    "leavanny",
    "whirlipede",
    "scolipede",
    "whimsicott",
    "lilligant",
    "krokorok",
    "krookodile",
    "darmanitan",
    "crustle",
    "scrafty",
    "carracosta",
    "archeops",
    "garbodor",
    "zoroark",
    "cinccino",
    "gothorita",
    "gothitelle",
    "duosion",
    "reuniclus",
    "swanna",
    "vanillish",
    "vanilluxe",
    "sawsbuck",
    "escavalier",
    "amoonguss",
    "jellicent",
    "galvantula",
    "ferrothorn",
    "klang",
    "eelektrik",
    "eelektross",
    "beheeyem",
    "lampent",
    "axew",
    "cubchoo",
    "cryogonal",
    "shelmet",
    "stunfisk",
    "mienfoo",
    "druddigon",
    "golett",
    "pawniard",
    "bouffalant",
    "rufflet",
    "vullaby",
    "heatmor",
    "durant",
    "deino",
    "larvesta",
    "cobalion",
    "terrakion",
    "virizion",
    "tornadus",
    "thundurus",
    "reshiram",
    "zekrom",
    "landorus",
    "kyurem",
    "keldeo",
    "meloetta",
    "genesect",
    "fraxure",
    "haxorus",
    "beartic",
    "accelgor",
    "golurk",
    "bisharp",
    "braviary",
    "mandibuzz",
    "zweilous",
    "hydreigon",
    "volcarona",
    "herdier",
    "gurdurr",
    "cofagrigus",
    "klinklang",
    "chandelure",
    "mienshao",
  ],
  6: [
    "chespin",
    "fennekin",
    "froakie",
    "bunnelby",
    "fletchling",
    "scatterbug",
    "litleo",
    "flabebe",
    "skiddo",
    "pancham",
    "furfrou",
    "espurr",
    "honedge",
    "spritzee",
    "swirlix",
    "inkay",
    "quilladin",
    "chesnaught",
    "braixen",
    "delphox",
    "frogadier",
    "greninja",
    "diggersby",
    "fletchinder",
    "talonflame",
    "spewpa",
    "pyroar",
    "floette",
    "florges",
    "gogoat",
    "pangoro",
    "meowstic",
    "doublade",
    "aegislash",
    "aromatisse",
    "slurpuff",
    "binacle",
    "skrelp",
    "clauncher",
    "helioptile",
    "tyrunt",
    "amaura",
    "hawlucha",
    "dedenne",
    "carbink",
    "goomy",
    "klefki",
    "phantump",
    "pumpkaboo",
    "bergmite",
    "noibat",
    "xerneas",
    "yveltal",
    "zygarde",
    "diancie",
    "hoopa",
    "volcanion",
    "barbaracle",
    "dragalge",
    "clawitzer",
    "heliolisk",
    "aurorus",
    "sylveon",
    "sliggoo",
    "goodra",
    "trevenant",
    "gourgeist",
    "avalugg",
    "noivern",
    "vivillon",
    "malamar",
    "tyrantrum",
  ],
  7: [
    "rowlet",
    "litten",
    "popplio",
    "pikipek",
    "yungoos",
    "grubbin",
    "crabrawler",
    "oricorio",
    "cutiefly",
    "rockruff",
    "wishiwashi",
    "mareanie",
    "mudbray",
    "dewpider",
    "fomantis",
    "morelull",
    "salandit",
    "stufful",
    "bounsweet",
    "comfey",
    "dartrix",
    "decidueye",
    "torracat",
    "incineroar",
    "primarina",
    "trumbeak",
    "toucannon",
    "gumshoos",
    "charjabug",
    "vikavolt",
    "crabominable",
    "ribombee",
    "lycanroc",
    "toxapex",
    "mudsdale",
    "araquanid",
    "lurantis",
    "shiinotic",
    "salazzle",
    "bewear",
    "steenee",
    "oranguru",
    "passimian",
    "wimpod",
    "sandygast",
    "pyukumuku",
    "type-null",
    "minior",
    "komala",
    "turtonator",
    "togedemaru",
    "mimikyu",
    "bruxish",
    "drampa",
    "dhelmise",
    "jangmo-o",
    "tapu-koko",
    "tapu-lele",
    "tapu-bulu",
    "tapu-fini",
    "cosmog",
    "nihilego",
    "buzzwole",
    "pheromosa",
    "xurkitree",
    "celesteela",
    "kartana",
    "guzzlord",
    "necrozma",
    "magearna",
    "marshadow",
    "poipole",
    "stakataka",
    "blacephalon",
    "zeraora",
    "meltan",
    "silvally",
    "hakamo-o",
    "kommo-o",
    "cosmoem",
    "solgaleo",
    "lunala",
    "naganadel",
    "melmetal",
    "brionne",
    "tsareena",
    "golisopod",
    "palossand",
  ],
  8: [
    "grookey",
    "scorbunny",
    "sobble",
    "skwovet",
    "rookidee",
    "blipbug",
    "nickit",
    "gossifleur",
    "wooloo",
    "chewtle",
    "yamper",
    "rolycoly",
    "applin",
    "thwackey",
    "rillaboom",
    "raboot",
    "cinderace",
    "drizzile",
    "inteleon",
    "greedent",
    "corvisquire",
    "corviknight",
    "dottler",
    "thievul",
    "eldegoss",
    "dubwool",
    "drednaw",
    "boltund",
    "carkol",
    "coalossal",
    "flapple",
    "silicobra",
    "cramorant",
    "arrokuda",
    "toxel",
    "sizzlipede",
    "clobbopus",
    "sinistea",
    "hatenna",
    "impidimp",
    "milcery",
    "falinks",
    "pincurchin",
    "snom",
    "stonjourner",
    "eiscue",
    "indeedee",
    "morpeko",
    "cufant",
    "dracozolt",
    "arctozolt",
    "dracovish",
    "arctovish",
    "duraludon",
    "dreepy",
    "zacian",
    "zamazenta",
    "eternatus",
    "kubfu",
    "zarude",
    "regieleki",
    "regidrago",
    "glastrier",
    "spectrier",
    "calyrex",
    "enamorus",
    "sandaconda",
    "barraskewda",
    "toxtricity",
    "centiskorch",
    "grapploct",
    "polteageist",
    "hattrem",
    "hatterene",
    "morgrem",
    "obstagoon",
    "perrserker",
    "cursola",
    "sirfetchd",
    "mr-rime",
    "runerigus",
    "alcremie",
    "frosmoth",
    "copperajah",
    "drakloak",
    "dragapult",
    "urshifu",
    "wyrdeer",
    "kleavor",
    "basculegion",
    "sneasler",
    "overqwil",
    "orbeetle",
    "appletun",
    "grimmsnarl",
    "ursaluna",
  ],
  9: [
    "nymble",
    "sprigatito",
    "fuecoco",
    "quaxly",
    "lechonk",
    "tarountula",
    "floragato",
    "meowscarada",
    "crocalor",
    "skeledirge",
    "quaxwell",
    "quaquaval",
    "oinkologne",
    "spidops",
    "pawmi",
    "tandemaus",
    "fidough",
    "smoliv",
    "squawkabilly",
    "nacli",
    "charcadet",
    "tadbulb",
    "wattrel",
    "maschiff",
    "shroodle",
    "bramblin",
    "toedscool",
    "klawf",
    "capsakid",
    "rellor",
    "flittle",
    "tinkatink",
    "wiglett",
    "bombirdier",
    "finizen",
    "varoom",
    "cyclizar",
    "orthworm",
    "glimmet",
    "greavard",
    "flamigo",
    "cetoddle",
    "veluza",
    "dondozo",
    "tatsugiri",
    "great-tusk",
    "scream-tail",
    "brute-bonnet",
    "flutter-mane",
    "slither-wing",
    "sandy-shocks",
    "iron-treads",
    "iron-bundle",
    "iron-hands",
    "iron-jugulis",
    "iron-moth",
    "iron-thorns",
    "frigibax",
    "pawmo",
    "pawmot",
    "maushold",
    "dachsbun",
    "dolliv",
    "naclstack",
    "garganacl",
    "armarouge",
    "ceruledge",
    "bellibolt",
    "kilowattrel",
    "mabosstiff",
    "grafaiai",
    "brambleghast",
    "toedscruel",
    "scovillain",
    "rabsca",
    "espathra",
    "tinkatuff",
    "tinkaton",
    "wugtrio",
    "palafin",
    "glimmora",
    "houndstone",
    "cetitan",
    "annihilape",
    "clodsire",
    "farigiraf",
    "dudunsparce",
    "kingambit",
    "gimmighoul",
    "wo-chien",
    "chien-pao",
    "ting-lu",
    "chi-yu",
    "roaring-moon",
    "iron-valiant",
    "koraidon",
    "miraidon",
    "walking-wake",
    "iron-leaves",
    "poltchageist",
    "okidogi",
    "munkidori",
    "fezandipiti",
    "ogerpon",
    "gouging-fire",
    "raging-bolt",
    "iron-boulder",
    "iron-crown",
    "terapagos",
    "pecharunt",
    "lokix",
    "arboliva",
    "revavroom",
    "arctibax",
    "baxcalibur",
    "gholdengo",
    "dipplin",
    "sinistcha",
    "archaludon",
    "hydrapple",
  ],
};
