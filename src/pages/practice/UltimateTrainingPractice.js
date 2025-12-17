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
  MASTERY_COLOR,
  ROUTER_UTIL,
  SHINY_PROBABILITY,
  SHINY_AUDIO_SOUND,
} from "../../library/util";
import { Trie } from "../../library/trie";
import { playCryForMon } from "../../library/audioViz";
import { useSettings } from "../../AppContext";

import PokeProgressBar from "../../components/PokeProgressBar";
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

const MASTERY_MULTIPLIER = 2;

const LEAST_MASTERED = 1;
const ALMOST_MASTERED = 0;
const MASTERED = -1;
const PERFECT = -2;

const NEAR_OR_TOTAL_MASTERY = new Set([ALMOST_MASTERED, MASTERED, PERFECT]);

const initialState = {
  // User input.
  input: "",
  // Whether input should be disabled. True when loading, or after game completion.
  inputDisabled: true,
  // All relevant mon data. Maps from mon name to cries, sprites, etc.
  allMon: {},
  // List of mon the user will guess.
  monInGameOrder: [],
  // Index of mon the user is currently guessing.
  pokeNum: 0,
  // Set of all mon names.
  pokeTrie: new Trie(),
  // Suggestion remainder (autocomplete) based on current input + trie.
  suggestionRemainder: "",
  // Previous guess
  previousGuess: "",
  // Maps from Mon to mastery level.
  mastery: {},
  // Maps from Mon to error count.
  errors: {},
  // Contains mastered mon sorted by most to least recently mastered.
  masteredMon: [],
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
        ...initialState,
        inputDisabled: false,
        allMon: action.allMon,
        monInGameOrder: action.monInGameOrder,
        pokeTrie: newTrie,
        masteredMon: [],
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
      let monMastery = -1;
      switch (state.mastery[action.mon]) {
        // Correct on first try: perfect.
        case undefined:
          if (Math.random() < SHINY_PROBABILITY) {
            state.allMon[action.mon].displaySprite =
              state.allMon[action.mon].shinySprite;
            state.allMon[action.mon].staticDisplaySprite =
              state.allMon[action.mon].staticShinySprite;
            SHINY_AUDIO_SOUND.play();
          } else {
            CORRECT_AUDIO_SOUND.play();
          }
          monMastery = PERFECT;
          state.masteredMon.unshift(action.mon);
          break;
        // Correct after almost mastered: mastered.
        case ALMOST_MASTERED:
          monMastery = MASTERED;
          state.masteredMon.unshift(action.mon);
          break;
        // Correct after some imperfect level of mastery: improve by a factor.
        default:
          monMastery = state.mastery[action.mon] * MASTERY_MULTIPLIER;
      }
      const monInGameOrder = state.monInGameOrder;
      // If the Mon is not yet mastered, reinsert further down the list.
      if (monMastery !== MASTERED && monMastery !== PERFECT) {
        monInGameOrder.splice(
          state.pokeNum + monMastery,
          action.pokeNum,
          action.mon
        );
        // If the Mon is at the end of the list, ensure it gets mastered next time.
        if (state.pokeNum + monMastery >= state.monInGameOrder.length) {
          monMastery = ALMOST_MASTERED;
        }
      }
      return {
        ...state,
        mastery: {
          ...state.mastery,
          [action.mon]: monMastery,
        },
        monInGameOrder: monInGameOrder,
        previousGuess: action.input,
      };
    case ACTION_TYPES.ADD_INCORRECT: {
      const monInGameOrder = state.monInGameOrder;
      monInGameOrder.splice(
        state.pokeNum + LEAST_MASTERED,
        action.pokeNum,
        action.mon
      );
      INCORRECT_AUDIO_SOUND.play();
      return {
        ...state,
        mastery: {
          ...state.mastery,
          [action.mon]: LEAST_MASTERED,
        },
        monInGameOrder: monInGameOrder,
        previousGuess: action.input,
        errors: {
          ...state.errors,
          [action.mon]: (state.errors[action.mon] || 0) + 1,
        },
      };
    }
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

function UltimateTrainingPractice() {
  const {
    allMon, // Data of all Mon
    numMonToGuess, // Mon names for this quiz
    monNamesForRelevantGens,
  } = useLocation().state || {};
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(quizReducer, initialState);
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
      const firstMon = monNamesForRelevantGens[0];
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
      monInGameOrder: monNamesForRelevantGens.slice(0, numMonToGuess),
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
    const currMon = state.monInGameOrder[state.pokeNum];
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
          triggerCorrectAnimation();
        } else {
          dispatch({
            type: ACTION_TYPES.ADD_INCORRECT,
            mon: currMon,
            input: input,
          });
          // Trigger shake animation on the input when incorrect
          triggerIncorrectAnimation();
        }
        dispatch({ type: ACTION_TYPES.NEXT_POKEMON });
        // Allow users to see the result before hearing the next mon.
        const loadNextMon =
          // There is a next mon in the list already.
          state.pokeNum + 1 < state.monInGameOrder.length ||
          // The input was wrong, so we will repeat this mon after the next dispatch is finished.
          input !== currMon ||
          // The user has not yet mastered this Mon, even after a correct attempt.
          Object.keys(state.mastery).filter(
            (key) => !NEAR_OR_TOTAL_MASTERY.has(state.mastery[key])
          ).length > 0;
        if (loadNextMon) {
          setTimeout(() => {
            const nextMon = state.monInGameOrder[state.pokeNum + 1];
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
    state.monInGameOrder[state.pokeNum - 1] !== state.previousGuess
  ) {
    errorComponent = (
      <Col xs={6} sm={4} lg={2}>
        Guessed:
        <br />
        <PokeButton
          key={`prev-guess-${state.previousGuess}`}
          name={state.previousGuess}
          sprite={state.allMon[state.previousGuess].displaySprite}
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

  let previousComponent = null;
  if (state.previousGuess) {
    const previous = state.monInGameOrder[state.pokeNum - 1];
    previousComponent = (
      <Row className="mb-2 justify-content-center">
        {" "}
        <Col xs={6} sm={4} lg={2}>
          Previous:
          <br />
          <PokeButton
            key={`prev-${previous}`}
            name={previous}
            sprite={state.allMon[previous].displaySprite}
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
    );
  }

  // Helper to render a result row (correct / incorrect)
  const resultsPanel = () => {
    return (
      <div>
        {
          <Row className="mb-2 justify-content-center">
            <Col xl={Math.max(6, Math.min(12, state.masteredMon.length))}>
              <div
                className="p-2 rounded"
                style={{ backgroundColor: MASTERY_COLOR }}
              >
                Mastery:{" "}
                {state.masteredMon.length === 0 ? (
                  "(empty)"
                ) : (
                  <div className="d-flex flex-wrap justify-content-center mt-1">
                    {state.masteredMon.map((name) => {
                      let s = state.allMon[name]?.displaySprite;
                      if (settings.disableAnimations) {
                        s = state.allMon[name]?.staticDisplaySprite;
                      }
                      return typeof s === "string" ? (
                        <PokeButton
                          key={`mastered-${name}`}
                          name={name}
                          sprite={s}
                          outlineType={
                            state.mastery[name] === PERFECT
                              ? OUTLINE_TYPE.GREEN
                              : OUTLINE_TYPE.NONE
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
                )}
              </div>
            </Col>
          </Row>
        }
      </div>
    );
  };

  let autocomplete = document.getElementById("autocomplete");
  if (autocomplete && state.suggestionRemainder.length > 0) {
    autocomplete.innerHTML = state.input + state.suggestionRemainder;
  } else if (autocomplete) {
    autocomplete.innerHTML = "";
  }
  const progress = (state.pokeNum / state.monInGameOrder.length) * 100;
  return (
    <span>
      <div className="App text-center" style={{ position: "relative" }}>
        <Row>
          <p>Ultimate Training! Mon are repeated until mastered.</p>{" "}
        </Row>
        <p>Repeat the sound for the current mon by pressing 'space'</p>
        <Row className="justify-content-center">
          <Col xs={12} md={4}>
            {/* Container for relative positioning */}
            <PokeProgressBar completionPercent={progress} />
          </Col>
        </Row>
      </div>
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
                      allMon[state.monInGameOrder[state.pokeNum]],
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
      <br />
      {previousComponent}
      {resultsPanel()}
    </span>
  );
}
export default UltimateTrainingPractice;
