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
  LOCAL_STORAGE_UTIL,
  DEFAULT_SETTINGS,
  SHINY_PROBABILITY,
  DISABLE_ANIMATION_SWITCH,
  getRandomElement,
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

const initialState = {
  // User input.
  input: "",
  // Whether input should be disabled. True when loading, or after game completion.
  inputDisabled: true,
  // All relevant pokemon data. Maps from pokemon name to cries, sprites, etc.
  allPokemon: {},
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
};

function quizReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.INITIAL_SETUP: {
      // Create a new Trie to avoid mutating previous state
      const newTrie = new Trie();
      const allPokemonNames = Object.keys(action.allPokemon);
      if (Array.isArray(allPokemonNames)) {
        newTrie.insert(allPokemonNames);
      }
      return {
        input: "",
        inputDisabled: false,
        allPokemon: action.allPokemon,
        pokemonInGameOrder: action.pokemonInGameOrder,
        pokeNum: 0,
        pokeTrie: newTrie,
        correct: [],
        incorrect: [],
        suggestionRemainder: "",
        verdict: "",
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
        state.allPokemon[action.pokemon].displaySprite =
          state.allPokemon[action.pokemon].shinySprite;
        state.allPokemon[action.pokemon].staticDisplaySprite =
          state.allPokemon[action.pokemon].staticShinySprite;
        SHINY_AUDIO_SOUND.play();
      } else {
        CORRECT_AUDIO_SOUND.play();
      }
      return {
        ...state,
        correct: [...state.correct, state.pokemonInGameOrder[state.pokeNum]],
        previousGuess: action.input,
      };
    case ACTION_TYPES.ADD_INCORRECT:
      INCORRECT_AUDIO_SOUND.play();
      return {
        ...state,
        incorrect: [
          ...state.incorrect,
          state.pokemonInGameOrder[state.pokeNum],
        ],
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

function ShortAnswerPractice() {
  const {
    allPokemon, // Data of all Pokemon
    numPokemonToGuess, // Pokemon names for this quiz
    pokemonNamesForRelevantGens,
  } = useLocation().state || {};
  const navigate = useNavigate();
  const location = useLocation();
  const [state, dispatch] = useReducer(quizReducer, initialState);

  const { settings } = useSettings();
  const { preferLegacyCries } = settings;

  // Ref to the input DOM node so we can trigger a shake animation on wrong guesses.
  const inputRef = useRef(null);

  // Required for audio sound and visualization.
  const canvasRef = useRef(null);
  const audioRef = useRef(new Audio());
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
    if (numPokemonToGuess > 0) {
      const firstPokemon = pokemonNamesForRelevantGens[0];
      setTimeout(() => {
        playCryForPokemon(
          allPokemon[firstPokemon],
          vizInitializedRef,
          audioRef,
          canvasRef,
          settings.preferLegacyCries
        );
        inputRef.current && inputRef.current.focus();
      }, 500);
    }
    dispatch({
      type: ACTION_TYPES.INITIAL_SETUP,
      allPokemon: allPokemon,
      pokemonInGameOrder: pokemonNamesForRelevantGens,
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
          allPokemon[currPokemon],
          vizInitializedRef,
          audioRef,
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
        if (input === currPokemon) {
          dispatch({
            type: ACTION_TYPES.ADD_CORRECT,
            pokemon: currPokemon,
            input: input,
          });
          // Play correct feedback sound
          triggerCorrectAnimation();
        } else {
          dispatch({
            type: ACTION_TYPES.ADD_INCORRECT,
            pokemon: currPokemon,
            input: input,
          });
          // Play incorrect feedback sound
          // Trigger shake animation on the input when incorrect
          triggerIncorrectAnimation();
        }
        dispatch({ type: ACTION_TYPES.NEXT_POKEMON });
        // Allow users to see the result before hearing the next pokemon.
        if (state.pokeNum + 1 < numPokemonToGuess) {
          setTimeout(() => {
            const nextPokemon = state.pokemonInGameOrder[state.pokeNum + 1];
            playCryForPokemon(
              allPokemon[nextPokemon],
              vizInitializedRef,
              audioRef,
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
    state.pokemonInGameOrder[state.pokeNum - 1] !== state.previousGuess
  ) {
    errorComponent = (
      <Col xs={6} sm={4} lg={2}>
        Guessed:
        <br />
        <PokeButton
          name={state.previousGuess}
          sprite={
            settings.disableAnimations
              ? state.allPokemon[state.previousGuess]?.staticDisplaySprite
              : state.allPokemon[state.previousGuess]?.displaySprite
          }
          outlineType={OUTLINE_TYPE.RED}
          onClick={() => {
            setShowViz(false);
            playCryForPokemon(
              allPokemon[state.previousGuess],
              vizInitializedRef,
              audioRef,
              canvasRef,
              settings.preferLegacyCries
            );
          }}
        />
      </Col>
    );
  }
  const previous = state.pokemonInGameOrder[state.pokeNum - 1];
  // Helper to render a result row (correct / incorrect)
  const resultsPanel = () => {
    if (state.pokeNum === 0) {
      return null;
    }
    return (
      <div>
        <Row className="mb-2 justify-content-center">
          <Col xs={6} sm={4} lg={2}>
            Previous:
            <br />
            <PokeButton
              name={previous}
              sprite={
                settings.disableAnimations
                  ? allPokemon[previous]?.staticDisplaySprite
                  : allPokemon[previous]?.displaySprite
              }
              outlineType={OUTLINE_TYPE.GREEN}
              onClick={() => {
                setShowViz(false);
                playCryForPokemon(
                  allPokemon[previous],
                  vizInitializedRef,
                  audioRef,
                  canvasRef,
                  settings.preferLegacyCries
                );
              }}
            />
          </Col>
          {errorComponent}
        </Row>
        {state.pokeNum === numPokemonToGuess ? (
          <Row className="mb-2 justify-content-center">
            <Col className="col-md-6">
              <div
                className="p-2 rounded"
                style={{ backgroundColor: NEUTRAL_RESULT_COLOR }}
              >
                <div className="d-flex flex-wrap justify-content-center mt-1">
                  {state.pokemonInGameOrder
                    .slice(0, state.pokeNum - 1)
                    .map((name) => {
                      let s = state.allPokemon[name]?.displaySprite;
                      if (settings.disableAnimations) {
                        s = state.allPokemon[name]?.staticDisplaySprite;
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
                            playCryForPokemon(
                              allPokemon[name],
                              vizInitializedRef,
                              audioRef,
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
  const progress = (state.pokeNum / numPokemonToGuess) * 100;
  return (
    <div className="App p-5  text-center">
      <AppHeader />
      <div className="App" style={{ position: "relative" }}>
        <Row>
          <Col>
            {/* Back button positioned at top-left (inside padded app area) */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTER_UTIL.HOME)}
            >
              ← Back
            </Button>
          </Col>
          <Col>
            <p>Practice Mode!</p> {/* Back button (left) */}
          </Col>
          <Col>
            {" "}
            <Settings />
          </Col>
        </Row>
        <p>Repeat the sound for the current Pokemon by pressing 'space'</p>
        <Row className="justify-content-center">
          <Col xs={12} md={4}>
            {/* Container for relative positioning */}
            <PokeProgressBar completionPercent={progress} />
            {state.pokeNum === numPokemonToGuess && (
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
                Play Again
              </Button>
            )}
            {/* Score, only displayed if all Pokemon have been guessed. */}
            <Score
              numPokemonToGuess={numPokemonToGuess}
              pokeNum={state.pokeNum}
              numerator={state.correct.length}
            />
            {/* Audio button for current Pokemon. */}
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
                    playCryForPokemon(
                      allPokemon[state.pokemonInGameOrder[state.pokeNum]],
                      vizInitializedRef,
                      audioRef,
                      canvasRef,
                      settings.preferLegacyCries
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
            </div>
          ) : null}
        </Col>
      </Row>
      <br />
      {resultsPanel()}
    </div>
  );
}
export default ShortAnswerPractice;
