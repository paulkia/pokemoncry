# Base64 Audio Delivery - Local Testing Guide

## Overview

The cloud functions now return audio data as **base64-encoded strings** instead of Firebase Storage URLs. This simplifies local testing with emulators and eliminates the need for Storage emulator configuration.

## Changes Made

### Backend (`functions/src/index.ts`)

1. **Removed URL generation**, added audio data fetching:

   ```typescript
   // Old: Returns gs:// URL
   function getCryUrl(pokemonName: string, useLegacy: boolean): string;

   // New: Returns base64 audio data
   async function getCryAudioData(
     pokemonName: string,
     useLegacy: boolean
   ): Promise<string>;
   ```

2. **`startSession` now returns**:

   ```typescript
   {
     success: true,
     sessionId: string,
     firstPokemonCryData: string,  // Base64 encoded .ogg file
     totalPokemonCount: number
   }
   ```

3. **`checkAnswer` now returns**:
   ```typescript
   {
     correct: boolean,
     correctAnswer: string,
     newStreak: number,
     newTotalScore: number,
     isGameComplete: boolean,
     nextPokemonCryData?: string,  // Base64 encoded .ogg file (if not complete)
     finalStats?: {...}             // Final stats (if complete)
   }
   ```

### Frontend (`src/pages/challenge/Challenge.js`)

1. **Removed Firebase Storage imports**:

   - No longer need `getStorage`, `ref`, `getDownloadURL`
   - No storage emulator configuration needed

2. **New function** `playCryFromBase64()`:

   ```javascript
   function playCryFromBase64(base64Data) {
     // Convert base64 -> Blob -> Object URL
     const byteCharacters = atob(base64Data);
     const byteArray = new Uint8Array(byteCharacters.length);
     for (let i = 0; i < byteCharacters.length; i++) {
       byteArray[i] = byteCharacters.charCodeAt(i);
     }
     const blob = new Blob([byteArray], { type: "audio/ogg" });
     const audioUrl = URL.createObjectURL(blob);

     playCryForPokemon(audioUrl, ...);
   }
   ```

3. **State changes**:
   - `currentCryUrl` → `currentCryData` (stores base64 string)

## Local Testing with Emulators

### 1. Start Firebase Emulators

```bash
cd functions
firebase emulators:start
```

This will start:

- ✅ Functions Emulator (port 5001)
- ✅ Firestore Emulator (port 8080)
- ✅ Auth Emulator (port 9099)
- ❌ Storage Emulator (NOT NEEDED!)

### 2. Configure Client for Emulators

Update `src/firebase.js`:

```javascript
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Connect to emulators when running locally
if (window.location.hostname === "localhost") {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
  // NO STORAGE EMULATOR NEEDED!
}

export { auth, db, functions };
```

### 3. Start React App

```bash
npm start
```

That's it! The app will now:

1. Call `startSession` → receive base64 audio
2. Convert base64 to blob → create object URL
3. Play audio directly
4. Call `checkAnswer` → receive next base64 audio
5. Repeat!

## Benefits

### ✅ Simpler Local Testing

- No need to run Storage emulator
- No need to upload cry files to emulated storage
- No need to configure storage rules for emulator

### ✅ Single Request

- Client makes 1 request instead of 2 (function call + storage download)
- Faster for small files like Pokemon cries (~10-50KB each)

### ✅ Works Anywhere

- No storage bucket configuration needed
- Functions work identically in emulator and production
- No CORS issues with storage downloads

### ✅ Easier Debugging

- Can inspect base64 data in network tab
- Can verify audio data in function response
- No separate storage request to debug

## Production Considerations

### File Size

Pokemon cry files are small (10-50KB), so base64 encoding overhead (~33%) is acceptable:

- Original: ~30KB
- Base64: ~40KB
- Still small enough for function response (10MB limit)

### Performance

- For 20 Pokemon in "fast" mode: ~20 requests × 40KB = ~800KB total
- For full mode: potentially more, but spread over time
- Cloud Functions have 10MB response limit, well above cry file sizes

### Cost

- Functions: Charged by invocation + GB-seconds
- Returning 40KB vs 1KB makes minimal difference in GB-seconds
- Storage bandwidth saved (no separate downloads)

### Caching

Base64 data isn't cached like Storage URLs, but:

- Each cry is only fetched once per game session
- Users typically don't replay the same Pokemon immediately
- For heavier caching needs, could add client-side cache (IndexedDB)

## Alternative Approaches

If you later need to optimize:

### Option 1: Signed URLs (current best for larger files)

```typescript
const bucket = storage.bucket();
const file = bucket.file(path);
const [url] = await file.getSignedUrl({
  action: "read",
  expires: Date.now() + 1000 * 60 * 60, // 1 hour
});
return url; // Client downloads from this URL
```

### Option 2: Hybrid Approach

- Use base64 for first cry (instant playback)
- Return URLs for subsequent cries (parallel downloads)

### Option 3: CDN/Public URLs

- Make cries publicly readable
- Return public URLs instead of signed URLs
- Browser can cache effectively

## Troubleshooting

### "Audio won't play"

- Check browser console for errors
- Verify base64 data isn't corrupted
- Test with: `console.log(base64Data.substring(0, 50))`

### "Function timeout"

- Cry files might be too large
- Check Firebase Storage has the files
- Verify file paths match: `cries/${pokemonName}-latest.ogg`

### "Invalid base64"

- Ensure `.toString('base64')` is used on buffer
- Check for special characters in response
- Verify MIME type is `audio/ogg`

## Testing Checklist

- [ ] Functions emulator running
- [ ] Client connects to emulator (check console logs)
- [ ] `startSession` returns base64 data
- [ ] First cry plays successfully
- [ ] `checkAnswer` returns next base64 data
- [ ] Subsequent cries play
- [ ] Game completes successfully
- [ ] Leaderboard updates
