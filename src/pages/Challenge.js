import "../App.css";
import Settings from "../components/Settings";
import "bootstrap/dist/css/bootstrap.min.css";
import React, {
  useState,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useLocation } from "react-router-dom";
import Pokedex from "pokedex-promise-v2";
import {
  FormControl,
  OverlayTrigger,
  Tooltip,
  ProgressBar,
  InputGroup,
} from "react-bootstrap";
import { Trie } from "../library/trie";
import { shuffle, GameModes } from "../library/util";
import { playAudioWithViz, stopAudioViz } from "../library/AudioViz";
// NEW: import feedback sounds
import correctSound from "../audio/correct.mp3";
import incorrectSound from "../audio/incorrect.mp3";

export const ACTION_TYPES = {
  INITIAL_SETUP: "INITIAL_SETUP",
  UPDATE_INPUT: "UPDATE_INPUT",
  NEXT_POKEMON: "NEXT_POKEMON",
  ADD_CORRECT: "ADD_CORRECT",
  ADD_INCORRECT: "ADD_INCORRECT",
  DISABLE_INPUT: "DISABLE_INPUT",
  ENABLE_INPUT: "ENABLE_INPUT",
  END_GAME: "END_GAME",
};

const PAUSE_TIME = 1000; // ms

const initialState = {
  // User input.
  input: "",
  // Whether input should be disabled. True when loading, or after game completion.
  inputDisabled: true,
  // All relevant pokemon data. Maps from pokemon name to cries, sprites, etc.
  relevantPokemon: {},
  // List of pokemon the user will guess.
  pokemonInGameOrder: [],
  // Index of pokemon the user is currently guessing.
  pokeNum: 1,
  // Set of relevant pokemon names. Time complexity optimization.
  pokeTrie: new Trie(),
  // List of correctly guessed pokemon.
  correct: [],
  // List of incorrectly guessed pokemon.
  incorrect: [],
};

function quizReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.INITIAL_SETUP: {
      // Create a new Trie to avoid mutating previous state
      const newTrie = new Trie();
      if (Array.isArray(action.allPokemonNames)) {
        newTrie.insert(action.allPokemonNames);
      }
      return {
        ...state,
        inputDisabled: false,
        relevantPokemon: action.relevantPokemon,
        pokemonInGameOrder: action.pokemonInGameOrder,
        pokeTrie: newTrie,
        pokeNum: 1,
      };
    }
    case ACTION_TYPES.UPDATE_INPUT:
      return { ...state, input: action.input };
    case ACTION_TYPES.NEXT_POKEMON:
      return {
        ...state,
        inputDisabled: true,
        pokeNum: state.pokeNum + 1,
        input: "",
      };
    case ACTION_TYPES.ADD_CORRECT:
      return { ...state, correct: [...state.correct, action.pokemon] };
    case ACTION_TYPES.ADD_INCORRECT:
      return { ...state, incorrect: [...state.incorrect, action.pokemon] };
    case ACTION_TYPES.DISABLE_INPUT:
      return { ...state, inputDisabled: true };
    case ACTION_TYPES.ENABLE_INPUT:
      return { ...state, inputDisabled: false };
    case ACTION_TYPES.END_GAME:
      return {
        ...state,
        inputDisabled: true,
        pokeNum: state.pokeNum + 1,
        input: "",
      };
    default:
      return state;
  }
}

function chooseCry(pokemonData, useLatest) {
  if (!pokemonData) return null;
  if (!useLatest && pokemonData.legacyCry) return pokemonData.legacyCry;
  return pokemonData.latestCry || pokemonData.legacyCry || null;
}

function Challenge() {
  const location = useLocation();
  const {
    selectedGenerationIds,
    generationCount,
    homeSettings,
    relevantPokemon, // Data of only the relevant Pokemon
    allNames,
  } = location.state || {};
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [settings, setSettings] = useState(homeSettings || {});
  // Clock state: mm:ss:hh (hundredths). Start at 00:00:00 until game begins.
  const [clock, setClock] = useState("00:00:00");
  // Ref to store timer start (ms since epoch). Set when initial setup completes.
  const startRef = useRef(null);
  // Ref to the input DOM node so we can trigger a shake animation on wrong guesses.
  const inputRef = useRef(null);
  const lastPlayRef = useRef(0); // timestamp of last played cry
  const canvasRef = useRef(null);

  // Reusable Audio refs for correct/incorrect feedback
  const correctAudioRef = useRef(
    typeof Audio !== "undefined" ? new Audio(correctSound) : null
  );
  const incorrectAudioRef = useRef(
    typeof Audio !== "undefined" ? new Audio(incorrectSound) : null
  );

  // Use audioViz module to play + visualize. Wrapper ensures canvasRef is passed.
  const playAudioViz = useCallback((url) => {
    playAudioWithViz(url, canvasRef.current);
  }, []);

  // Inject shake CSS once
  useEffect(() => {
    const styleId = "quiz-shake-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @keyframes shake {
        0% { transform: translateX(0); }
        15% { transform: translateX(-8px); }
        30% { transform: translateX(8px); }
        45% { transform: translateX(-6px); }
        60% { transform: translateX(6px); }
        75% { transform: translateX(-3px); }
        100% { transform: translateX(0); }
      }
      .shake {
        animation: shake 600ms ease;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Build pokemon data and initialize the game.
  useEffect(() => {
    // Prefer preloaded data supplied via location.state
    const preloaded = location.state?.preloadedPokemon;
    const preloadedOrder = Object.keys(relevantPokemon || {});

    // Play first cry if available (with visualization)
    if (preloadedOrder.length > 0) {
      const firstPokemon = preloadedOrder[0];
      const cryUrl = chooseCry(
        relevantPokemon[firstPokemon],
        settings?.useLatestCries ?? false
      );
      if (cryUrl) playAudioViz(cryUrl, canvasRef.current);
    }
    dispatch({
      type: ACTION_TYPES.INITIAL_SETUP,
      relevantPokemon: relevantPokemon,
      allPokemonNames: allNames,
      pokemonInGameOrder: preloadedOrder,
      pokeNum: 1,
    });
    // Start the elapsed timer when the game is initialized.
    startRef.current = Date.now();
  }, [
    selectedGenerationIds,
    generationCount,
    location.state,
    settings,
    playAudioViz,
  ]);

  const getSuggestionRemainder = () => {
    let trieResult = state.pokeTrie.getWord(state.input);
    if (trieResult.length > state.input.length) {
      return trieResult.substring(state.input.length);
    }
    return "";
  };

  const playCryForPokemon = useCallback(
    (pokemonName) => {
      if (!pokemonName) return;
      const now = Date.now();
      // If an audio was played within the last pause time, do not replay.
      // If cry sound is triggered (with '1') before next pokemon timeout, disables unnecessary replay.
      if (now - lastPlayRef.current < PAUSE_TIME) return;
      lastPlayRef.current = now;

      const cryUrl = chooseCry(
        /*pokemonData=*/ state.relevantPokemon[pokemonName],
        /*useLatest=*/ settings?.useLatestCries ?? false
      );
      playAudioViz(cryUrl);
    },
    [state.relevantPokemon, settings]
  );

  // Unified handler for both window-level key events and input onKeyDown.
  const handleKey = useCallback(
    (e) => {
      if (state.inputDisabled) return;
      const currPokemon = state.pokemonInGameOrder[state.pokeNum - 1];
      if (!currPokemon) return;
      const suggestion = getSuggestionRemainder();
      const input = `${state.input}${suggestion}`;
      switch (e.key) {
        // Replay sound on '1'
        case "1":
          playCryForPokemon(currPokemon);
          return;
        case "Tab": {
          e.preventDefault();
          dispatch({ type: ACTION_TYPES.UPDATE_INPUT, input });
          return;
        }
        case "Enter": {
          e.preventDefault();
          if (!state.pokeTrie.words.has(input)) {
            return;
          }
          if (input === currPokemon) {
            dispatch({ type: ACTION_TYPES.ADD_CORRECT, pokemon: currPokemon });
            // Play correct feedback sound
            if (correctAudioRef.current) {
              try {
                correctAudioRef.current.currentTime = 0;
                void correctAudioRef.current.play();
              } catch (err) {
                /* ignore playback errors */
              }
            }
          } else {
            dispatch({
              type: ACTION_TYPES.ADD_INCORRECT,
              pokemon: currPokemon,
            });
            // Play incorrect feedback sound
            if (incorrectAudioRef.current) {
              try {
                incorrectAudioRef.current.currentTime = 0;
                void incorrectAudioRef.current.play();
              } catch (err) {
                /* ignore playback errors */
              }
            }
            // Trigger shake animation on the input when incorrect
            if (inputRef.current) {
              // restart animation
              inputRef.current.classList.remove("shake");
              // force reflow to ensure restart
              // eslint-disable-next-line no-unused-expressions
              inputRef.current.offsetWidth;
              inputRef.current.classList.add("shake");
              // cleanup after animation (safety)
              setTimeout(
                () =>
                  inputRef.current &&
                  inputRef.current.classList.remove("shake"),
                700
              );
            }
          }
          if (state.pokemonInGameOrder.length > state.pokeNum) {
            dispatch({ type: ACTION_TYPES.NEXT_POKEMON });
            // Allow users to see the result before hearing the next pokemon.
            setTimeout(() => {
              const nextPokemon = state.pokemonInGameOrder[state.pokeNum];
              playCryForPokemon(nextPokemon);
              dispatch({ type: ACTION_TYPES.ENABLE_INPUT });
            }, PAUSE_TIME);
          } else {
            dispatch({ type: ACTION_TYPES.END_GAME });
          }
        }
        default:
          break;
      }
    },
    [state, settings]
  );

  // Listen to key input
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Clean up audio visualization on unmount.
  useEffect(() => {
    return () => {
      stopAudioViz();
      // Pause any feedback sounds on unmount
      if (correctAudioRef.current) {
        try {
          correctAudioRef.current.pause();
        } catch (e) {}
      }
      if (incorrectAudioRef.current) {
        try {
          incorrectAudioRef.current.pause();
        } catch (e) {}
      }
    };
  }, []);

  // Start a high-resolution timer when the game begins.
  useEffect(() => {
    let timerId = null;

    // Start the interval only if the game has started (startRef set) and input is enabled.
    if (startRef.current && !state.inputDisabled) {
      const pad2 = (n) => n.toString().padStart(2, "0");

      const updateClock = () => {
        const elapsed = Date.now() - startRef.current;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const hundredths = Math.floor((elapsed % 1000) / 10);
        const timeStr =
          (hours > 0 ? `${pad2(hours)}:` : "") +
          `${pad2(minutes)}:${pad2(seconds)}:${pad2(hundredths)}`;
        setClock(timeStr);
      };

      // Immediately update once then start frequent updates for hundredths precision.
      updateClock();
      timerId = setInterval(updateClock, 10); // 10ms gives hundredths resolution in display
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [state.inputDisabled]);

  inputRef.current && inputRef.current.focus();

  const progress =
    (state.pokeNum / Math.max(1, state.pokemonInGameOrder.length)) * 100;

  const label =
    (state.pokeNum - 1) / Math.max(1, state.pokemonInGameOrder.length) < 0.15
      ? `${Math.round(
          (state.pokeNum / Math.max(1, state.pokemonInGameOrder.length)) * 100
        )}%`
      : state.pokeNum > Math.max(1, state.pokemonInGameOrder.length)
      ? `Done!`
      : `${state.pokeNum - 1}/${state.pokemonInGameOrder.length}`;

  return (
    <div className="App p-5">
      <h1>Who's that Pokemon?</h1>
      <br />
      <p>Repeat the sound by pressing '1'.</p>
      <div
        style={{
          textAlign: "center",
          fontFamily: "monospace",
          fontSize: "1rem",
        }}
      >
        Score: {clock}
      </div>
      {/* Waveform canvas */}
      <div style={{ width: "50%", margin: "8px auto" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "50%", height: "64px", background: "transparent" }}
        />
      </div>
      {/* Container for relative positioning */}
      <div style={{ position: "relative", width: "25%", margin: "0 auto" }}>
        {/* Top-right icon */}
        <Settings settings={settings} setSettings={setSettings} />
        <ProgressBar animated now={progress} label={label} />
        <br />
        <InputGroup>
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                <div className="App">Use dashes. E.g. nidoran-f</div>
              </Tooltip>
            }
          >
            <InputGroup.Text id="basic-addon1">?</InputGroup.Text>
          </OverlayTrigger>
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "49px",
              transform: "translateY(-50%)",
              color: "gray",
              pointerEvents: "none",
              zIndex: 0,
              fontFamily: "inherit",
              fontSize: "1rem",
            }}
          >
            {getSuggestionRemainder().length === 0 ? "" : state.input}
            <span style={{ opacity: 0.5 }}>{getSuggestionRemainder()}</span>
          </span>
          {/* The actual input, with a transparent background */}
          <FormControl
            ref={inputRef}
            type="text"
            disabled={state.inputDisabled}
            value={state.input}
            style={{
              backgroundColor: "transparent",
              position: "relative",
              zIndex: 1,
            }}
            onChange={(e) =>
              dispatch({
                type: ACTION_TYPES.UPDATE_INPUT,
                input: e.target.value
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z-]/g, ""),
              })
            }
          />
        </InputGroup>
      </div>
      <br />
      <p>
        {state.correct.length > 0 ? "[Correct]" : ""}
        {state.correct.map((name) => {
          const s = state.relevantPokemon[name]?.sprite;
          return typeof s === "string" ? (
            <img
              key={name}
              src={s}
              alt={`${name} sprite`}
              style={{ width: "50px", height: "50px", objectFit: "contain" }}
            />
          ) : (
            s
          );
        })}
      </p>

      <p>
        {state.incorrect.length > 0 ? "[Incorrect]" : ""}
        {state.incorrect.map((name) => {
          const s = state.relevantPokemon[name]?.sprite;
          return typeof s === "string" ? (
            <img
              key={name}
              src={s}
              alt={`${name} sprite`}
              style={{ width: "50px", height: "50px", objectFit: "contain" }}
            />
          ) : (
            s
          );
        })}
      </p>
      {/* Have an invisible set of rendered images at the end. This pre-loads the gifs. */}
    </div>
  );
}

export default Challenge;
