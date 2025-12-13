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
import { useNavigate } from "react-router-dom";
import {
  ROUTER_UTIL,
  shuffle,
} from "../../library/util";
import { usePoke } from "../../AppContext";
// import { List } from "lucide-react";

const PRACTICE_TYPE = {
  MULTIPLE_CHOICE: 0, // Default
  SHORT_ANSWER: 1,
};

function GenerationsGrid({
  selectedGenerationIds = [],
  setSelectedGenerationIds,
}) {
  const { generationCount, preloadedGenIcons, pokeLoading } = usePoke();
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
                {pokeLoading ? null : (
                  <img
                    src={preloadedGenIcons[buttonId].icon || ""}
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

function PracticePanel() {
  const { generationCount, preloadedMon, preloadedGenToNames, pokeLoading } =
    usePoke();
  const navigate = useNavigate();
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([]);
  const [practiceType, setPracticeType] = useState(
    PRACTICE_TYPE.MULTIPLE_CHOICE
  );
  const [repeatMistakes, setRepeatMistakes] = useState(false);
  const [numberOfMon, setNumberOfMon] = useState(10);

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

  const onStart = (selectedGenerationIds) => {
    // Get the subset of relevant Mon data for selected gens and Mon number.
    let monNamesForRelevantGens = [];
    for (const gid of selectedGenerationIds) {
      const names = preloadedGenToNames[gid] || [];
      for (const n of names) monNamesForRelevantGens.push(n);
    }
    monNamesForRelevantGens = shuffle(monNamesForRelevantGens);
    switch (practiceType) {
      case PRACTICE_TYPE.SHORT_ANSWER:
        if (repeatMistakes) {
          navigate(ROUTER_UTIL.ULTIMATE_TRAINING_PRACTICE, {
            state: {
              allMon: preloadedMon, // Data of only the relevant Mon
              numMonToGuess:
                numberOfMon > 0 ? numberOfMon : monNamesForRelevantGens.length, // Number of Mon that will be guessed
              monNamesForRelevantGens: monNamesForRelevantGens, // All relevant Mon names
            },
          });
        } else {
          navigate(ROUTER_UTIL.SHORT_ANSWER_PRACTICE, {
            state: {
              allMon: preloadedMon, // Data of only the relevant Mon
              numMonToGuess:
                numberOfMon > 0 ? numberOfMon : monNamesForRelevantGens.length, // Number of Mon that will be guessed
              monNamesForRelevantGens: monNamesForRelevantGens, // All relevant Mon names
            },
          });
        }
        return;
      default:
        navigate(ROUTER_UTIL.MULTIPLE_CHOICE_PRACTICE, {
          state: {
            allMon: preloadedMon, // Data of only the relevant Mon
            numMonToGuess:
              numberOfMon > 0 ? numberOfMon : monNamesForRelevantGens.length, // Number of Mon that will be guessed
            monNamesForRelevantGens: monNamesForRelevantGens, // All relevant Mon names
          },
        });
        return;
    }
  };

  return (
    <span>
      {/* Four-column layout: left small column (Settings), middle-left = generations, middle-right = practice options, right small spacer */}
      <Form>
        <Row className="align-items-stretch justify-content-center mt-2 gx-2">
          {/* Middle-left: Generations grid */}
          <Col md={12} lg={4} className="m-2">
            {
              <Card className="cute-card flex-grow-1">
                <Card.Header>Generations</Card.Header>
                <Card.Body>
                  <GenerationsGrid
                    selectedGenerationIds={selectedGenerationIds}
                    setSelectedGenerationIds={setSelectedGenerationIds}
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
            }
          </Col>
          {/* Middle-right: Practice options */}
          <Col
            md={12}
            lg={4}
            className="d-flex flex-column justify-content-between m-2"
          >
            <Card className="mb-2 cute-card ">
              <Card.Header>Practice type:</Card.Header>
              <Card.Body>
                <div className="w-100 d-flex flex-column align-items-center">
                  <Row className="w-100 justify-content-center">
                    <ListGroup className="list-group-flush overflow-auto">
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
                          With Pictures <i className="bi bi-image"></i>
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
                          No Pictures{" "}
                          <i className="bi bi-input-cursor-text"></i>
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
                                        Personalized training for short-answer
                                        mode.
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
              </Card.Body>
            </Card>
            {/* Bottom card pinned to bottom, full height */}
            <Card className="mt-3 cute-card flex-grow-1">
              <Card.Header>Number of Mons:</Card.Header>
              <Card.Body className="d-flex flex-grow-1 align-items-center justify-content-center">
                <Button
                  className="m-1"
                  variant={numberOfMon === 10 ? "primary" : "outline-secondary"}
                  onClick={() => setNumberOfMon(10)}
                >
                  10 ⚡️
                </Button>
                <Button
                  className="m-1"
                  variant={numberOfMon === 20 ? "primary" : "outline-secondary"}
                  onClick={() => setNumberOfMon(20)}
                >
                  20 🔥
                </Button>
                <Button
                  className="m-1"
                  variant={numberOfMon === 0 ? "primary" : "outline-secondary"}
                  onClick={() => setNumberOfMon(0)}
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
            disabled={selectedGenerationIds.length === 0 || pokeLoading}
            variant="success"
            onClick={() => onStart(selectedGenerationIds)}
            className="w-100"
          >
            Practice{" "}
            {pokeLoading ? <Spinner animation="border" size="sm" /> : null}
          </Button>
        </Col>
      </Row>
    </span>
  );
}
export default PracticePanel;
