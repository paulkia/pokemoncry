/**
 * Guessthecry Cloud Functions
 *
 * This file contains Firebase Cloud Functions for the Guessthecry Mon game.
 */

// Functions to export.
import { claimUsername, deleteUser } from "./auth.js";
import {
  deleteOldAnonymousUsers,
  deleteOldAnonymousRuns,
  deleteOldSessions,
  deleteZombieUserData,
} from "./cleanupFlumes.js";
import { createSession, updateSession, revealNextQuestion } from "./session.js";

export {
  claimUsername,
  createSession,
  updateSession,
  revealNextQuestion,
  deleteUser,
  deleteOldAnonymousUsers,
  deleteOldAnonymousRuns,
  deleteOldSessions,
  deleteZombieUserData,
};
