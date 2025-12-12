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
} from "../../library/util";
import { useSettings } from "../../AppContext";
import { playCryForMon } from "../../library/audioviz";
import "../../App.css";
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
  const location = useLocation();
  const {
    allMon, // Data of all Mon
    numMonToGuess, // Mon names for this quiz
    monNamesForRelevantGens,
  } = location.state || {};
  const navigate = useNavigate();
  console.log(monNamesForRelevantGens);
  const [monInGameOrder] = useState(shuffle(monNamesForRelevantGens));
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

  // Always trigger cry for the next Mon.
  useEffect(() => {
    const correctMon = monInGameOrder[pokeNum];
    const relevantMonExceptCurrentAnswer = monNamesForRelevantGens.filter(
      (poke) => poke !== correctMon
    );
    const multipleChoiceOptionsPlusCorrectAnswer = shuffle(
      relevantMonExceptCurrentAnswer
    )
      .slice(0, NUM_OPTIONS - 1)
      .concat([correctMon]);
    setMultipleChoiceOptions(shuffle(multipleChoiceOptionsPlusCorrectAnswer));
    // Play the correct Mon's cry (with viz)
    if (pokeNum < numMonToGuess) {
      setTimeout(() => {
        try {
          playCryForMon(
            allMon[correctMon],
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
      if (pokeNum >= numMonToGuess) {
        return;
      }
      switch (e.key) {
        // Replay sound on 'space'
        case " ":
          e.preventDefault();
          setShowViz(true);
          playCryForMon(
            allMon[monInGameOrder[pokeNum]],
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
    [monInGameOrder, pokeNum, settings, multipleChoiceOptions]
  );

  // Listen to key input
  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const evaluateChoice = (chosenName) => {
    const correctMon = monInGameOrder[pokeNum];
    if (chosenName === correctMon) {
      new Audio(correctSound).play();
    } else {
      new Audio(incorrectSound).play();
    }
    setMultipleChoiceResults({
      ...multipleChoiceResults,
      [correctMon]: {
        [MultipleChoiceResult.MULTIPLE_CHOICE_OPTIONS]: multipleChoiceOptions,
        [MultipleChoiceResult.SELECTED_POKEMON]: chosenName,
        [MultipleChoiceResult.ACTUAL_POKEMON]: correctMon,
      },
    });
    setPokeNum(pokeNum + 1);
  };

  const multipleChoiceRow = ({
    multipleChoiceOptions = [],
    onClick = null,
    redMon = "",
    greenMon = "",
    numbered = false,
  }) => {
    let backgroundColor = NEUTRAL_RESULT_COLOR;
    if (redMon !== greenMon) {
      backgroundColor = INCORRECT_RESULT_COLOR;
    } else if (greenMon !== "") {
      backgroundColor = CORRECT_RESULT_COLOR;
    }
    let num = 1;
    const multipleChoiceRawComponent = multipleChoiceOptions.map((name) => {
      let s = allMon[name]?.displaySprite;
      if (settings.disableAnimations) {
        s = allMon[name]?.staticDisplaySprite;
      }
      return typeof s === "string" ? (
        <PokeButton
          key={name}
          name={name}
          sprite={s}
          outlineType={
            name === greenMon
              ? OUTLINE_TYPE.GREEN
              : name === redMon
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
      const monName = monInGameOrder[i];
      results.push(
        multipleChoiceRow({
          multipleChoiceOptions:
            multipleChoiceResults[monName][
              MultipleChoiceResult.MULTIPLE_CHOICE_OPTIONS
            ],
          onClick: (name) => {
            setShowViz(false);
            playCryForMon(
              allMon[name],
              vizInitializedRef,
              audioRef,
              canvasRef,
              settings.preferLegacyCries
            );
          },
          redMon:
            multipleChoiceResults[monName][
              MultipleChoiceResult.SELECTED_POKEMON
            ],
          greenMon:
            multipleChoiceResults[monName][MultipleChoiceResult.ACTUAL_POKEMON],
        })
      );
    }
    return results;
  };

  const progress = (pokeNum / numMonToGuess) * 100;
  return (
    <span>
      <div className="App" style={{ position: "relative" }}>
        <Row>
          <p>Practice Mode!</p> {/* Back button (left) */}
        </Row>
        <p>Repeat the sound for the current mon by pressing 'space'</p>
        <p>Press 1, 2, 3, or 4 to select an option</p>
        <Row className="justify-content-center">
          <Col xs={12} md={5}>
            {/* Container for relative positioning */}
            <PokeProgressBar completionPercent={progress} />
            {pokeNum === numMonToGuess && (
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
            {/* Score, only displayed if all Mon have been guessed. */}
            <Score
              numMonToGuess={numMonToGuess}
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
            {/* Audio button for current Mon. */}
            {pokeNum !== numMonToGuess ? (
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
                    playCryForMon(
                      allMon[monInGameOrder[pokeNum]],
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
                {/* Multiple choice options, only displayed if not all Mon have been guessed. */}
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
        {/* Results, only displayed if at least one Mon has been guessed. */}
        <Col md={5}>
          {pokeNum > 0 && pokeNum < numMonToGuess ? (
            <Row className="m-4"></Row>
          ) : null}
          <Row>{pokeNum > 0 ? resultsPanel() : null}</Row>
        </Col>
      </Row>
    </span>
  );
}

export default MultipleChoicePractice;
