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
  Spinner,
  FormControl,
} from "react-bootstrap";
import { useState, useReducer, useEffect, useCallback, useRef } from "react";
import { usePoke, useSettings } from "../../AppContext";
import {
  CORRECT_AUDIO_SOUND,
  INCORRECT_AUDIO_SOUND,
  SHINY_AUDIO_SOUND,
  PAUSE_TIME,
  NEUTRAL_RESULT_COLOR,
  SHINY_PROBABILITY,
  ROUTER_UTIL,
} from "../../library/util";
import { Trie } from "../../library/trie";
import { playCryForMon, playCryFromByteUrl } from "../../library/audioViz";
import { doc, onSnapshot } from "firebase/firestore";
import PokeProgressBar from "../../components/PokeProgressBar";
import Score from "../../components/Score";
import AudioDisplay from "../../components/AudioDisplay";
import PokeButton, { OUTLINE_TYPE } from "../../components/PokeButton";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../../firebase";

const functions = getFunctions();
const createSession = httpsCallable(functions, "createSession");
const updateSession = httpsCallable(functions, "updateSession");

const ACTION_TYPES = {
  INITIAL_SETUP: "INITIAL_SETUP",
  UPDATE_INPUT: "UPDATE_INPUT",
  ADD_CORRECT: "ADD_CORRECT",
  ADD_INCORRECT: "ADD_INCORRECT",
  DISABLE_INPUT: "DISABLE_INPUT",
  ENABLE_INPUT: "ENABLE_INPUT",
  END_GAME: "END_GAME",
};

const LOADING_MESSAGES = {
  DONE_LOADING: "",
  INITIALIZING_SESSION: "Initializing session...",
  STARTING_SESSION: "Starting session...",
  LOADING_FIRST_CRY: "Loading first cry...",
};

const LOADING_PROGRESS = {
  [LOADING_MESSAGES.DONE_LOADING]: 100,
  [LOADING_MESSAGES.INITIALIZING_SESSION]: 25,
  [LOADING_MESSAGES.STARTING_SESSION]: 50,
  [LOADING_MESSAGES.LOADING_FIRST_CRY]: 75,
};

const initialState = {
  // User input.
  input: "",
  // Whether input should be disabled. True when loading, or after game completion.
  inputDisabled: true,
  // All relevant mon data. Maps from mon name to cries, sprites, etc.
  preloadedMon: {},
  // Index of mon the user is currently guessing.
  pokeNum: 0,
  // Set of all mon names.
  pokeTrie: new Trie(),
  // List of correctly guessed mon.
  correct: [],
  // List of incorrectly guessed mon.
  incorrect: [],
  // Previous mons guessed.
  previousMon: [],
  // Url for current cry.
  currentCryUrl: null,
  // Suggestion remainder (autocomplete) based on current input + trie.
  suggestionRemainder: "",
  // Previous guess
  previousGuess: "",
  // Score from server.
  score: 0,
  // Tracks successful Mon in a row.
  streak: 0,
  // Tracks whether game is complete.
  isGameComplete: false,
  // Metrics for end-of-game display.
  finalStats: {
    totalScore: 0,
    longestStreak: 0,
    fastestTimeMs: Number.MAX_SAFE_INTEGER,
    bestMon: null,
    correctCount: 0,
    totalCount: 0,
  },
};

function quizReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.INITIAL_SETUP: {
      // Create a new Trie to avoid mutating previous state
      const newTrie = new Trie();
      const allMonNames = Object.keys(action.preloadedMon);
      if (Array.isArray(allMonNames)) {
        newTrie.insert(allMonNames);
      }
      return {
        ...initialState,
        preloadedMon: action.preloadedMon,
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
    case ACTION_TYPES.ADD_CORRECT:
      if (Math.random() < SHINY_PROBABILITY) {
        state.preloadedMon[action.mon].displaySprite =
          state.preloadedMon[action.mon].shinySprite;
        state.preloadedMon[action.mon].staticDisplaySprite =
          state.preloadedMon[action.mon].staticShinySprite;
        SHINY_AUDIO_SOUND.play();
      } else {
        CORRECT_AUDIO_SOUND.play();
      }
      return {
        ...state,
        correct: [...state.correct, action.mon],
        previousMon: [...state.previousMon, action.mon],
        previousGuess: action.mon,
        pokeNum: state.pokeNum + 1,
        input: "",
        suggestionRemainder: "",
        streak: action.streak,
        score: action.score,
      };
    case ACTION_TYPES.ADD_INCORRECT:
      INCORRECT_AUDIO_SOUND.play();
      return {
        ...state,
        incorrect: [...state.incorrect, action.mon],
        previousMon: [...state.previousMon, action.mon],
        previousGuess: action.input,
        pokeNum: state.pokeNum + 1,
        input: "",
        suggestionRemainder: "",
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
        input: "",
        suggestionRemainder: "",
        isGameComplete: true,
        finalStats: action.finalStats,
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
function useDisplayClock(startMs, monTimeTakenAccordingToServer, freeze) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (freeze || !startMs) return;
    const id = setInterval(() => setNow(Date.now()), 10);
    return () => clearInterval(id);
  }, [freeze, startMs]);
  if (!startMs) return formatHundredths(0);
  const elapsed = Math.max(0, (now || 0) - (startMs || 0));
  if (freeze && monTimeTakenAccordingToServer !== 0) {
    return formatHundredths(monTimeTakenAccordingToServer);
  }
  return formatHundredths(elapsed);
}

function Challenge() {
  const location = useLocation();
  const { numberOfMons, selectedGenerationId } = location.state || {
    numberOfMons: 0,
    selectedGenerationId: -1,
  };
  const navigate = useNavigate();

  const { preloadedMon } = usePoke();
  const { settings } = useSettings();

  const [state, dispatch] = useReducer(quizReducer, initialState);

  // Ref to the input DOM node so we can trigger a shake animation on wrong guesses.
  const inputRef = useRef(null);

  // Required for audio sound and visualization.
  const canvasRef = useRef(null);
  const vizInitializedRef = useRef(false);
  const [showViz, setShowViz] = useState(true);

  // Local clock (display-only): start time and formatted display string
  const localStartRef = useRef(null); // kept for scoring calculations
  const [localStartMs, setLocalStartMs] = useState(null);
  const [monTimeTakenAccordingToServer, setMonTimeTakenAccordingToServer] =
    useState(0);
  const localClockDisplay = useDisplayClock(
    localStartMs,
    monTimeTakenAccordingToServer,
    state.inputDisabled
  );

  const [sessionId, setSessionId] = useState(null);
  const [totalMonCount, setTotalMonCount] = useState(0);
  const [currentCryData, setCurrentCryData] = useState(null);

  const [loadingMessage, setLoadingMessage] = useState(
    LOADING_MESSAGES.INITIALIZING_SESSION
  );

  if (!navigator.userActivation.hasBeenActive || selectedGenerationId === -1) {
    navigate(ROUTER_UTIL.HOME);
  }

  function playCryFromBase64(base64Data = currentCryData) {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);

      playCryFromByteUrl(audioUrl, vizInitializedRef, canvasRef);
    } catch (error) {
      console.error("Error playing cry from base64:", error);
    }
  }

  useEffect(() => {
    async function initSession() {
      try {
        setLoadingMessage(LOADING_MESSAGES.INITIALIZING_SESSION);
        const startSessionResult = await createSession({
          generation: selectedGenerationId,
          mode: numberOfMons === 20 ? "fast" : "full",
          useLegacyCries: settings.preferLegacyCries,
        });
        const { totalMonCount, sessionId } = startSessionResult.data;

        setLoadingMessage(LOADING_MESSAGES.STARTING_SESSION);
        await updateSession({
          sessionId,
          answer: null,
        });
        setLoadingMessage(LOADING_MESSAGES.LOADING_FIRST_CRY);
        dispatch({
          type: ACTION_TYPES.INITIAL_SETUP,
          preloadedMon: preloadedMon,
          pokeNum: totalMonCount,
        });
        inputRef.current && inputRef.current.focus();

        setTotalMonCount(totalMonCount);
        setSessionId(sessionId);
        return;
      } catch (error) {
        console.error("Failed to start session:", error);
      }
      return () => {};
    }

    initSession();
    // Inject shake CSS once
    const styleId = "quiz-shake-style";
    if (!document.getElementById(styleId)) {
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
    }
  }, []);

  useEffect(() => {
    function startGameListener(sessionId) {
      const sessionRef = doc(db, "protected-sessions", sessionId);
      const unsubscribe = onSnapshot(
        sessionRef,
        async (docSnapshot) => {
          if (!docSnapshot.exists()) {
            unsubscribe();
            return;
          }
          const { previousCorrect, nextMonCryData } = docSnapshot.data();
          if (previousCorrect !== undefined) {
          }
          if (!nextMonCryData) {
            return;
          }
          setLoadingMessage(LOADING_MESSAGES.DONE_LOADING);
          setCurrentCryData(nextMonCryData);
          setTimeout(() => {
            playCryFromBase64(nextMonCryData);
          }, 10);
          setShowViz(true);
          const start = Date.now();
          localStartRef.current = start; // for scoring
          setLocalStartMs(start); // for display
          setMonTimeTakenAccordingToServer(0);
          dispatch({ type: ACTION_TYPES.ENABLE_INPUT });
          setTimeout(() => {
            inputRef.current && inputRef.current.focus();
          }, 200);
        },
        (error) => {
          console.error("Snapshot error:", error);
        }
      );

      // Return the unsubscribe function so you can stop listening when the game ends
      return unsubscribe;
    }

    if (sessionId === null) return;
    const unsubscribe = startGameListener(sessionId);
    return () => {
      unsubscribe();
    };
  }, [sessionId]);

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
  const handleKey = useCallback(async (e) => {
    if (state.inputDisabled) return;
    const suggestion = state.suggestionRemainder;
    const input = `${state.input}${suggestion}`;
    switch (e.key) {
      // Replay sound on 'space'
      case " ":
        e.preventDefault();
        setShowViz(true);
        playCryFromBase64();
        return;
      case "Tab": {
        e.preventDefault();
        dispatch({ type: ACTION_TYPES.UPDATE_INPUT, input });
        return;
      }
      case "Enter": {
        e.preventDefault();
        if (!sessionId || !state.pokeTrie.words.has(input)) {
          dispatch({ type: ACTION_TYPES.UPDATE_INPUT, input });
          return;
        }

        dispatch({ type: ACTION_TYPES.DISABLE_INPUT });

        try {
          const {
            data: {
              correct: isCorrect,
              correctAnswer,
              newStreak,
              newTotalScore,
              isGameComplete,
              timeMs,
              finalStats,
            },
          } = await updateSession({
            sessionId,
            answer: input,
          });
          setMonTimeTakenAccordingToServer(timeMs);

          if (isCorrect) {
            dispatch({
              type: ACTION_TYPES.ADD_CORRECT,
              mon: correctAnswer,
              streak: newStreak,
              score: newTotalScore,
            });
            triggerCorrectAnimation();
          } else {
            dispatch({
              type: ACTION_TYPES.ADD_INCORRECT,
              mon: correctAnswer,
              input: input,
            });
            // Trigger shake animation on the input when incorrect
            triggerIncorrectAnimation();
          }

          if (isGameComplete) {
            // Game complete - show final stats
            dispatch({ type: ACTION_TYPES.END_GAME, finalStats: finalStats });
            // Leaderboard already updated by server!
          }
        } catch (error) {
          console.error("Error submitting answer:", error);
          // Re-enable input on error
          dispatch({ type: ACTION_TYPES.ENABLE_INPUT });
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

  const prevPoke = state.previousMon.length > 0 ? state.previousMon.at(-1) : "";

  // Helper to render a result row (correct / incorrect)
  const resultsPanel = () => {
    if (state.pokeNum === 0) {
      return null;
    }
    return (
      <div>
        {state.isGameComplete ? (
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
                      {Math.round(state.score)} points{" "}
                      {state.score > (numberOfMons === 20 ? 100 : 1000)
                        ? `🥳`
                        : state.score > 0
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
                      {`${state.finalStats.longestStreak} ${
                        state.finalStats.longestStreak === totalMonCount.length
                          ? "🤯"
                          : state.finalStats.longestStreak > 0
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
                      {`${state.finalStats.correctCount} / ${state.finalStats.totalCount}`}{" "}
                      {state.finalStats.correctCount ===
                      state.finalStats.totalCount
                        ? "💯"
                        : state.finalStats.correctCount > 0
                        ? `✅`
                        : "❌"}
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
                    {`Fastest Mon: ${
                      state.finalStats.bestMon
                        ? `${state.finalStats.bestMon} in `
                        : ""
                    }`}
                    <span style={{ whiteSpace: "nowrap" }}>
                      {state.finalStats.fastestTimeMs < 1000
                        ? `${(state.finalStats.fastestTimeMs / 1000).toFixed(
                            2
                          )} 😱`
                        : state.finalStats.fastestTimeMs < 2000
                        ? `${(state.finalStats.fastestTimeMs / 1000).toFixed(
                            2
                          )} 🏎️`
                        : state.finalStats.fastestTimeMs !==
                          Number.MAX_SAFE_INTEGER
                        ? `${(state.finalStats.fastestTimeMs / 1000).toFixed(
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
                    {state.finalStats.correctCount === 0 ? (
                      <span>
                        👑
                        <br />
                        🤡
                      </span>
                    ) : (
                      <div>
                        👑
                        <br />
                        <span style={{ whiteSpace: "nowrap" }}>
                          {
                            <PokeButton
                              key={`best-mon-${state.finalStats.bestMon}`}
                              name={state.finalStats.bestMon}
                              sprite={
                                settings.disableAnimations
                                  ? state.preloadedMon[state.finalStats.bestMon]
                                      ?.staticDisplaySprite
                                  : state.preloadedMon[state.finalStats.bestMon]
                                      .displaySprite
                              }
                              outlineType={
                                state.incorrect.includes(
                                  state.finalStats.bestMon
                                )
                                  ? OUTLINE_TYPE.RED
                                  : OUTLINE_TYPE.GREEN
                              }
                              onClick={() => {
                                setShowViz(false);
                                playCryForMon(
                                  preloadedMon[state.finalStats.bestMon],
                                  vizInitializedRef,
                                  canvasRef,
                                  settings.preferLegacyCries
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
              key={`prev-${prevPoke}`}
              name={prevPoke}
              sprite={
                settings.disableAnimations
                  ? state.preloadedMon[prevPoke]?.staticDisplaySprite
                  : state.preloadedMon[prevPoke]?.displaySprite
              }
              outlineType={OUTLINE_TYPE.GREEN}
              onClick={() => {
                setShowViz(false);
                playCryForMon(
                  preloadedMon[prevPoke],
                  vizInitializedRef,
                  canvasRef,
                  settings.preferLegacyCries
                );
              }}
            />
          </Col>
          {state.previousMon.length > 0 &&
          state.previousMon.at(-1) !== state.previousGuess ? (
            <Col xs={6} sm={4} lg={2}>
              Guessed:
              <br />
              <PokeButton
                key={`prev-guess-${state.previousGuess}`}
                name={state.previousGuess}
                sprite={
                  settings.disableAnimations
                    ? state.preloadedMon[state.previousGuess]
                        ?.staticDisplaySprite
                    : state.preloadedMon[state.previousGuess]?.displaySprite
                }
                outlineType={OUTLINE_TYPE.RED}
                onClick={() => {
                  setShowViz(false);
                  playCryForMon(
                    state.preloadedMon[state.previousGuess],
                    vizInitializedRef,
                    canvasRef,
                    settings.preferLegacyCries
                  );
                }}
              />
            </Col>
          ) : null}
        </Row>
        {state.isGameComplete ? (
          <Row className="justify-content-center">
            <Col className="col-md-8">
              <div
                className="p-2 rounded"
                style={{ backgroundColor: NEUTRAL_RESULT_COLOR }}
              >
                <div className="d-flex flex-wrap justify-content-center mt-1">
                  {state.previousMon.map((name) => {
                    let s = state.preloadedMon[name]?.displaySprite;
                    if (settings.disableAnimations) {
                      s = state.preloadedMon[name]?.staticDisplaySprite;
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
                          playCryForMon(
                            state.preloadedMon[name],
                            vizInitializedRef,
                            canvasRef,
                            settings.preferLegacyCries
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
  const progress =
    totalMonCount === 0 ? 0 : (state.pokeNum / totalMonCount) * 100;

  return (
    <span className="text-center">
      <div className="App" style={{ position: "relative" }}>
        <Row>
          <p>Challenge Mode!</p> {/* Back button (left) */}
        </Row>
        <p>Repeat the sound for the current mon by pressing 'space'</p>
        <Row className="justify-content-center">
          <Col sm={12} md={6} lg={5}>
            {/* <br /> */}
            {/* Container for relative positionings */}
            {/* <span>
              Total Time:{" "}
              <Clock totalStartRef={totalStartRef} totalClock={totalClock} />
            </span> */}
            <PokeProgressBar
              className="mt-4 mb-3"
              completionPercent={progress}
            />
            {state.isGameComplete && (
              <Button
                onClick={() => {
                  navigate(ROUTER_UTIL.REFRESHER, {
                    state: {
                      refreshRoute: location.pathname,
                      refreshState: location.state,
                    },
                  });
                }}
              >
                Play Again <i className="bi bi-arrow-repeat"></i>
              </Button>
            )}{" "}
            {state.isGameComplete && (
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip>
                    <div className="App">Your score has been submitted.</div>
                  </Tooltip>
                }
              >
                <Button
                  onClick={() => {
                    navigate(ROUTER_UTIL.LEADERBOARD, {
                      state: {
                        gen: selectedGenerationId,
                        mode: numberOfMons === 20 ? "fast" : "full",
                      },
                    });
                  }}
                >
                  Leaderboard <i className="bi bi-trophy-fill"></i>
                </Button>
              </OverlayTrigger>
            )}
            {/* Audio button for current Mon. */}
          </Col>
        </Row>
      </div>
      <Row className="justify-content-center">
        <Col xs={12} md={4}>
          {progress < 100 && !loadingMessage && (
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
                    playCryFromBase64();
                  }}
                  canvasRef={canvasRef}
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
                <Col>
                  <Score points={state.score} />
                </Col>
                {/* Local clock display: resets on next Pokémon, freezes when input is disabled */}
                <Col>{localClockDisplay}</Col>
              </Row>
            </div>
          )}
          {loadingMessage && (
            <div
              className="rounded"
              style={{
                outlineColor: NEUTRAL_RESULT_COLOR,
                outlineStyle: "dashed",
              }}
            >
              <Row>
                <Col className="p-2 d-flex justify-content-center align-items-center">
                  {loadingMessage}
                </Col>
              </Row>
              <Row className="p-3">
                <PokeProgressBar
                  completionPercent={LOADING_PROGRESS[loadingMessage]}
                  visuallyHidden
                />
              </Row>
            </div>
          )}
        </Col>
      </Row>
      <Col className="justify-content-center mb-2">
        {state.streak > 0 && progress < 100 ? `🔥 ${state.streak}` : null}
      </Col>
      {resultsPanel()}
    </span>
  );
}
export default Challenge;
