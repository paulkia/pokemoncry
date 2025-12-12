# Cloud Functions Usage Guide

This document explains how to use the Guessthecry cloud functions from the React client.

## Overview

The game now uses server-side cloud functions to prevent exploits and ensure score integrity. All game logic, scoring, and leaderboard updates happen on the server.

## Functions

### 1. `startSession`

Creates a new game session and returns the first Pokemon cry.

**Parameters:**

```typescript
{
  generation: number | "all",  // 1-9 or "all"
  mode: "fast" | "full",       // "fast" = 20 pokemon, "full" = all pokemon
  useLegacyCries: boolean      // true for legacy cries, false for latest
}
```

**Returns:**

```typescript
{
  success: true,
  sessionId: string,              // Use this for all subsequent calls
  firstPokemonCryUrl: string,     // gs:// URL to first cry
  totalPokemonCount: number       // Total pokemon in this session
}
```

**Client Usage Example:**

```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const startSession = httpsCallable(functions, "startSession");

// Start a game
const result = await startSession({
  generation: 1, // Gen 1 only
  mode: "fast", // 20 pokemon
  useLegacyCries: false, // Use latest cries
});

const { sessionId, firstPokemonCryUrl, totalPokemonCount } = result.data;
```

### 2. `checkAnswer`

Submits an answer for the current Pokemon and receives the next cry or final stats.

**Parameters:**

```typescript
{
  sessionId: string,     // From startSession
  answer: string,        // Pokemon name (lowercase, trimmed)
  timeMs: number         // Time taken to answer in milliseconds
}
```

**Returns:**

```typescript
{
  correct: boolean,
  correctAnswer: string,
  timeMs: number,
  scoreIncrement: number,
  newStreak: number,
  newTotalScore: number,
  isGameComplete: boolean,

  // If game is NOT complete:
  nextPokemonCryUrl?: string,

  // If game IS complete:
  finalStats?: {
    totalScore: number,
    longestStreak: number,
    fastestTimeMs: number,
    bestMon: string,
    correctCount: number,
    totalCount: number
  }
}
```

**Client Usage Example:**

```javascript
const checkAnswer = httpsCallable(functions, "checkAnswer");

// Submit an answer
const result = await checkAnswer({
  sessionId: currentSessionId,
  answer: "pikachu",
  timeMs: Date.now() - startTime,
});

const {
  correct,
  correctAnswer,
  isGameComplete,
  nextPokemonCryUrl,
  finalStats,
} = result.data;

if (!isGameComplete) {
  // Load and play nextPokemonCryUrl
  playCry(nextPokemonCryUrl);
} else {
  // Show final stats
  console.log("Game complete!", finalStats);
}
```

## Migration from Client-Side Challenge.js

### What to Change in Challenge.js

1. **Remove local state for:**

   - Pokemon list generation
   - Score calculation
   - Streak tracking
   - Leaderboard submission

2. **Keep local state for:**

   - Current input
   - UI state (animations, displays)
   - Timer display (for UX only, server uses its own timing)

3. **New flow:**

```javascript
// At component mount
useEffect(() => {
  async function initSession() {
    const result = await startSession({
      generation:
        selectedGenerationIds.length === 9 ? "all" : selectedGenerationIds[0],
      mode: numberOfMons === 20 ? "fast" : "full",
      useLegacyCries: settings.preferLegacyCries,
    });

    setSessionId(result.data.sessionId);
    playCry(result.data.firstPokemonCryUrl);
    setTotalCount(result.data.totalPokemonCount);
  }

  initSession();
}, []);

// On answer submission
const handleSubmit = async (userAnswer) => {
  const timeMs = Date.now() - questionStartTime;

  const result = await checkAnswer({
    sessionId: currentSessionId,
    answer: userAnswer,
    timeMs,
  });

  // Update UI based on result
  if (result.data.correct) {
    triggerCorrectAnimation();
  } else {
    triggerIncorrectAnimation();
  }

  // Update score display
  setScore(result.data.newTotalScore);
  setStreak(result.data.newStreak);

  if (!result.data.isGameComplete) {
    // Load next Pokemon
    playCry(result.data.nextPokemonCryUrl);
    setQuestionStartTime(Date.now());
  } else {
    // Show final stats - leaderboard is already updated!
    showGameComplete(result.data.finalStats);
  }
};
```

## Firestore Collections

### `sessions`

Stores active and completed game sessions.

```typescript
{
  userId: string,
  username: string | null,
  generation: number | "all",
  mode: "fast" | "full",
  useLegacyCries: boolean,
  pokemonList: string[],        // Full list of pokemon in order
  currentIndex: number,         // Current position in pokemonList
  correct: string[],
  incorrect: string[],
  answerTimes: number[],
  streak: number,
  longestStreak: number,
  score: number,
  fastestTimeMs: number,
  bestMon: string,
  startedAt: Timestamp,
  lastActivityAt: Timestamp,
  completedAt?: Timestamp,
  status: "active" | "completed" | "abandoned"
}
```

### `runs`

Stores high scores for leaderboard display.

```typescript
{
  userId: string,
  username: string,
  gen: number | "all",          // 1-9 or "all"
  mode: "fast" | "full",
  score: number,
  longestStreak: number,
  fastestTimeMs: number,
  bestMon: string,
  correctCount: number,
  totalCount: number,
  sessionId: string,            // Reference to original session
  createdAt: Timestamp
}
```

**Note:** Only the BEST score per user per gen/mode is considered for leaderboard rankings. The `updateLeaderboard` function only adds a new run if it beats the user's previous best.

## Leaderboard Structure

There are **18 unique leaderboards**:

- 9 generations (1-9) × 2 modes (fast/full) = 18
- Plus "all generations" × 2 modes = 2 more
- **Total: 20 leaderboards** (matching the current Leaderboard.js implementation)

Wait, let me recount based on the code:

- Generations: 1, 2, 3, 4, 5, 6, 7, 8, 9, "all" = 10 options
- Modes: "fast", "full" = 2 options
- Total: 10 × 2 = **20 leaderboards** ✓

## Security Rules

Make sure your Firestore security rules allow:

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own sessions
    match /sessions/{sessionId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow write: if false; // Only cloud functions can write
    }

    // Anyone can read leaderboard runs
    match /runs/{runId} {
      allow read: if true;
      allow write: if false; // Only cloud functions can write
    }

    // Existing user rules...
  }
}
```

## Error Handling

All functions return standard Firebase HttpsError codes:

- `unauthenticated` - User not logged in
- `invalid-argument` - Bad input parameters
- `not-found` - Session doesn't exist
- `permission-denied` - Session belongs to different user
- `failed-precondition` - Session already completed
- `internal` - Server error (logged on backend)

**Example error handling:**

```javascript
try {
  const result = await checkAnswer({ sessionId, answer, timeMs });
  // Handle success
} catch (error) {
  switch (error.code) {
    case "unauthenticated":
      navigate("/login");
      break;
    case "not-found":
      console.error("Session not found, starting new session");
      startNewSession();
      break;
    case "permission-denied":
      console.error("This session belongs to another user");
      break;
    default:
      console.error("Error:", error.message);
  }
}
```

## Deployment

```bash
cd functions
npm run build
npm run deploy
```

Or deploy specific functions:

```bash
firebase deploy --only functions:startSession
firebase deploy --only functions:checkAnswer
```

## Testing

Use Firebase Emulators for local testing:

```bash
cd functions
npm run serve
```

Then update your client to point to the emulator:

```javascript
import { connectFunctionsEmulator } from "firebase/functions";

const functions = getFunctions();
if (process.env.NODE_ENV === "development") {
  connectFunctionsEmulator(functions, "localhost", 5001);
}
```
