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
import { useSettings } from "../../AppContext";
import {
  CORRECT_AUDIO_SOUND,
  INCORRECT_AUDIO_SOUND,
  SHINY_AUDIO_SOUND,
  PAUSE_TIME,
  ROUTER_UTIL,
  NEUTRAL_RESULT_COLOR,
  SHINY_PROBABILITY,
  shuffle,
} from "../../library/util";
import { Trie } from "../../library/trie";
import { playCryForMon } from "../../library/audioViz";

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

const initialState = {
  // User input.
  input: "",
  // Whether input should be disabled. True when loading, or after game completion.
  inputDisabled: true,
  // All relevant mon data. Maps from mon name to cries, sprites, etc.
  allMon: {},
  // Index of mon the user is currently guessing.
  pokeNum: 0,
  // Set of all mon names.
  pokeTrie: new Trie(),
  // List of correctly guessed mon.
  correct: [],
  // List of incorrectly guessed mon.
  incorrect: [],
  // Suggestion remainder (autocomplete) based on current input + trie.
  suggestionRemainder: "",
  // Previous guess
  previousGuess: "",
};

function quizReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.INITIAL_SETUP: {
      // Create a new Trie to avoid mutating previous state
      const newTrie = new Trie();
      const allMonNames = Object.keys(action.allMon);
      if (Array.isArray(allMonNames)) {
        newTrie.insert(allMonNames);
      }
      return {
        input: "",
        inputDisabled: false,
        allMon: action.allMon,
        monInGameOrder: action.monInGameOrder,
        pokeNum: 0,
        pokeTrie: newTrie,
        correct: [],
        incorrect: [],
        suggestionRemainder: "",
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
        pokeNum: state.pokeNum + 1,
        input: "",
        suggestionRemainder: "",
      };
    }
    case ACTION_TYPES.ADD_CORRECT:
      if (Math.random() < SHINY_PROBABILITY) {
        state.allMon[action.mon].displaySprite =
          state.allMon[action.mon].shinySprite;
        state.allMon[action.mon].staticDisplaySprite =
          state.allMon[action.mon].staticShinySprite;
        SHINY_AUDIO_SOUND.play();
      } else {
        CORRECT_AUDIO_SOUND.play();
      }
      return {
        ...state,
        correct: [...state.correct, action.mon],
        previousGuess: action.input,
      };
    case ACTION_TYPES.ADD_INCORRECT:
      INCORRECT_AUDIO_SOUND.play();
      return {
        ...state,
        incorrect: [...state.incorrect, action.mon],
        previousGuess: action.input,
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
      };
    default:
      return state;
  }
}

function ShortAnswerPractice() {
  const {
    allMon, // Data of all Mon
    numMonToGuess, // Mon names for this quiz
    monNamesForRelevantGens,
  } = useLocation().state || {};
  const navigate = useNavigate();
  const location = useLocation();
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [monInGameOrder] = useState(
    shuffle(monNamesForRelevantGens).slice(0, numMonToGuess)
  );

  const { settings } = useSettings();

  // Ref to the input DOM node so we can trigger a shake animation on wrong guesses.
  const inputRef = useRef(null);

  // Required for audio sound and visualization.
  const canvasRef = useRef(null);
  const vizInitializedRef = useRef(false);
  const [showViz, setShowViz] = useState(true);

  if (!navigator.userActivation.hasBeenActive) {
    navigate(ROUTER_UTIL.HOME);
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
    // Play first cry with viz.
    if (numMonToGuess > 0) {
      const firstMon = monInGameOrder[0];
      setTimeout(() => {
        playCryForMon(
          allMon[firstMon],
          vizInitializedRef,
          canvasRef,
          settings.preferLegacyCries
        );
        inputRef.current && inputRef.current.focus();
      }, 500);
    }
    dispatch({
      type: ACTION_TYPES.INITIAL_SETUP,
      allMon: allMon,
      pokeNum: 1,
    });
  }, []);

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
    const currMon = monInGameOrder[state.pokeNum];
    if (!currMon) return;
    const suggestion = state.suggestionRemainder;
    const input = `${state.input}${suggestion}`;
    switch (e.key) {
      // Replay sound on 'space'
      case " ":
        e.preventDefault();
        setShowViz(true);
        playCryForMon(
          allMon[currMon],
          vizInitializedRef,
          canvasRef,
          settings.preferLegacyCries
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
        if (input === currMon) {
          dispatch({
            type: ACTION_TYPES.ADD_CORRECT,
            mon: currMon,
            input: input,
          });
          // Play correct feedback sound
          triggerCorrectAnimation();
        } else {
          dispatch({
            type: ACTION_TYPES.ADD_INCORRECT,
            mon: currMon,
            input: input,
          });
          // Play incorrect feedback sound
          // Trigger shake animation on the input when incorrect
          triggerIncorrectAnimation();
        }
        dispatch({ type: ACTION_TYPES.NEXT_POKEMON });
        // Allow users to see the result before hearing the next mon.
        if (state.pokeNum + 1 < numMonToGuess) {
          setTimeout(() => {
            const nextMon = monInGameOrder[state.pokeNum + 1];
            playCryForMon(
              allMon[nextMon],
              vizInitializedRef,
              canvasRef,
              settings.preferLegacyCries
            );
            setShowViz(true);
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

  let errorComponent = null;
  if (
    state.previousGuess &&
    monInGameOrder[state.pokeNum - 1] !== state.previousGuess
  ) {
    errorComponent = (
      <Col xs={6} sm={4} lg={2}>
        Guessed:
        <br />
        <PokeButton
          name={state.previousGuess}
          sprite={
            settings.disableAnimations
              ? state.allMon[state.previousGuess]?.staticDisplaySprite
              : state.allMon[state.previousGuess]?.displaySprite
          }
          outlineType={OUTLINE_TYPE.RED}
          onClick={() => {
            setShowViz(false);
            playCryForMon(
              allMon[state.previousGuess],
              vizInitializedRef,
              canvasRef,
              settings.preferLegacyCries
            );
          }}
        />
      </Col>
    );
  }
  const previous = monInGameOrder[state.pokeNum - 1];
  // Helper to render a result row (correct / incorrect)
  const resultsPanel = () => {
    if (state.pokeNum === 0) {
      return null;
    }
    return (
      <div>
        <Row className="mb-2 justify-content-center text-center">
          <Col xs={6} sm={4} lg={2}>
            Previous:
            <br />
            <PokeButton
              name={previous}
              sprite={
                settings.disableAnimations
                  ? allMon[previous]?.staticDisplaySprite
                  : allMon[previous]?.displaySprite
              }
              outlineType={OUTLINE_TYPE.GREEN}
              onClick={() => {
                setShowViz(false);
                playCryForMon(
                  allMon[previous],
                  vizInitializedRef,
                  canvasRef,
                  settings.preferLegacyCries
                );
              }}
            />
          </Col>
          {errorComponent}
        </Row>
        {state.pokeNum === numMonToGuess ? (
          <Row className="mb-2 justify-content-center">
            <Col className="col-md-6">
              <div
                className="p-2 rounded"
                style={{ backgroundColor: NEUTRAL_RESULT_COLOR }}
              >
                <div className="d-flex flex-wrap justify-content-center mt-1">
                  {monInGameOrder.slice(0, state.pokeNum - 1).map((name) => {
                    let s = state.allMon[name]?.displaySprite;
                    if (settings.disableAnimations) {
                      s = state.allMon[name]?.staticDisplaySprite;
                    }
                    return typeof s === "string" ? (
                      <PokeButton
                        key={name}
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
                            allMon[name],
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
  const progress = (state.pokeNum / numMonToGuess) * 100;
  return (
    <span>
      <div className="App mt-3 text-center" style={{ position: "relative" }}>
        <Row>
          <p>Practice Mode!</p> {/* Back button (left) */}
        </Row>
        <p>Repeat the sound for the current mon by pressing 'space'</p>
        <Row className="justify-content-center">
          <Col xs={12} md={4} className="mt-3 mb-3">
            {/* Container for relative positioning */}
            <PokeProgressBar className="mb-4" completionPercent={progress} />
            {state.pokeNum === numMonToGuess && (
              <div>
                <Button
                  className="mb-4"
                  onClick={() => {
                    navigate(ROUTER_UTIL.REFRESHER, {
                      state: {
                        refreshRoute: location.pathname,
                        refreshState: location.state,
                      },
                    });
                  }}
                >
                  Play Again
                </Button>
              </div>
            )}
            {/* Score, only displayed if all Mon have been guessed. */}
            <Score
              numerator={state.correct.length}
              denominator={numMonToGuess}
            />
            {/* Audio button for current Mon. */}
          </Col>
        </Row>
      </div>
      {state.pokeNum !== numMonToGuess && navigator.userAgentData?.mobile && (
        <Row>
          <Col className="text-center m-3" style={{ fontSize: "14px" }}>
            Please turn on ringers / disable silent mode.
          </Col>
        </Row>
      )}
      <Row className="justify-content-center">
        <Col xs={12} md={4}>
          {" "}
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
                    playCryForMon(
                      allMon[monInGameOrder[state.pokeNum]],
                      vizInitializedRef,
                      canvasRef,
                      settings.preferLegacyCries
                    );
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
            </div>
          ) : null}
        </Col>
      </Row>
      {resultsPanel()}
    </span>
  );
}
export default ShortAnswerPractice;
