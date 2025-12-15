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

// Functions to export.
import { claimUsername, deleteUser } from "./auth.js";
import { startSession, checkAnswer } from "./session.js";

export { claimUsername, startSession, checkAnswer, deleteUser };
