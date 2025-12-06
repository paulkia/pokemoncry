import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, Row, Col } from "react-bootstrap";
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  shuffle,
  ROUTER_UTIL,
  CORRECT_RESULT_COLOR,
  INCORRECT_RESULT_COLOR,
  NEUTRAL_RESULT_COLOR,
  LOCAL_STORAGE_UTIL,
  DEFAULT_SETTINGS,
} from "../../library/util";
import { useSettings } from "../../AppContext";
import { playCryForPokemon } from "../../library/audioviz";
import "../../App.css";
import Settings from "../../components/Settings";
import "bootstrap/dist/css/bootstrap.min.css";
import correctSound from "../../audio/correct.mp3";
import incorrectSound from "../../audio/incorrect.mp3";

import AppHeader from "../../components/AppHeader";
import AudioDisplay from "../../components/AudioDisplay";
import PokeProgressBar from "../../components/PokeProgressBar";
import Score from "../../components/Score";
import PokeButton, { OUTLINE_TYPE } from "../../components/PokeButton";

const NUM_OPTIONS = 4;

export const MultipleChoiceResult = {
  MULTIPLE_CHOICE_OPTIONS: 0,
  SELECTED_POKEMON: 1,
  ACTUAL_POKEMON: 2,
};

function MultipleChoicePractice() {
  const location = useLocation();
  const {
    allPokemon, // Data of all Pokemon
    numPokemonToGuess, // Pokemon names for this quiz
    pokemonNamesForRelevantGens,
  } = location.state || {};
  const navigate = useNavigate();
  const [pokemonInGameOrder] = useState(shuffle(pokemonNamesForRelevantGens));
  const { settings } = useSettings();
  const [pokeNum, setPokeNum] = useState(0);
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState([]);
  const [multipleChoiceResults, setMultipleChoiceResults] = useState({});

  // Required for audio sound and visualization.
  const canvasRef = useRef(null);
  const audioRef = useRef(new Audio());
  const vizInitializedRef = useRef(false);
  const [showViz, setShowViz] = useState(true);

  if (!navigator.userActivation.hasBeenActive) {
    navigate(ROUTER_UTIL.HOME);
  }

  // Always trigger cry for the next Pokemon.
  useEffect(() => {
    const correctPokemon = pokemonInGameOrder[pokeNum];
    const relevantPokemonExceptCurrentAnswer =
      pokemonNamesForRelevantGens.filter((poke) => poke !== correctPokemon);
    const multipleChoiceOptionsPlusCorrectAnswer = shuffle(
      relevantPokemonExceptCurrentAnswer
    )
      .slice(0, NUM_OPTIONS - 1)
      .concat([correctPokemon]);
    setMultipleChoiceOptions(shuffle(multipleChoiceOptionsPlusCorrectAnswer));
    // Play the correct Pokemon's cry (with viz)
    if (pokeNum < numPokemonToGuess) {
      setTimeout(() => {
        try {
          playCryForPokemon(
            allPokemon[correctPokemon],
            vizInitializedRef,
            audioRef,
            canvasRef,
            settings.preferLegacyCries
          );
        } catch (err) {
          if (err.name === "NotAllowedError") {
            navigate(ROUTER_UTIL.HOME);
          }
        }
        setShowViz(true);
      }, 500);
    }
  }, [pokeNum]);

  // Unified handler for both window-level key events and input onKeyDown.
  const handleKey = useCallback(
    (e) => {
      if (pokeNum >= numPokemonToGuess) {
        return;
      }
      switch (e.key) {
        // Replay sound on 'space'
        case " ":
          e.preventDefault();
          setShowViz(true);
          playCryForPokemon(
            allPokemon[pokemonInGameOrder[pokeNum]],
            vizInitializedRef,
            audioRef,
            canvasRef,
            settings.preferLegacyCries
          );
          return;
        case "1":
        case "2":
        case "3":
        case "4":
          e.preventDefault();
          const choiceIndex = parseInt(e.key) - 1;

          if (choiceIndex >= 0 && choiceIndex < multipleChoiceOptions.length) {
            const chosenName = multipleChoiceOptions[choiceIndex];
            evaluateChoice(chosenName);
          }
          return;
        default:
          break;
      }
    },
    [pokemonInGameOrder, pokeNum, settings, multipleChoiceOptions]
  );

  // Listen to key input
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const evaluateChoice = (chosenName) => {
    const correctPokemon = pokemonInGameOrder[pokeNum];
    if (chosenName === correctPokemon) {
      new Audio(correctSound).play();
    } else {
      new Audio(incorrectSound).play();
    }
    setMultipleChoiceResults({
      ...multipleChoiceResults,
      [correctPokemon]: {
        [MultipleChoiceResult.MULTIPLE_CHOICE_OPTIONS]: multipleChoiceOptions,
        [MultipleChoiceResult.SELECTED_POKEMON]: chosenName,
        [MultipleChoiceResult.ACTUAL_POKEMON]: correctPokemon,
      },
    });
    setPokeNum(pokeNum + 1);
  };

  const multipleChoiceRow = ({
    multipleChoiceOptions = [],
    onClick = null,
    redPokemon = "",
    greenPokemon = "",
    numbered = false,
  }) => {
    let backgroundColor = NEUTRAL_RESULT_COLOR;
    if (redPokemon !== greenPokemon) {
      backgroundColor = INCORRECT_RESULT_COLOR;
    } else if (greenPokemon !== "") {
      backgroundColor = CORRECT_RESULT_COLOR;
    }
    let num = 1;
    const multipleChoiceRawComponent = multipleChoiceOptions.map((name) => {
      let s = allPokemon[name]?.displaySprite;
      if (settings.disableAnimations) {
        s = allPokemon[name]?.staticDisplaySprite;
      }
      return typeof s === "string" ? (
        <PokeButton
          key={name}
          name={name}
          sprite={s}
          outlineType={
            name === greenPokemon
              ? OUTLINE_TYPE.GREEN
              : name === redPokemon
              ? OUTLINE_TYPE.RED
              : OUTLINE_TYPE.NONE
          }
          onClick={onClick}
          label={numbered ? num++ : null}
        />
      ) : (
        s
      );
    });
    return (
      <div
        className="p-2 rounded mb-2"
        key={multipleChoiceOptions.join("-")}
        style={{
          backgroundColor: backgroundColor,
        }}
      >
        <div className="d-flex flex-wrap justify-content-center mt-1">
          {
            <span>
              {multipleChoiceRawComponent.slice(0, 2)}
              <span style={{ whiteSpace: "nowrap" }}>
                {multipleChoiceRawComponent.slice(2, 4)}
              </span>
            </span>
          }
        </div>
      </div>
    );
  };

  const resultsPanel = () => {
    let results = [];
    for (let i = pokeNum - 1; i >= 0; i--) {
      const pokemonName = pokemonInGameOrder[i];
      results.push(
        multipleChoiceRow({
          multipleChoiceOptions:
            multipleChoiceResults[pokemonName][
              MultipleChoiceResult.MULTIPLE_CHOICE_OPTIONS
            ],
          onClick: (name) => {
            setShowViz(false);
            playCryForPokemon(
              allPokemon[name],
              vizInitializedRef,
              audioRef,
              canvasRef,
              settings.preferLegacyCries
            );
          },
          redPokemon:
            multipleChoiceResults[pokemonName][
              MultipleChoiceResult.SELECTED_POKEMON
            ],
          greenPokemon:
            multipleChoiceResults[pokemonName][
              MultipleChoiceResult.ACTUAL_POKEMON
            ],
        })
      );
    }
    return results;
  };

  const progress = (pokeNum / numPokemonToGuess) * 100;
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
            <Settings />
          </Col>
        </Row>
        <p>Repeat the sound for the current Pokemon by pressing 'space'</p>
        <p>Press 1, 2, 3, or 4 to select an option</p>
        <Row className="justify-content-center">
          <Col xs={12} md={5}>
            {/* Container for relative positioning */}
            <PokeProgressBar completionPercent={progress} />
            {pokeNum === numPokemonToGuess && (
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
              pokeNum={pokeNum}
              numerator={
                Object.entries(multipleChoiceResults).filter(
                  ([_pokeName, pokeResult]) =>
                    pokeResult[MultipleChoiceResult.SELECTED_POKEMON] ===
                    pokeResult[MultipleChoiceResult.ACTUAL_POKEMON]
                ).length
              }
            />
            <br />
            {/* Audio button for current Pokemon. */}
            {pokeNum !== numPokemonToGuess ? (
              // Audio display. Reveals either the waveform (current cry) or name of previous cry.
              <Row
                className="align-items-center rounded p-2 pb-3 mb-2"
                style={{
                  outlineColor: NEUTRAL_RESULT_COLOR,
                  outlineStyle: "dashed",
                }}
              >
                <AudioDisplay
                  buttonFn={() => {
                    setShowViz(true);
                    playCryForPokemon(
                      allPokemon[pokemonInGameOrder[pokeNum]],
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
                {/* Multiple choice options, only displayed if not all Pokemon have been guessed. */}
                <div>
                  {multipleChoiceRow({
                    multipleChoiceOptions: multipleChoiceOptions,
                    onClick: evaluateChoice,
                    numbered: true,
                  })}
                </div>
              </Row>
            ) : null}
          </Col>
        </Row>
      </div>
      <Row className="justify-content-center">
        {/* Results, only displayed if at least one Pokemon has been guessed. */}
        <Col md={5}>
          {pokeNum > 0 && pokeNum < numPokemonToGuess ? (
            <Row className="m-4"></Row>
          ) : null}
          <Row>{pokeNum > 0 ? resultsPanel() : null}</Row>
        </Col>
      </Row>
    </div>
  );
}

export default MultipleChoicePractice;
