import { useState } from "react";
import {
  Container,
  Col,
  Row,
  Spinner,
  Button,
  FormControl,
  OverlayTrigger,
  Tooltip,
  ProgressBar,
  InputGroup,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Settings from "../../components/Settings";
import { useNavigate } from "react-router-dom";
import { GameModes, shuffle } from "../../library/util";

const PRACTICE_TYPE = {
  MULTIPLE_CHOICE: 1,
  SHORT_ANSWER: 2,
  ULTIMATE_TRAINING: 3,
};

function GenerationsGrid({
  generationCount = 0,
  selectedGenerationIds = [],
  setSelectedGenerationIds,
  genIcons = {},
  preloadComplete = false,
}) {
  // Pure grid renderer. Expects generationCount and selection handlers from parent.
  const buttonNumbers = Array.from(
    { length: generationCount },
    (_, index) => index + 1
  );

  const generateRows = () => {
    const rows = [];
    for (let i = 0; i < buttonNumbers.length; i += 3) {
      rows.push(
        <Row key={i} className="justify-content-center">
          {buttonNumbers.slice(i, i + 3).map((buttonId) => (
            <Col key={buttonId} xs={3} className="p-2">
              <Button
                variant={
                  selectedGenerationIds.includes(buttonId)
                    ? "primary"
                    : "outline-secondary"
                }
                className="w-100"
                onClick={() =>
                  setSelectedGenerationIds((prev) =>
                    prev.includes(buttonId)
                      ? prev.filter((x) => x !== buttonId)
                      : [...prev, buttonId]
                  )
                }
              >
                Gen {buttonId}{" "}
                {!preloadComplete ? null : (
                  <img
                    src={genIcons[buttonId] || ""}
                    alt={"↻"}
                    style={{
                      width: "55px",
                      height: "40px",
                      objectFit: "contain",
                    }}
                  />
                )}
              </Button>
            </Col>
          ))}
        </Row>
      );
    }
    return rows;
  };

  return <>{generateRows()}</>;
}

function PracticePanel({
  generationCount,
  loadingGens,
  settings,
  setSettings,
  setGameMode,
  preloadInfo,
}) {
  const navigate = useNavigate();
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([]);
  const [practiceType, setPracticeType] = useState(
    PRACTICE_TYPE.MULTIPLE_CHOICE
  );
  const [numberOfPokemon, setNumberOfPokemon] = useState(10);

  const allButtonNumbers = Array.from(
    { length: generationCount },
    (_, i) => i + 1
  );

  const handleSelectAll = () => {
    if (selectedGenerationIds.length === generationCount) {
      setSelectedGenerationIds([]);
    } else {
      setSelectedGenerationIds(allButtonNumbers);
    }
  };

  const {
    preloadedPokemon = {},
    preloadedGenToNames = {},
    preloadComplete = false,
  } = preloadInfo || {};

  const onStart = (selectedGenerationIds) => {
    const homeSettings = settings;
    // Get the subset of relevant Pokemon data for selected gens and Pokemon number.
    let pokemonNamesForRelevantGens = [];
    for (const gid of selectedGenerationIds) {
      const names = preloadedGenToNames[gid] || [];
      for (const n of names) pokemonNamesForRelevantGens.push(n);
    }
    pokemonNamesForRelevantGens = shuffle(pokemonNamesForRelevantGens);
    if (practiceType === PRACTICE_TYPE.MULTIPLE_CHOICE) {
      navigate("/multiple-choice-practice", {
        state: {
          homeSettings,
          allPokemon: preloadedPokemon, // Data of only the relevant Pokemon
          numPokemonToGuess:
            numberOfPokemon > 0
              ? numberOfPokemon
              : pokemonNamesForRelevantGens.length, // Number of Pokemon that will be guessed
          pokemonNamesForRelevantGens, // All relevant Pokemon names
        },
      });
    } else if (practiceType === PRACTICE_TYPE.SHORT_ANSWER) {
      navigate("/short-answer-practice", {
        state: {
          homeSettings,
          allPokemon: preloadedPokemon, // Data of only the relevant Pokemon
          numPokemonToGuess:
            numberOfPokemon > 0
              ? numberOfPokemon
              : pokemonNamesForRelevantGens.length, // Number of Pokemon that will be guessed
          pokemonNamesForRelevantGens, // All relevant Pokemon names
        },
      });
    } else if (practiceType === PRACTICE_TYPE.ULTIMATE_TRAINING) {
      navigate("/ultimate-training-practice", {
        state: {
          homeSettings,
          allPokemon: preloadedPokemon, // Data of only the relevant Pokemon
          numPokemonToGuess:
            numberOfPokemon > 0
              ? numberOfPokemon
              : pokemonNamesForRelevantGens.length, // Number of Pokemon that will be guessed
          pokemonNamesForRelevantGens, // All relevant Pokemon names
        },
      });
    }
  };

  return (
    <Container className="justify-content-center">
      {/* Back button centered horizontally, placed above the practice options */}
      <Row className="justify-content-center mt-3">
        <Col xs={12} md={4} className="p-2 d-flex justify-content-center">
          <Button
            variant="secondary"
            onClick={() => setGameMode(GameModes.MENU)}
          >
            ← Back to Menu
          </Button>
        </Col>
      </Row>

      {/* Four-column layout: left small column (Settings), middle-left = generations, middle-right = practice options, right small spacer */}
      <Row className="justify-content-center mt-2 gx-2">
        {/* Left narrow column: Back + Settings */}
        <Col xs={12} md={2} className="p-2">
          <div className="mt-2">
            <Settings settings={settings} setSettings={setSettings} />
          </div>
        </Col>

        {/* Middle-left: Generations grid */}
        <Col xs={12} md={4} className="p-2">
          {loadingGens ? null : (
            <>
              <GenerationsGrid
                generationCount={generationCount}
                selectedGenerationIds={selectedGenerationIds}
                setSelectedGenerationIds={setSelectedGenerationIds}
                genIcons={preloadInfo.preloadedGenIcons || {}}
                preloadComplete={preloadComplete}
              />
              <Row className="justify-content-center mt-3">
                <Col xs={8} md={8} className="p-2">
                  <Button variant="light" onClick={handleSelectAll}>
                    {selectedGenerationIds.length === generationCount
                      ? "Select None"
                      : "Select All"}
                  </Button>
                </Col>
              </Row>
            </>
          )}
        </Col>

        {/* Middle-right: Practice options */}
        <Col
          xs={12}
          md={4}
          className="p-2 d-flex flex-column justify-content-center"
        >
          <div
            style={{
              fontWeight: "600",
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Practice type:
          </div>
          {/* Updated button layout: MC + SA side-by-side, Ultimate underneath */}
          <div className="w-100 d-flex flex-column align-items-center mb-3">
            <Row className="w-100 justify-content-center">
              <Col xs={12} lg={4} className="mb-2">
                <Button
                  className="w-100"
                  variant={
                    practiceType === PRACTICE_TYPE.MULTIPLE_CHOICE
                      ? "primary"
                      : "outline-secondary"
                  }
                  onClick={() => setPracticeType(PRACTICE_TYPE.MULTIPLE_CHOICE)}
                >
                  Multiple Choice
                </Button>
              </Col>
              <Col xs={12} lg={4} className="mb-2">
                <Button
                  className="w-100"
                  variant={
                    practiceType === PRACTICE_TYPE.SHORT_ANSWER
                      ? "primary"
                      : "outline-secondary"
                  }
                  onClick={() => setPracticeType(PRACTICE_TYPE.SHORT_ANSWER)}
                >
                  Short Answer
                </Button>
              </Col>
            </Row>
            <Row className="w-100 justify-content-center">
              <Col xs={12} lg={6}>
                <Button
                  className="w-100"
                  variant={
                    practiceType === PRACTICE_TYPE.ULTIMATE_TRAINING
                      ? "primary"
                      : "outline-secondary"
                  }
                  onClick={() =>
                    setPracticeType(PRACTICE_TYPE.ULTIMATE_TRAINING)
                  }
                >
                  Ultimate Training{" "}
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip>
                        <div className="App">
                          Personalized practice for fastest learning.
                        </div>
                      </Tooltip>
                    }
                  >
                    <i className="bi bi-info-circle-fill"></i>
                  </OverlayTrigger>
                </Button>
              </Col>
            </Row>
          </div>
          <div
            style={{
              fontWeight: "600",
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Number of Pokémon:
          </div>
          <div className="d-flex justify-content-center gap-2">
            <Button
              variant={numberOfPokemon === 10 ? "primary" : "outline-secondary"}
              onClick={() => setNumberOfPokemon(10)}
            >
              10
            </Button>
            <Button
              variant={numberOfPokemon === 30 ? "primary" : "outline-secondary"}
              onClick={() => setNumberOfPokemon(30)}
            >
              30
            </Button>
            <Button
              variant={numberOfPokemon === 0 ? "primary" : "outline-secondary"}
              onClick={() => setNumberOfPokemon(0)}
            >
              All
            </Button>
          </div>
        </Col>

        {/* Right narrow spacer column */}
        <Col xs={0} md={2} className="d-none d-md-block p-2" />
      </Row>

      {/* centered Start button */}
      <Row className="justify-content-center mt-3">
        <Col xs={6} md={4} lg={3} className="p-2 d-flex justify-content-center">
          <Button
            disabled={selectedGenerationIds.length === 0 || !preloadComplete}
            variant="success"
            onClick={() => onStart(selectedGenerationIds)}
            className="w-100"
          >
            Start{" "}
            {!preloadComplete ? <Spinner animation="border" size="sm" /> : ""}
          </Button>
        </Col>
      </Row>
    </Container>
  );
}
export default PracticePanel;
