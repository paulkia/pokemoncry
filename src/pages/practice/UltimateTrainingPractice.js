import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Form,
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
  DISABLE_ANIMATION_SWITCH,
  getRandomElement,
} from "../../library/util";
import { Trie } from "../../library/trie";
import { playCryForPokemon } from "../../library/AudioViz";

import Settings from "../../components/Settings";
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

export const SHINY_PROBABILITY = 1 / 69;

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
  // All relevant pokemon data. Maps from pokemon name to cries, sprites, etc.
  allPokemon: {},
  // List of pokemon the user will guess.
  pokemonInGameOrder: [],
  // Index of pokemon the user is currently guessing.
  pokeNum: 0,
  // Set of all pokemon names.
  pokeTrie: new Trie(),
  // Suggestion remainder (autocomplete) based on current input + trie.
  suggestionRemainder: "",
  // Previous guess
  previousGuess: "",
  // Maps from Pokemon to mastery level.
  mastery: {},
  // Maps from Pokemon to error count.
  errors: {},
  // Contains mastered pokemon sorted by most to least recently mastered.
  masteredPokemon: [],
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
        suggestionRemainder: "",
        verdict: "",
        mastery: {},
        errors: {},
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
      let pokemonMastery = -1;
      switch (state.mastery[action.pokemon]) {
        // Correct on first try: perfect.
        case undefined:
          if (Math.random() < SHINY_PROBABILITY) {
            state.allPokemon[action.pokemon].sprite =
              state.allPokemon[action.pokemon].shinySprite;
            state.allPokemon[action.pokemon].staticSprite =
              state.allPokemon[action.pokemon].staticShinySprite;
          }
          pokemonMastery = PERFECT;
          break;
        // Correct after almost mastered: mastered.
        case ALMOST_MASTERED:
          pokemonMastery = MASTERED;
          break;
        // Correct after some imperfect level of mastery: improve by a factor.
        default:
          pokemonMastery = state.mastery[action.pokemon] * MASTERY_MULTIPLIER;
      }
      const pokemonInGameOrder = state.pokemonInGameOrder;
      // If the Pokemon is not yet mastered, reinsert further down the list.
      if (pokemonMastery !== MASTERED && pokemonMastery !== PERFECT) {
        pokemonInGameOrder.splice(
          state.pokeNum + pokemonMastery,
          action.pokeNum,
          action.pokemon
        );
        // If the Pokemon is at the end of the list, ensure it gets mastered next time.
        if (state.pokeNum + pokemonMastery >= state.pokemonInGameOrder.length) {
          pokemonMastery = ALMOST_MASTERED;
        }
      }
      return {
        ...state,
        mastery: {
          ...state.mastery,
          [action.pokemon]: pokemonMastery,
        },
        pokemonInGameOrder: pokemonInGameOrder,
        previousGuess: action.input,
      };
    case ACTION_TYPES.ADD_INCORRECT: {
      const pokemonInGameOrder = state.pokemonInGameOrder;
      pokemonInGameOrder.splice(
        state.pokeNum + LEAST_MASTERED,
        action.pokeNum,
        action.pokemon
      );
      return {
        ...state,
        mastery: {
          ...state.mastery,
          [action.pokemon]: LEAST_MASTERED,
        },
        pokemonInGameOrder: pokemonInGameOrder,
        previousGuess: action.input,
        errors: {
          ...state.errors,
          [action.pokemon]: (state.errors[action.pokemon] || 0) + 1,
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
    homeSettings,
    allPokemon, // Data of all Pokemon
    numPokemonToGuess, // Pokemon names for this quiz
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
          settings
        );
        inputRef.current && inputRef.current.focus();
      }, 500);
    }
    dispatch({
      type: ACTION_TYPES.INITIAL_SETUP,
      allPokemon: allPokemon,
      pokemonInGameOrder: pokemonNamesForRelevantGens.slice(
        0,
        numPokemonToGuess
      ),
      pokeNum: 1,
    });
  }, []);

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
      // Replay sound on '1'
      case "1":
        setShowViz(true);
        playCryForPokemon(
          allPokemon[currPokemon],
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
        dispatch({ type: ACTION_TYPES.NEXT_POKEMON });
        // Allow users to see the result before hearing the next pokemon.
        const loadNextPokemon =
          // There is a next pokemon in the list already.
          state.pokeNum + 1 < state.pokemonInGameOrder.length ||
          // The input was wrong, so we will repeat this pokemon after the next dispatch is finished.
          input !== currPokemon ||
          // The user has not yet mastered this Pokemon, even after a correct attempt.
          Object.keys(state.mastery).filter(
            (key) => !NEAR_OR_TOTAL_MASTERY.has(state.mastery[key])
          ).length > 0;
        if (loadNextPokemon) {
          setTimeout(() => {
            const nextPokemon = state.pokemonInGameOrder[state.pokeNum + 1];
            playCryForPokemon(
              allPokemon[nextPokemon],
              vizInitializedRef,
              audioRef,
              canvasRef,
              settings
            );
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
    const previous = state.pokemonInGameOrder[state.pokeNum - 1];
    errorComponent = (
      <Row className="mb-2 justify-content-center">
        <Col className="col-md-1">
          Previous:{" "}
          <PokeButton
            name={previous}
            sprite={state.allPokemon[previous].sprite}
            outlineType={OUTLINE_TYPE.GREEN}
            onClick={() => {
              setShowViz(false);
              playCryForPokemon(
                allPokemon[previous],
                vizInitializedRef,
                audioRef,
                canvasRef,
                settings
              );
            }}
          />
        </Col>
        <Col className="col-md-1">
          Guessed:{" "}
          <PokeButton
            name={state.previousGuess}
            sprite={state.allPokemon[state.previousGuess].sprite}
            outlineType={OUTLINE_TYPE.RED}
            onClick={() => {
              setShowViz(false);
              playCryForPokemon(
                allPokemon[state.previousGuess],
                vizInitializedRef,
                audioRef,
                canvasRef,
                settings
              );
            }}
          />
        </Col>
      </Row>
    );
  }
  // Helper to render a result row (correct / incorrect)
  const resultsPanel = () => {
    const masteredPokemon = Object.keys(state.mastery).filter(
      (key) => state.mastery[key] === MASTERED || state.mastery[key] === PERFECT
    );
    return (
      <div>
        {
          <Row className="mb-2 justify-content-center">
            <Col xl={Math.max(6, Math.min(12, masteredPokemon.length))}>
              <div
                className="p-2 rounded"
                style={{ backgroundColor: MASTERY_COLOR }}
              >
                Mastery:{" "}
                {masteredPokemon.length === 0 ? (
                  "(empty)"
                ) : (
                  <div className="d-flex flex-wrap justify-content-center mt-1">
                    {masteredPokemon.map((name) => {
                      let s = state.allPokemon[name]?.sprite;
                      if (settings.disableAnimations) {
                        s = state.allPokemon[name]?.staticSprite;
                      }
                      let outlineStyle = {};
                      if (state.mastery[name] === PERFECT) {
                        outlineStyle = { border: "4px solid #28a745" };
                      }
                      return typeof s === "string" ? (
                        <PokeButton
                          name={name}
                          sprite={s}
                          outlineType={
                            state.mastery[name] === PERFECT
                              ? OUTLINE_TYPE.GREEN
                              : OUTLINE_TYPE.NONE
                          }
                          onClick={() => {
                            setShowViz(false);
                            playCryForPokemon(
                              allPokemon[name],
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
  const progress = (state.pokeNum / state.pokemonInGameOrder.length) * 100;
  return (
    <div className="App p-5">
      <div className="App" style={{ position: "relative" }}>
        <Row>
          <Col>
            {/* Back button positioned at top-left (inside padded app area) */}
            <Button variant="secondary" size="sm" onClick={() => navigate("/")}>
              ← Back
            </Button>
          </Col>
          <Col>
            <Settings settings={settings} setSettings={setSettings} />
            <h4>Who's that Pokemon?</h4>
            <p></p>
            <p>
              Ultimate Training!
              <br />
              Pokemon are repeated until mastered.
            </p>{" "}
            {/* Back button (left) */}
          </Col>
          <Col></Col>
        </Row>
        <p>Repeat the sound for the current Pokemon by pressing '1'</p>
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
                    playCryForPokemon(
                      allPokemon[state.pokemonInGameOrder[state.pokeNum]],
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
            </div>
          ) : null}
        </Col>
      </Row>
      <br />
      {errorComponent}
      {resultsPanel()}
    </div>
  );
}
export default UltimateTrainingPractice;
