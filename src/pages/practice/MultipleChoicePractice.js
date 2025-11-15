import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, Row, Col } from "react-bootstrap";
import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  shuffle,
  CORRECT_RESULT_COLOR,
  INCORRECT_RESULT_COLOR,
  NEUTRAL_RESULT_COLOR,
} from "../../library/util";
import { playCryForPokemon } from "../../library/AudioViz";
import "../../App.css";
import Settings from "../../components/Settings";
import "bootstrap/dist/css/bootstrap.min.css";
import correctSound from "../../audio/correct.mp3";
import incorrectSound from "../../audio/incorrect.mp3";

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
  const {
    homeSettings,
    allPokemon, // Data of all Pokemon
    numPokemonToGuess, // Pokemon names for this quiz
    pokemonNamesForRelevantGens,
  } = useLocation().state || {};
  const navigate = useNavigate();
  const [settings, setSettings] = useState(homeSettings || {});
  const [pokemonInGameOrder] = useState(shuffle(pokemonNamesForRelevantGens));
  const [pokeNum, setPokeNum] = useState(0);
  const [multipleChoiceOptions, setMultipleChoiceOptions] = useState([]);
  const [multipleChoiceResults, setMultipleChoiceResults] = useState({});

  // Required for audio sound and visualization.
  const canvasRef = useRef(null);
  const audioRef = useRef(new Audio());
  const vizInitializedRef = useRef(false);
  const [showViz, setShowViz] = useState(true);

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
        playCryForPokemon(
          allPokemon[correctPokemon],
          vizInitializedRef,
          audioRef,
          canvasRef,
          settings
        );
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
        // Replay sound on '1'
        case "1":
          setShowViz(true);
          playCryForPokemon(
            allPokemon[pokemonInGameOrder[pokeNum]],
            vizInitializedRef,
            audioRef,
            canvasRef,
            settings
          );
          return;
        default:
          break;
      }
    },
    [pokemonInGameOrder, pokeNum, settings]
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

  const multipleChoiceRow = (
    multipleChoiceOptions,
    onClick,
    redPokemon = "",
    greenPokemon = ""
  ) => {
    let backgroundColor = NEUTRAL_RESULT_COLOR;
    if (redPokemon !== greenPokemon) {
      backgroundColor = INCORRECT_RESULT_COLOR;
    } else if (greenPokemon !== "") {
      backgroundColor = CORRECT_RESULT_COLOR;
    }
    return (
      <div
        className="p-2 rounded mb-2"
        style={{
          backgroundColor: backgroundColor,
        }}
      >
        <div className="d-flex flex-wrap justify-content-center mt-1">
          {multipleChoiceOptions.map((name) => {
            let s = allPokemon[name]?.sprite;
            if (settings.disableAnimations) {
              s = allPokemon[name]?.staticSprite;
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
              />
            ) : (
              s
            );
          })}
        </div>
      </div>
    );
  };

  const resultsPanel = () => {
    let results = [];
    for (let i = pokeNum - 1; i >= 0; i--) {
      const pokemonName = pokemonInGameOrder[i];
      results.push(
        multipleChoiceRow(
          multipleChoiceResults[pokemonName][
            MultipleChoiceResult.MULTIPLE_CHOICE_OPTIONS
          ],
          (name) => {
            setShowViz(false);
            playCryForPokemon(
              allPokemon[name],
              vizInitializedRef,
              audioRef,
              canvasRef,
              settings
            );
          },
          multipleChoiceResults[pokemonName][
            MultipleChoiceResult.SELECTED_POKEMON
          ],
          multipleChoiceResults[pokemonName][
            MultipleChoiceResult.ACTUAL_POKEMON
          ]
        )
      );
    }
    return results;
  };

  const progress = (pokeNum / numPokemonToGuess) * 100;
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
            <p>Practice Mode!</p> {/* Back button (left) */}
          </Col>
          <Col></Col>
        </Row>
        <p>Repeat the sound for the current Pokemon by pressing '1'</p>
        <Row className="justify-content-center">
          <Col xs={12} md={4}>
            {/* Container for relative positioning */}
            <PokeProgressBar completionPercent={progress} />
            {/* Score, only displayed if all Pokemon have been guessed. */}
            <Score
              numPokemonToGuess={numPokemonToGuess}
              pokeNum={pokeNum}
              numerator={
                Object.entries(multipleChoiceResults).filter(
                  ([pokeName, pokeResult]) =>
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
                className="align-items-center rounded p-2 pb-3 mb-3"
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
                      settings
                    );
                  }}
                  canvasRef={canvasRef}
                  audioRef={audioRef}
                  vizInitializedRef={vizInitializedRef}
                  showViz={showViz}
                />
                {/* Multiple choice options, only displayed if not all Pokemon have been guessed. */}
                <div>
                  {multipleChoiceRow(multipleChoiceOptions, evaluateChoice)}
                </div>
              </Row>
            ) : null}
          </Col>
        </Row>
      </div>
      <Row className="justify-content-center">
        {/* Results, only displayed if at least one Pokemon has been guessed. */}
        <Col className="col-md-4">
          {pokeNum > 0 && pokeNum < numPokemonToGuess ? (
            <Row className="m-4">
              <strong className="p-6" key={"results"}>
                {"[Score]"}
              </strong>{" "}
            </Row>
          ) : null}
          <Row>{pokeNum > 0 ? resultsPanel() : null}</Row>
        </Col>
      </Row>
    </div>
  );
}

export default MultipleChoicePractice;
