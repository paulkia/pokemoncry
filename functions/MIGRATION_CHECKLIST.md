# Client Migration Checklist

This checklist will help you migrate Challenge.js to use the new cloud functions.

## Prerequisites

- [ ] Deploy cloud functions: `cd functions && npm run deploy`
- [ ] Update Firestore security rules (see CLOUD_FUNCTIONS_USAGE.md)
- [ ] Test functions in Firebase Emulator first

## Challenge.js Migration Steps

### 1. Setup Firebase Functions Client

```javascript
// At top of Challenge.js
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const startSession = httpsCallable(functions, "startSession");
const checkAnswer = httpsCallable(functions, "checkAnswer");
```

### 2. Remove Old State & Logic

Remove these from Challenge.js:

- [ ] `pokemonInGameOrder` state generation
- [ ] `shuffle()` function usage
- [ ] Local scoring calculation in `ADD_CORRECT` action
- [ ] Streak multiplier calculation
- [ ] `fastestTimeMs` and `bestMon` tracking
- [ ] Any leaderboard submission code

### 3. Add New State

Add these state variables:

```javascript
const [sessionId, setSessionId] = useState(null);
const [totalPokemonCount, setTotalPokemonCount] = useState(0);
const [currentPokemonIndex, setCurrentPokemonIndex] = useState(0);
const [currentCryUrl, setCurrentCryUrl] = useState(null);
```

### 4. Update useEffect for Session Start

Replace the existing pokemon selection logic:

```javascript
useEffect(() => {
  async function initSession() {
    try {
      // Convert selectedGenerationIds to appropriate format
      let generation;
      if (selectedGenerationIds.length === 9) {
        generation = "all";
      } else if (selectedGenerationIds.length === 1) {
        generation = selectedGenerationIds[0];
      } else {
        // Multiple specific gens - treat as 'all' for now
        generation = "all";
      }

      const result = await startSession({
        generation,
        mode: numberOfMons === 20 ? "fast" : "full",
        useLegacyCries: settings.preferLegacyCries,
      });

      setSessionId(result.data.sessionId);
      setTotalPokemonCount(result.data.totalPokemonCount);
      setCurrentCryUrl(result.data.firstPokemonCryUrl);

      // Convert gs:// URL to https:// and play
      await playCryFromStorageUrl(result.data.firstPokemonCryUrl);

      // Start timer
      questionStartTimeRef.current = Date.now();
    } catch (error) {
      console.error("Failed to start session:", error);
      // Handle error appropriately
    }
  }

  initSession();
}, []);
```

### 5. Add Firebase Storage Helper

```javascript
import { getStorage, ref, getDownloadURL } from "firebase/storage";

async function playCryFromStorageUrl(gsUrl) {
  try {
    const storage = getStorage();
    // Remove gs://guessthecry.firebasestorage.app/ prefix
    const path = gsUrl.replace("gs://guessthecry.firebasestorage.app/", "");
    const storageRef = ref(storage, path);
    const downloadUrl = await getDownloadURL(storageRef);

    // Use existing audio playback logic
    audioRef.current.src = downloadUrl;
    audioRef.current.play();

    // Update visualization if needed
    if (vizInitializedRef.current) {
      // ... visualization code
    }
  } catch (error) {
    console.error("Error loading cry:", error);
  }
}
```

### 6. Update Answer Submission

Replace the `handleKey` Enter case:

```javascript
case "Enter": {
  e.preventDefault();

  if (!sessionId || !state.pokeTrie.words.has(input)) {
    return;
  }

  // Disable input
  dispatch({ type: ACTION_TYPES.DISABLE_INPUT });

  try {
    const timeMs = Date.now() - questionStartTimeRef.current;

    const result = await checkAnswer({
      sessionId,
      answer: input,
      timeMs
    });

    const {
      correct: isCorrect,
      correctAnswer,
      scoreIncrement,
      newStreak,
      newTotalScore,
      isGameComplete,
      nextPokemonCryUrl,
      finalStats
    } = result.data;

    // Update UI state
    if (isCorrect) {
      dispatch({
        type: ACTION_TYPES.ADD_CORRECT,
        pokemon: correctAnswer,
        score: scoreIncrement
      });
      triggerCorrectAnimation();
    } else {
      dispatch({
        type: ACTION_TYPES.ADD_INCORRECT,
        pokemon: correctAnswer
      });
      triggerIncorrectAnimation();
    }

    // Update score display
    setScore(newTotalScore);
    setStreak(newStreak);
    setCurrentPokemonIndex(prev => prev + 1);

    if (!isGameComplete) {
      // Play next Pokemon after delay
      setTimeout(async () => {
        await playCryFromStorageUrl(nextPokemonCryUrl);
        questionStartTimeRef.current = Date.now();
        dispatch({ type: ACTION_TYPES.ENABLE_INPUT });
      }, PAUSE_TIME);
    } else {
      // Game complete - show final stats
      dispatch({ type: ACTION_TYPES.END_GAME });
      setFinalStats(finalStats);
      // Leaderboard already updated by server!
    }

  } catch (error) {
    console.error('Error submitting answer:', error);
    // Re-enable input on error
    dispatch({ type: ACTION_TYPES.ENABLE_INPUT });
  }

  return;
}
```

### 7. Update Reducer

Simplify the reducer - remove scoring logic:

```javascript
case ACTION_TYPES.ADD_CORRECT:
  // Just track the pokemon, server handles score
  return {
    ...state,
    correct: [...state.correct, action.pokemon],
    input: ''
  };

case ACTION_TYPES.ADD_INCORRECT:
  return {
    ...state,
    incorrect: [...state.incorrect, action.pokemon],
    input: ''
  };
```

### 8. Update Progress Bar

```javascript
const progress = (currentPokemonIndex / totalPokemonCount) * 100;
```

### 9. Update Score Display

```javascript
// Use state from server instead of local calculation
<Score
  numPokemonToGuess={totalPokemonCount}
  pokeNum={currentPokemonIndex}
  numerator={score} // From server
  score={score} // From server
/>
```

### 10. Update Final Stats Display

Use `finalStats` from server response:

```javascript
{
  isGameComplete && finalStats && (
    <div>
      <h2>Game Complete!</h2>
      <p>Total Score: {finalStats.totalScore}</p>
      <p>Longest Streak: {finalStats.longestStreak}</p>
      <p>Fastest Time: {(finalStats.fastestTimeMs / 1000).toFixed(2)}s</p>
      <p>Best Pokemon: {finalStats.bestMon}</p>
      <p>
        Accuracy: {finalStats.correctCount}/{finalStats.totalCount}
      </p>
    </div>
  );
}
```

### 11. Remove Leaderboard Submission

- [ ] Delete any code that submits scores to Firestore
- [ ] Server now handles this automatically in `checkAnswer`
- [ ] Keep the "View Leaderboard" button

### 12. Update ChallengePanel.js

Ensure it passes the correct props to navigate:

```javascript
navigate(ROUTER_UTIL.CHALLENGE, {
  state: {
    numberOfMons, // 20 or 0
    selectedGenerationIds, // array of gen numbers
  },
});
```

## Testing Checklist

- [ ] Can start a session successfully
- [ ] First Pokemon cry plays
- [ ] Correct answers increase score properly
- [ ] Incorrect answers reset streak
- [ ] Game completes after all Pokemon
- [ ] Final stats display correctly
- [ ] Leaderboard shows new high score
- [ ] Can play again
- [ ] Error handling works (network issues, invalid session, etc.)
- [ ] Works with different generations (1-9, all)
- [ ] Works with both modes (fast, full)
- [ ] Legacy vs latest cries setting works

## Common Issues & Solutions

### Issue: "Session not found" error

**Solution**: Session might have expired or been deleted. Start a new session.

### Issue: Cries not playing

**Solution**: Check Firebase Storage rules allow read access. Verify gs:// URL conversion.

### Issue: Score doesn't match expected

**Solution**: Server uses its own timing. Client timeMs is for reference only.

### Issue: Autocomplete not working

**Solution**: Pokemon list is now server-side. Either:

1. Fetch all pokemon names separately for autocomplete
2. Disable autocomplete in Challenge mode
3. Request available pokemon list from a new cloud function

### Issue: Multiple generations not working

**Solution**: Currently only supports single gen or "all". Either:

1. Show error if multiple specific gens selected
2. Treat multiple as "all"
3. Modify cloud function to accept generation arrays

## Optional Enhancements

After basic migration works, consider:

- [ ] Add loading states during cloud function calls
- [ ] Add retry logic for failed calls
- [ ] Cache pokemon names for autocomplete
- [ ] Add pause/resume functionality using sessionId
- [ ] Show session statistics (calls made, latency, etc.)
- [ ] Add session recovery if app closes unexpectedly

## Rollback Plan

If issues arise, you can temporarily:

1. Keep old Challenge.js as ChallengeClassic.js
2. Deploy new version as ChallengeBeta.js
3. Let users choose which version to play
4. Gradually migrate once stable

## Final Verification

Before releasing to production:

- [ ] Test all 20 leaderboard combinations work
- [ ] Verify scores can't be manipulated client-side
- [ ] Check Firestore costs (functions, reads/writes)
- [ ] Ensure error messages are user-friendly
- [ ] Verify mobile performance (function latency)
- [ ] Test with slow network connections
- [ ] Confirm cleanup of old sessions (if implemented)

---

Good luck with the migration! 🚀
