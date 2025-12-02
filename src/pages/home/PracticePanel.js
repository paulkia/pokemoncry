import { useState } from "react";
import {
  Col,
  Row,
  Spinner,
  Button,
  OverlayTrigger,
  Tooltip,
  FormCheck,
  Form,
  Card,
  ListGroup,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Settings from "../../components/Settings";
import { useNavigate } from "react-router-dom";
import { GameModes, shuffle } from "../../library/util";
// import { List } from "lucide-react";

const PRACTICE_TYPE = {
  MULTIPLE_CHOICE: 0, // Default
  SHORT_ANSWER: 1,
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
                      imageRendering: "pixelated",
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
  const [repeatMistakes, setRepeatMistakes] = useState(false);
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
    switch (practiceType) {
      case PRACTICE_TYPE.SHORT_ANSWER:
        if (repeatMistakes) {
          navigate("/ultimate-training-practice", {
            state: {
              homeSettings: homeSettings,
              allPokemon: preloadedPokemon, // Data of only the relevant Pokemon
              numPokemonToGuess:
                numberOfPokemon > 0
                  ? numberOfPokemon
                  : pokemonNamesForRelevantGens.length, // Number of Pokemon that will be guessed
              pokemonNamesForRelevantGens: pokemonNamesForRelevantGens, // All relevant Pokemon names
            },
          });
        } else {
          navigate("/short-answer-practice", {
            state: {
              homeSettings: homeSettings,
              allPokemon: preloadedPokemon, // Data of only the relevant Pokemon
              numPokemonToGuess:
                numberOfPokemon > 0
                  ? numberOfPokemon
                  : pokemonNamesForRelevantGens.length, // Number of Pokemon that will be guessed
              pokemonNamesForRelevantGens: pokemonNamesForRelevantGens, // All relevant Pokemon names
            },
          });
        }
        return;
      default:
        navigate("/multiple-choice-practice", {
          state: {
            homeSettings: homeSettings,
            allPokemon: preloadedPokemon, // Data of only the relevant Pokemon
            numPokemonToGuess:
              numberOfPokemon > 0
                ? numberOfPokemon
                : pokemonNamesForRelevantGens.length, // Number of Pokemon that will be guessed
            pokemonNamesForRelevantGens: pokemonNamesForRelevantGens, // All relevant Pokemon names
          },
        });
        return;
    }
  };

  return (
    <div>
      <Row className="justify-content-center mt-3">
        <Col></Col>
        <Col className="col-4 d-flex justify-content-center align-items-center">
          <Button
            variant="secondary"
            onClick={() => setGameMode(GameModes.MENU)}
          >
            ← Back to Menu
          </Button>
        </Col>
        <Col className="text-center">
          <Settings settings={settings} setSettings={setSettings} />
        </Col>
      </Row>
      {/* Four-column layout: left small column (Settings), middle-left = generations, middle-right = practice options, right small spacer */}
      <Form>
        <Row className="align-items-stretch justify-content-center mt-2 gx-2">
          {/* Middle-left: Generations grid */}
          <Col xs={12} md={4} className="m-2">
            {loadingGens ? null : (
              <Card>
                <Card.Body>
                  <GenerationsGrid
                    generationCount={generationCount}
                    selectedGenerationIds={selectedGenerationIds}
                    setSelectedGenerationIds={setSelectedGenerationIds}
                    genIcons={preloadInfo.preloadedGenIcons || {}}
                    preloadComplete={preloadComplete}
                  />
                </Card.Body>
                <Card.Footer className="justify-content-center d-flex">
                  <Button variant="outline-primary" onClick={handleSelectAll}>
                    {selectedGenerationIds.length === generationCount
                      ? "Select None"
                      : "Select All"}
                  </Button>
                </Card.Footer>
              </Card>
            )}
          </Col>
          {/* Middle-right: Practice options */}
          <Col
            xs={12}
            md={4}
            className="d-flex flex-column justify-content-between m-2"
          >
            <Card className="mb-2">
              <Card.Header>Practice type:</Card.Header>
              {/* Updated button layout: MC + SA side-by-side, Ultimate underneath */}
              <div className="w-100 d-flex flex-column align-items-center mb-3">
                <Row className="w-100 justify-content-center">
                  <ListGroup className="list-group-flush">
                    <ListGroup.Item>
                      <Button
                        className="w-100"
                        variant={
                          practiceType === PRACTICE_TYPE.MULTIPLE_CHOICE
                            ? "primary"
                            : "outline-secondary"
                        }
                        onClick={() =>
                          setPracticeType(PRACTICE_TYPE.MULTIPLE_CHOICE)
                        }
                      >
                        With Pictures 🐠
                      </Button>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <Button
                        className="w-100"
                        variant={
                          practiceType === PRACTICE_TYPE.SHORT_ANSWER
                            ? "primary"
                            : "outline-secondary"
                        }
                        onClick={() =>
                          setPracticeType(PRACTICE_TYPE.SHORT_ANSWER)
                        }
                      >
                        Typing Practice 🙈
                      </Button>
                      <Form.Group>
                        <FormCheck
                          id="repeat-mistakes-switch"
                          disabled={
                            practiceType === PRACTICE_TYPE.MULTIPLE_CHOICE
                          }
                          type="switch"
                          inline
                          className="mt-3 justify-content-center d-flex"
                          checked={
                            repeatMistakes &&
                            practiceType === PRACTICE_TYPE.SHORT_ANSWER
                          }
                          onChange={() => setRepeatMistakes(!repeatMistakes)}
                          label={
                            <span className="m-2">
                              <span>Repeat</span>{" "}
                              <span style={{ whiteSpace: "nowrap" }}>
                                Mistakes
                              </span>{" "}
                              <OverlayTrigger
                                placement="top"
                                overlay={
                                  <Tooltip>
                                    <div className="App">
                                      Personalized training for typing practice.
                                    </div>
                                  </Tooltip>
                                }
                              >
                                <i className="bi bi-info-circle-fill"></i>
                              </OverlayTrigger>
                            </span>
                          }
                        />
                      </Form.Group>
                    </ListGroup.Item>
                  </ListGroup>
                </Row>
              </div>
            </Card>
            {/* Bottom card pinned to bottom, full height */}
            <Card className="mt-3 height-100">
              <Card.Header>Number of Pokemon:</Card.Header>
              <Card.Body className="justify-content-center d-flex">
                <Button
                  className="m-1"
                  variant={
                    numberOfPokemon === 10 ? "primary" : "outline-secondary"
                  }
                  onClick={() => setNumberOfPokemon(10)}
                >
                  10 ⚡️
                </Button>
                <Button
                  className="m-1"
                  variant={
                    numberOfPokemon === 20 ? "primary" : "outline-secondary"
                  }
                  onClick={() => setNumberOfPokemon(20)}
                >
                  20 🔥
                </Button>
                <Button
                  className="m-1"
                  variant={
                    numberOfPokemon === 0 ? "primary" : "outline-secondary"
                  }
                  onClick={() => setNumberOfPokemon(0)}
                >
                  All 🌎
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Form>

      {/* centered Start button */}
      <Row className="justify-content-center mt-3">
        <Col xs={6} md={4} lg={3} className="p-2 d-flex justify-content-center">
          <Button
            disabled={selectedGenerationIds.length === 0 || !preloadComplete}
            variant="success"
            onClick={() => onStart(selectedGenerationIds)}
            className="w-100"
          >
            Practice{" "}
            {!preloadComplete ? <Spinner animation="border" size="sm" /> : null}
          </Button>
        </Col>
      </Row>
    </div>
  );
}
export default PracticePanel;
