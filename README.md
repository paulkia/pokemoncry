# pokemoncry — Game Overview

**Repository:** [github.com/paulkia/pokemoncry](https://github.com/paulkia/pokemoncry)  
**Author:** paulkia

**Guess the Cry** is a Pokémon audio-guessing game played in the browser. The core mechanic is simple: a Pokémon cry plays, and the player must identify which Pokémon it belongs to. It's a web app inspired by the classic "Who's that Pokémon?" style challenge, but driven entirely by sound rather than a silhouette.

## Game Modes

- **Practice Mode** — The player hears a cry and selects the correct Pokémon from a set of answer options (images/names), or short answer if they are able.
- **Challenge Mode** — Short answer only. This mode is timed, and logged-in players automatically have their best scores saved in the global leaderboard.

## Key Features

- **User Accounts** — Firebase Authentication supports user registration and login. Anonymous sessions are also supported, with anonymous run data merged into a real account upon sign-up.
- **Leaderboards / Best Runs** — The app tracks best runs per user per game mode.
- **Scoring** — A point system rewards correct guesses, streaks of correct guesses, and answer speed.
- **Challenge Filtering** — Players can choose which Pokémon generations to include in their challenge.

## Architecture

### Frontend

- Built with **React**.
- Handles game UI, audio playback of Pokémon cries, answer selection, and displaying Pokémon sprites.
- Communicates with Firebase for auth, data storage, and cloud function calls.

### Backend / Database

- **Firebase Firestore** — Stores user data, session records, and best run scores. Firestore security rules are defined in `firestore.rules`.
- **Firebase Cloud Functions** — Server-side logic lives in the `/functions` directory. This handles things like validating game sessions and scoring.
- **Firebase Hosting** — The React app is deployed and served via Firebase Hosting (`firebase.json`, `.firebaserc`).
- **Firebase Storage** — used for hosting Pokémon cry audio files.

### Data / Assets

- A **Python script** compiles Pokémon cry audio data and metadata.
- Pokémon cry audio is played client-side.

## Running Locally

```bash
[terminal 1]
# Install dependencies
npm install

# Start cloud functions
firebase emulators:start

[terminal 2]
# Start the development server
npm start
# → App runs at http://localhost:3000
```
