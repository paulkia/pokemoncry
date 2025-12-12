import { useState } from "react";
import {
  ButtonGroup,
  ToggleButton,
  Col,
  Row,
  Spinner,
  OverlayTrigger,
  Tooltip,
  Card,
  Button,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Settings from "../../components/Settings";
import { useNavigate } from "react-router-dom";
import { ROUTER_UTIL, LOCAL_STORAGE_UTIL } from "../../library/util";
import { usePoke, useSettings } from "../../AppContext";
import AppHeader from "../../components/AppHeader";

function GenerationsGrid({
  selectedGenerationId = -1,
  setSelectedGenerationId,
}) {
  const { generationCount, preloadedGenIcons, pokeLoading } = usePoke();
  const { settings } = useSettings();
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
                key={`gen-btn-${buttonId}`}
                variant={
                  selectedGenerationId === buttonId ||
                  selectedGenerationId === 0
                    ? "primary"
                    : "outline-secondary"
                }
                className="w-100"
                onClick={() => setSelectedGenerationId(buttonId)}
              >
                Gen {buttonId}
                {<br />}
                {pokeLoading ? null : (
                  <img
                    src={
                      settings.disableAnimations
                        ? preloadedGenIcons[buttonId].staticSprite || ""
                        : preloadedGenIcons[buttonId].sprite || ""
                    }
                    alt={"↻"}
                    style={{
                      imageRendering: "pixelated",
                      width: "75px",
                      height: "75px",
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

function ChallengePanel() {
  // challenge-local selection state (single-select or all)
  const navigate = useNavigate();
  const [numberOfMons, setNumberOfMons] = useState(20);
  const [selectedGenerationId, setSelectedGenerationId] = useState(-1);
  const { gensLoading, pokeLoading } = usePoke();

  const handleSelectAll = () => {
    if (selectedGenerationId === 0) {
      setSelectedGenerationId(-1);
    } else {
      setSelectedGenerationId(0);
    }
  };

  const onStart = () => {
    navigate(ROUTER_UTIL.CHALLENGE, {
      state: {
        numberOfMons,
        selectedGenerationId,
      },
    });
  };

  return (
    <span>
      <Row className="justify-content-center">
        <Col lg={7} md={12} sm={12}>
          <Card className="cute-card mt-3">
            <Card.Header>Challenge Type</Card.Header>
            <Card.Body>
              {gensLoading ? (
                <Spinner />
              ) : (
                <GenerationsGrid
                  selectedGenerationId={selectedGenerationId}
                  setSelectedGenerationId={setSelectedGenerationId}
                />
              )}
            </Card.Body>
            <Card.Footer>
              <Row className="justify-content-center align-items-center">
                <Col className="d-flex justify-content-center">
                  {gensLoading ? (
                    <Spinner />
                  ) : (
                    <Button variant="outline-primary" onClick={handleSelectAll}>
                      {selectedGenerationId === 0
                        ? "Select None"
                        : "Select All Generations"}
                    </Button>
                  )}
                </Col>
                <Col className="d-flex justify-content-center">
                  <ButtonGroup>
                    {[
                      { name: "Fast ⚡️", value: 20 },
                      { name: "Full 🌍", value: 0 },
                    ].map((radio, idx) => (
                      <OverlayTrigger
                        key={`tooltip-${radio.name}`}
                        id={`tooltip-${radio.name}`}
                        placement="top"
                        overlay={
                          <Tooltip>
                            <div className="App">
                              {radio.value === 20
                                ? "20 mons"
                                : "All mons from selected gens"}
                            </div>
                          </Tooltip>
                        }
                      >
                        <ToggleButton
                          key={idx}
                          id={`radio-${idx}`}
                          type="radio"
                          variant={"outline-primary"}
                          name="radio"
                          value={radio.value}
                          checked={numberOfMons === radio.value}
                          onChange={(e) =>
                            setNumberOfMons(Number(e.currentTarget.value))
                          }
                        >
                          {radio.name}
                        </ToggleButton>
                      </OverlayTrigger>
                    ))}
                  </ButtonGroup>
                </Col>
              </Row>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
      <Row className="justify-content-center mt-3">
        <Col xs={6} md={4} lg={3} className="p-2 d-flex justify-content-center">
          <Button
            disabled={selectedGenerationId === -1 || pokeLoading}
            variant="success"
            onClick={() => onStart()}
          >
            Challenge{" "}
            {pokeLoading ? <Spinner animation="border" size="sm" /> : null}
          </Button>
        </Col>
      </Row>
    </span>
  );
}
export default ChallengePanel;
