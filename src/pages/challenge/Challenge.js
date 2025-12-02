import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useLocation, useNavigate } from "react-router-dom";
import {
  OverlayTrigger,
  Tooltip,
  Button,
  InputGroup,
  Row,
  Col,
  FormControl,
} from "react-bootstrap";
import { useState, useReducer, useEffect, useCallback, useRef } from "react";
import {
  CORRECT_AUDIO_SOUND,
  INCORRECT_AUDIO_SOUND,
  PAUSE_TIME,
  NEUTRAL_RESULT_COLOR,
  DISABLE_ANIMATION_SWITCH,
  getRandomElement,
  shuffle,
} from "../../library/util";
import { Trie } from "../../library/trie";
import { playCryForPokemon } from "../../library/audioviz";

import AppHeader from "../../components/AppHeader";
import Settings from "../../components/Settings";
import PokeProgressBar from "../../components/PokeProgressBar";
import Score from "../../components/Score";
import AudioDisplay from "../../components/AudioDisplay";
import PokeButton, { OUTLINE_TYPE } from "../../components/PokeButton";

const ACTION_TYPES = {
  INITIAL_SETUP: "INITIAL_SETUP",
  UPDATE_INPUT: "UPDATE_INPUT",
  NEXT_POKEMON: "NEXT_POKEMON",
  ADD_CORRECT: "ADD_CORRECT",
  ADD_INCORRECT: "ADD_INCORRECT",
  DISABLE_INPUT: "DISABLE_INPUT",
  ENABLE_INPUT: "ENABLE_INPUT",
  END_GAME: "END_GAME",
};

export const SHINY_PROBABILITY = 1 / 69;

const initialState = {
  // User input.
  input: "",
  // Whether input should be disabled. True when loading, or after game completion.
  inputDisabled: true,
  // All relevant pokemon data. Maps from pokemon name to cries, sprites, etc.
  allPokemonData: {},
  // List of pokemon the user will guess.
  pokemonInGameOrder: [],
  // Index of pokemon the user is currently guessing.
  pokeNum: 0,
  // Set of all pokemon names.
  pokeTrie: new Trie(),
  // List of correctly guessed pokemon.
  correct: [],
  // List of incorrectly guessed pokemon.
  incorrect: [],
  // Suggestion remainder (autocomplete) based on current input + trie.
  suggestionRemainder: "",
  // Verdict
  verdict: "",
  // Previous guess
  previousGuess: "",
  // Tracks successful Pokemon in a row
  streak: 0,
  // Score tracker
  scoreMetrics: {
    score: 0,
    longestStreak: 0,
    fastestTimeMs: Number.MAX_SAFE_INTEGER,
    bestMon: "",
    correctness: 0,
  },
};

function quizReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.INITIAL_SETUP: {
      // Create a new Trie to avoid mutating previous state
      const newTrie = new Trie();
      const allPokemonNames = Object.keys(action.allPokemonData);
      if (Array.isArray(allPokemonNames)) {
        newTrie.insert(allPokemonNames);
      }
      return {
        ...initialState,
        inputDisabled: false,
        allPokemonData: action.allPokemonData,
        pokemonInGameOrder: action.pokemonInGameOrder,
        pokeTrie: newTrie,
      };
    }
    case ACTION_TYPES.UPDATE_INPUT: {
      // compute suggestion remainder relative to new input
      const input = action.input || "";
      const trieResult = state.pokeTrie.getWord(input) || "";
      const suggestion =
        trieResult.length > input.length
          ? trieResult.substring(input.length)
          : "";
      return {
        ...state,
        input: input,
        suggestionRemainder: suggestion,
      };
    }
    case ACTION_TYPES.NEXT_POKEMON: {
      // reset input and compute suggestion remainder for empty input
      return {
        ...state,
        inputDisabled: true,
        pokeNum: state.pokeNum + 1, // state.pokemonInGameOrder.length, // for debugging
        input: "",
        suggestionRemainder: "",
      };
    }
    case ACTION_TYPES.ADD_CORRECT:
      if (Math.random() < SHINY_PROBABILITY) {
        state.allPokemonData[action.pokemon].sprite =
          state.allPokemonData[action.pokemon].shinySprite;
        state.allPokemonData[action.pokemon].staticSprite =
          state.allPokemonData[action.pokemon].staticShinySprite;
      }
      let streakMultiplier = Math.min(state.streak, 10) / 5 + 1;
      const time = action.ms;
      let scoreIncrement = 1;
      if (time < 2000) {
        scoreIncrement = 5;
      } else if (time < 5000) {
        scoreIncrement = 3;
      } else if (time < 10000) {
        scoreIncrement = 2;
      }
      let bestMon = state.scoreMetrics.bestMon;
      if (time < state.scoreMetrics.fastestTimeMs) {
        bestMon = state.pokemonInGameOrder[state.pokeNum];
      }
      return {
        ...state,
        correct: [...state.correct, state.pokemonInGameOrder[state.pokeNum]],
        previousGuess: action.input,
        streak: state.streak + 1,
        longestStreak: Math.max(state.longestStreak, state.streak + 1),
        scoreMetrics: {
          ...state.scoreMetrics,
          score: state.scoreMetrics.score + scoreIncrement * streakMultiplier,
          longestStreak: Math.max(
            state.scoreMetrics.longestStreak,
            state.streak + 1
          ),
          fastestTimeMs: Math.min(state.scoreMetrics.fastestTimeMs, time),
          bestMon: bestMon,
          correctness: state.scoreMetrics.correctness + 1,
        },
      };
    case ACTION_TYPES.ADD_INCORRECT:
      return {
        ...state,
        incorrect: [
          ...state.incorrect,
          state.pokemonInGameOrder[state.pokeNum],
        ],
        previousGuess: action.input,
        streak: 0,
      };
    case ACTION_TYPES.DISABLE_INPUT:
      return { ...state, inputDisabled: true };
    case ACTION_TYPES.ENABLE_INPUT: {
      // recompute remainder for current (possibly empty) input
      const input = state.input || "";
      const trieResult = state.pokeTrie.getWord(input) || "";
      const suggestion =
        trieResult.length > input.length
          ? trieResult.substring(input.length)
          : "";
      return {
        ...state,
        inputDisabled: false,
        suggestionRemainder: suggestion,
      };
    }
    case ACTION_TYPES.END_GAME:
      return {
        ...state,
        inputDisabled: true,
        pokeNum: state.pokeNum + 1,
        input: "",
        suggestionRemainder: "",
        verdict:
          state.correct.length === state.pokemonInGameOrder.length
            ? getRandomElement([
                "Go touch grass",
                "Incredible stuff",
                "You must be fun at parties",
                "Wow",
              ])
            : state.correct.length / state.pokemonInGameOrder.length >= 0.8
            ? "Great job"
            : state.correct.length / state.pokemonInGameOrder.length >= 0.5
            ? "Not bad"
            : state.correct.length === 0
            ? "That's rough buddy"
            : "Still better than most",
      };
    default:
      return state;
  }
}

// Format mm:ss:hh from elapsed milliseconds (hundredths precision)
function formatHundredths(ms) {
  const pad2 = (n) => n.toString().padStart(2, "0");
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${pad2(minutes)}:${pad2(seconds)}:${pad2(hundredths)}`;
}

// Display-only clock that updates unless frozen. Resets when `startMs` changes.
function useDisplayClock(startMs, freeze) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (freeze || !startMs) return;
    const id = setInterval(() => setNow(Date.now()), 10);
    return () => clearInterval(id);
  }, [freeze, startMs]);
  const elapsed = Math.max(0, (now || 0) - (startMs || 0));
  return formatHundredths(elapsed);
}

function Challenge() {
  const {
    homeSettings,
    allPokemonData, // Data of all Pokemon
    pokemonNamesForRelevantGens,
  } = useLocation().state || {};
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [settings, setSettings] = useState(homeSettings || {});
  // Ref to the input DOM node so we can trigger a shake animation on wrong guesses.
  const inputRef = useRef(null);

  // Required for audio sound and visualization.
  const canvasRef = useRef(null);
  const audioRef = useRef(new Audio());
  const vizInitializedRef = useRef(false);
  const [showViz, setShowViz] = useState(true);

  // Ref to store timer start (ms since epoch). Set when initial setup completes.
  const totalStartRef = useRef(null);
  // Clock state: mm:ss:hh (hundredths). Start at 00:00:00 until game begins.
  const [totalClock, setTotalClock] = useState("00:00:00");

  // Local clock (display-only): start time and formatted display string
  const localStartRef = useRef(null); // kept for scoring calculations
  const [localStartMs, setLocalStartMs] = useState(null);
  const localClockDisplay = useDisplayClock(localStartMs, state.inputDisabled);

  if (!navigator.userActivation.hasBeenActive) {
    navigate("/");
  }

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

  useEffect(() => {
    const pokemonInGameOrder = shuffle(pokemonNamesForRelevantGens);
    // Play first cry with viz.
    const firstPokemon = pokemonInGameOrder[0];
    setTimeout(() => {
      playCryForPokemon(
        allPokemonData[firstPokemon],
        vizInitializedRef,
        audioRef,
        canvasRef,
        settings
      );
      inputRef.current && inputRef.current.focus();
      totalStartRef.current = Date.now() + 500;
      // Initialize local timers for the first Pokémon
      const start = Date.now() + 500;
      localStartRef.current = start; // for scoring
      setLocalStartMs(start); // for display
      dispatch({
        type: ACTION_TYPES.INITIAL_SETUP,
        allPokemonData: allPokemonData,
        pokemonInGameOrder: pokemonInGameOrder,
        pokeNum: 1,
      });
    }, 500);
  }, []);

  // Start a high-resolution timer for the total clock only (local clock handled by hook)
  useEffect(() => {
    let totalTimerId = null;
    if (totalStartRef.current && !state.inputDisabled) {
      const pad2 = (n) => n.toString().padStart(2, "0");
      const updateTotal = () => {
        const elapsed = Date.now() - totalStartRef.current;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const hundredths = Math.floor((elapsed % 1000) / 10);
        const timeStr =
          (hours > 0 ? `${pad2(hours)}:` : "") +
          `${pad2(minutes)}:${pad2(seconds)}:${pad2(hundredths)}`;
        setTotalClock(timeStr);
      };
      updateTotal();
      totalTimerId = setInterval(updateTotal, 10);
    }
    return () => {
      if (totalTimerId) clearInterval(totalTimerId);
    };
  }, [state.inputDisabled]);

  useEffect(() => {
    if (state.pokeNum === DISABLE_ANIMATION_SWITCH) {
      setSettings({
        ...settings,
        disableAnimations: !settings.disableAnimations,
      });
    }
  }, [state.pokeNum]);

  function triggerCorrectAnimation() {
    // Grab confirm answer button
    let confirmAnswerButton = document.getElementById("confirm-answer");
    if (!confirmAnswerButton) return;
    // Fill confirm answer button in green.
    confirmAnswerButton.classList.remove("btn-outline-success");
    confirmAnswerButton.classList.add("btn-success");
    // After timeout, grab it again and reset it.
    setTimeout(() => {
      confirmAnswerButton = document.getElementById("confirm-answer");
      if (confirmAnswerButton) {
        confirmAnswerButton.classList.add("btn-outline-success");
        confirmAnswerButton.classList.remove("btn-success");
        confirmAnswerButton.disabled = true;
      }
    }, PAUSE_TIME);
  }

  function triggerIncorrectAnimation() {
    let shakeableInputGroup = document.getElementById("shake-input-group");
    if (shakeableInputGroup) {
      // Remove and then add shake for safety.
      shakeableInputGroup.classList.remove("shake");
      shakeableInputGroup.classList.add("shake");
      // After timeout, discard shake.
      setTimeout(() => {
        shakeableInputGroup = document.getElementById("shake-input-group");
        if (shakeableInputGroup) shakeableInputGroup.classList.remove("shake");
      }, PAUSE_TIME);
    }
    // Grab confirm answer button.
    let confirmAnswerButton = document.getElementById("confirm-answer");
    let confirmAnswerIcon = document.getElementById("confirm-answer-icon");
    if (confirmAnswerButton && confirmAnswerIcon) {
      // Fill in the icon with danger and X.
      confirmAnswerButton.classList.remove("btn-outline-success");
      confirmAnswerButton.classList.add("btn-danger");
      confirmAnswerIcon.classList.add("bi-x-circle");
      // After timeout, grab it again and reset it.
      setTimeout(() => {
        confirmAnswerButton = document.getElementById("confirm-answer");
        confirmAnswerIcon = document.getElementById("confirm-answer-icon");
        if (confirmAnswerButton) {
          confirmAnswerButton.classList.add("btn-outline-success");
          confirmAnswerButton.classList.remove("btn-danger");
        }
        confirmAnswerIcon && confirmAnswerIcon.classList.remove("bi-x-circle");
      }, PAUSE_TIME);
    }
  }

  // Unified handler for both window-level key events and input onKeyDown.
  const handleKey = useCallback((e) => {
    if (state.inputDisabled) return;
    const currPokemon = state.pokemonInGameOrder[state.pokeNum];
    if (!currPokemon) return;
    const suggestion = state.suggestionRemainder;
    const input = `${state.input}${suggestion}`;
    switch (e.key) {
      // Replay sound on 'space'
      case " ":
        e.preventDefault();
        setShowViz(true);
        playCryForPokemon(
          allPokemonData[currPokemon],
          vizInitializedRef,
          audioRef,
          canvasRef,
          settings
        );
        return;
      case "Tab": {
        e.preventDefault();
        dispatch({ type: ACTION_TYPES.UPDATE_INPUT, input });
        return;
      }
      case "Enter": {
        e.preventDefault();
        if (!state.pokeTrie.words.has(input)) {
          dispatch({ type: ACTION_TYPES.UPDATE_INPUT, input });
          return;
        }
        if (input === currPokemon) {
          dispatch({
            type: ACTION_TYPES.ADD_CORRECT,
            pokemon: currPokemon,
            input: input,
            ms: Date.now() - (localStartRef.current || Date.now()),
          });
          // Play correct feedback sound
          CORRECT_AUDIO_SOUND.play();
          triggerCorrectAnimation();
        } else {
          dispatch({
            type: ACTION_TYPES.ADD_INCORRECT,
            pokemon: currPokemon,
            input: input,
          });
          // Play incorrect feedback sound
          INCORRECT_AUDIO_SOUND.play();
          // Trigger shake animation on the input when incorrect
          triggerIncorrectAnimation();
        }
        dispatch({
          type: ACTION_TYPES.NEXT_POKEMON,
        });
        // Allow users to see the result before hearing the next pokemon.
        if (state.pokeNum + 1 < pokemonNamesForRelevantGens.length) {
          setTimeout(() => {
            const nextPokemon = state.pokemonInGameOrder[state.pokeNum + 1];
            setShowViz(true);
            playCryForPokemon(
              allPokemonData[nextPokemon],
              vizInitializedRef,
              audioRef,
              canvasRef,
              settings
            );
            // Reset local clock for next Pokémon and resume when input is enabled
            const start = Date.now();
            localStartRef.current = start; // for scoring
            setLocalStartMs(start); // for display
            dispatch({ type: ACTION_TYPES.ENABLE_INPUT });
            setTimeout(() => {
              inputRef.current && inputRef.current.focus();
            }, 200);
          }, PAUSE_TIME);
        }
        return;
      }
      default:
        break;
    }
  });

  // Listen to key input
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const previous = state.pokemonInGameOrder[state.pokeNum - 1];
  // Helper to render a result row (correct / incorrect)
  const resultsPanel = () => {
    if (state.pokeNum === 0) {
      return null;
    }
    return (
      <div>
        {state.pokeNum === pokemonNamesForRelevantGens.length ? (
          <Row className="mb-5 mt-4 justify-content-center">
            <Col lg={7} sm={12} className="align-items-stretch flex">
              <Row
                className="align-items-stretch rounded container-fluid flex p-2 justify-content-center"
                style={{
                  outlineColor: NEUTRAL_RESULT_COLOR,
                  outlineStyle: "solid",
                  outlineWidth: "4px",
                  width: "auto",
                }}
              >
                <Col
                  className="align-items-center justify-content-center d-flex"
                  sm={12}
                  lg={2}
                  style={{
                    marginRight: "10px",
                  }}
                >
                  <div>
                    Total score:{" "}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {Math.round(state.scoreMetrics.score)} points{" "}
                      {state.scoreMetrics.score > 1000
                        ? `🥳`
                        : state.scoreMetrics.score > 0
                        ? `⭐`
                        : "😭"}
                    </span>
                  </div>
                </Col>
                <Col
                  className="align-items-center justify-content-center d-flex"
                  sm={12}
                  lg={2}
                  style={{ backgroundColor: NEUTRAL_RESULT_COLOR }}
                >
                  <div>
                    Longest streak:{" "}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {`${state.scoreMetrics.longestStreak} ${
                        state.scoreMetrics.longestStreak ===
                        state.pokemonInGameOrder.length
                          ? "🤯"
                          : state.scoreMetrics.longestStreak > 0
                          ? "🔥"
                          : "💩"
                      }`}
                    </span>
                  </div>
                </Col>
                <Col
                  className="align-items-center justify-content-center d-flex"
                  sm={12}
                  lg={2}
                  style={{
                    marginLeft: "10px",
                    marginRight: "10px",
                  }}
                >
                  <div>
                    Correctness:{" "}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {`${state.scoreMetrics.correctness} / ${state.pokeNum}`}{" "}
                      {state.scoreMetrics.correctness > 0 ? `✅` : "❌"}
                    </span>
                  </div>
                </Col>
                <Col
                  className="align-items-center justify-content-center d-flex"
                  sm={12}
                  lg={2}
                  style={{ backgroundColor: NEUTRAL_RESULT_COLOR }}
                >
                  <div>
                    {`Fastest Pokemon: ${
                      state.scoreMetrics.bestMon
                        ? `${state.scoreMetrics.bestMon} in `
                        : ""
                    }`}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {state.scoreMetrics.fastestTimeMs < 1000
                        ? `${(state.scoreMetrics.fastestTimeMs / 1000).toFixed(
                            2
                          )} 😱`
                        : state.scoreMetrics.fastestTimeMs < 2000
                        ? `${(state.scoreMetrics.fastestTimeMs / 1000).toFixed(
                            2
                          )} 🏎️`
                        : state.scoreMetrics.fastestTimeMs !==
                          Number.MAX_SAFE_INTEGER
                        ? `${(state.scoreMetrics.fastestTimeMs / 1000).toFixed(
                            2
                          )} ⏱`
                        : "uhhh"}
                    </span>
                  </div>
                </Col>
                <Col
                  className="align-items-center justify-content-center d-flex"
                  sm={12}
                  lg={2}
                  style={{
                    marginLeft: "10px",
                  }}
                >
                  <div>
                    {!state.scoreMetrics.bestMon ||
                    state.correctness === state.pokemonInGameOrder.length ? (
                      <span>
                        👑
                        <br />
                        🫵
                      </span>
                    ) : (
                      <div>
                        👑
                        <br />
                        <span style={{ whiteSpace: "nowrap" }}>
                          {
                            <PokeButton
                              key={`best-mon-${state.scoreMetrics.bestMon}`}
                              name={state.scoreMetrics.bestMon}
                              sprite={
                                state.allPokemonData[state.scoreMetrics.bestMon]
                                  .sprite
                              }
                              outlineType={
                                state.incorrect.includes(
                                  state.scoreMetrics.bestMon
                                )
                                  ? OUTLINE_TYPE.RED
                                  : OUTLINE_TYPE.GREEN
                              }
                              onClick={() => {
                                setShowViz(false);
                                playCryForPokemon(
                                  allPokemonData[state.scoreMetrics.bestMon],
                                  vizInitializedRef,
                                  audioRef,
                                  canvasRef,
                                  settings
                                );
                              }}
                            />
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        ) : null}
        <Row className="mb-5 justify-content-center">
          <Col xs={6} sm={4} lg={2}>
            Previous:
            <br />
            <PokeButton
              key={`prev-${previous}`}
              name={previous}
              sprite={state.allPokemonData[previous].sprite}
              outlineType={OUTLINE_TYPE.GREEN}
              onClick={() => {
                setShowViz(false);
                playCryForPokemon(
                  allPokemonData[previous],
                  vizInitializedRef,
                  audioRef,
                  canvasRef,
                  settings
                );
              }}
            />
          </Col>
          {state.previousGuess &&
          state.pokemonInGameOrder[state.pokeNum - 1] !==
            state.previousGuess ? (
            <Col xs={6} sm={4} lg={2}>
              Guessed:
              <br />
              <PokeButton
                key={`prev-guess-${state.previousGuess}`}
                name={state.previousGuess}
                sprite={state.allPokemonData[state.previousGuess].sprite}
                outlineType={OUTLINE_TYPE.RED}
                onClick={() => {
                  setShowViz(false);
                  playCryForPokemon(
                    allPokemonData[state.previousGuess],
                    vizInitializedRef,
                    audioRef,
                    canvasRef,
                    settings
                  );
                }}
              />
            </Col>
          ) : null}
        </Row>
        {state.pokeNum === pokemonNamesForRelevantGens.length ? (
          <Row className="justify-content-center">
            <Col className="col-md-8">
              <div
                className="p-2 rounded"
                style={{ backgroundColor: NEUTRAL_RESULT_COLOR }}
              >
                <div className="d-flex flex-wrap justify-content-center mt-1">
                  {state.pokemonInGameOrder
                    .slice(0, state.pokeNum - 1)
                    .map((name) => {
                      let s = state.allPokemonData[name]?.sprite;
                      if (settings.disableAnimations) {
                        s = state.allPokemonData[name]?.staticSprite;
                      }
                      return typeof s === "string" ? (
                        <PokeButton
                          key={`result-${name}`}
                          name={name}
                          sprite={s}
                          outlineType={
                            state.incorrect.includes(name)
                              ? OUTLINE_TYPE.RED
                              : OUTLINE_TYPE.GREEN
                          }
                          onClick={() => {
                            setShowViz(false);
                            playCryForPokemon(
                              allPokemonData[name],
                              vizInitializedRef,
                              audioRef,
                              canvasRef,
                              settings
                            );
                          }}
                        />
                      ) : (
                        s
                      );
                    })}
                </div>
              </div>
            </Col>
          </Row>
        ) : null}
      </div>
    );
  };

  let autocomplete = document.getElementById("autocomplete");
  if (autocomplete && state.suggestionRemainder.length > 0) {
    autocomplete.innerHTML = state.input + state.suggestionRemainder;
  } else if (autocomplete) {
    autocomplete.innerHTML = "";
  }
  const progress = (state.pokeNum / pokemonNamesForRelevantGens.length) * 100;

  return (
    <div className="App p-5 text-center">
      <AppHeader />
      <div className="App" style={{ position: "relative" }}>
        <Row>
          <Col>
            {/* Back button positioned at top-left (inside padded app area) */}
            <Button variant="secondary" size="sm" onClick={() => navigate("/")}>
              ← Back
            </Button>
          </Col>
          <Col>
            <p>Challenge Mode!</p> {/* Back button (left) */}
          </Col>{" "}
          <Col>
            <Settings settings={settings} setSettings={setSettings} />
          </Col>
        </Row>
        <br />
        <p>Repeat the sound for the current Pokemon by pressing 'space'</p>
        <Row className="justify-content-center">
          <Col sm={12} md={6} lg={5}>
            <br />
            {/* Container for relative positioning */}
            <span>
              Total Time:{" "}
              {totalStartRef.current - Date.now() > 0 ? "00:00:00" : totalClock}
            </span>
            <PokeProgressBar completionPercent={progress} />
            {/* Audio button for current Pokemon. */}
          </Col>
        </Row>
      </div>
      <Row className="justify-content-center">
        <Col xs={12} md={4}>
          {progress < 100 ? (
            <div
              className="align-items-center rounded p-2 pb-3 mt-3 mb-3"
              style={{
                outlineColor: NEUTRAL_RESULT_COLOR,
                outlineStyle: "dashed",
              }}
            >
              <Row className="justify-content-center mb-3 g-0">
                <AudioDisplay
                  buttonFn={() => {
                    setShowViz(true);
                    playCryForPokemon(
                      allPokemonData[state.pokemonInGameOrder[state.pokeNum]],
                      vizInitializedRef,
                      audioRef,
                      canvasRef,
                      settings
                    );
                  }}
                  canvasRef={canvasRef}
                  audioRef={audioRef}
                  vizInitializedRef={vizInitializedRef}
                  showViz={showViz}
                />
              </Row>
              <Row className="justify-content-center mb-3">
                <Col className="justify-content-center">
                  <InputGroup
                    id="shake-input-group"
                    className="w-100"
                    style={{
                      alignItems: "stretch",
                      paddingLeft: "1rem",
                      paddingRight: "1rem",
                    }}
                  >
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
                    {/* The actual input, with a transparent background */}
                    <div
                      id="search_container"
                      style={{
                        position: "relative" /* IMPORTANT */,
                        flex: 1,
                        display: "flex",
                      }}
                    >
                      <div
                        id="autocomplete"
                        style={{
                          position: "absolute" /* IMPORTANT */,
                          zIndex: 1 /* IMPORTANT */,
                          // border: 0 /* HAS TO BE SIMILAR TO #autocomplete */,
                          fontSize: "14px" /* HAS TO BE SIMILAR TO #search_ */,
                          left: "11px" /* ACCORDING TO THE LEFT-PADDING OF #search_ */,
                          top: "11px" /* ACCORDING TO THE TOP-PADDING OF #search_ */,
                          opacity: 0.5 /* TO MAKE IT LOOK LIKE A PLACEHOLDER */,
                        }}
                      ></div>
                      <FormControl
                        autoComplete="off"
                        id="search_"
                        ref={inputRef}
                        type="text"
                        disabled={state.inputDisabled}
                        value={state.input}
                        className="flex rounded-0"
                        style={{
                          backgroundColor: "transparent",
                          position: "relative",
                          zIndex: 1,
                          // border: 0 /* HAS TO BE SIMILAR TO #autocomplete */,

                          width: "100%",
                          fontSize:
                            "14px" /* HAS TO BE SIMILAR TO #autocomplete */,
                          padding: "10px" /* IMPORTANT */,
                          flex: 1,
                        }}
                        onChange={(e) =>
                          dispatch({
                            type: ACTION_TYPES.UPDATE_INPUT,
                            input: e.target.value
                              .trim()
                              .toLowerCase()
                              .replace(/[^a-z2-]/g, ""),
                          })
                        }
                      />
                    </div>
                    {/* Submit button */}
                    <Button
                      id="confirm-answer"
                      variant="outline-success"
                      disabled={
                        !state.inputDisabled &&
                        state.pokeTrie.words &&
                        !state.pokeTrie.words.has(state.input)
                      }
                      onClick={() =>
                        handleKey({ key: "Enter", preventDefault: () => {} })
                      }
                    >
                      <i
                        id="confirm-answer-icon"
                        className="bi bi-check-circle"
                      ></i>
                    </Button>
                  </InputGroup>
                </Col>
              </Row>
              <Row>
                {state.scoreMetrics.score === 0 ? null : (
                  <Col>
                    <Score
                      numPokemonToGuess={pokemonNamesForRelevantGens.length}
                      pokeNum={state.pokeNum}
                      numerator={state.correct.length}
                      score={state.scoreMetrics.score}
                    />
                  </Col>
                )}
                {/* Local clock display: resets on next Pokémon, freezes when input is disabled */}
                <Col>{state.pokeNum === 0 ? null : localClockDisplay}</Col>
              </Row>
            </div>
          ) : null}
        </Col>
      </Row>
      {state.streak > 0 && progress < 100 ? `🔥 ${state.streak}` : null}
      {resultsPanel()}
    </div>
  );
}
export default Challenge;
