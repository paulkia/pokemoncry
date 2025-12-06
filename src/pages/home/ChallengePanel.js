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
  selectedGenerationIds = [],
  setSelectedGenerationIds,
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
                  selectedGenerationIds.includes(buttonId)
                    ? "primary"
                    : "outline-secondary"
                }
                className="w-100"
                onClick={() => setSelectedGenerationIds([buttonId])}
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
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([]);
  const { generationCount, gensLoading, pokeLoading } = usePoke();

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

  const onStart = () => {
    navigate(ROUTER_UTIL.CHALLENGE, {
      state: {
        numberOfMons,
        selectedGenerationIds,
      },
    });
  };

  return (
    <div className="App p-5">
      <AppHeader />
      <Row className="mb-3">
        <Col></Col>
        <Col className="col-4 d-flex justify-content-center align-items-center">
          <Button
            variant="secondary"
            onClick={() => navigate(ROUTER_UTIL.HOME)}
          >
            ← Back to Menu
          </Button>
        </Col>
        <Col className="text-center"></Col>
      </Row>
      <Row className="justify-content-center">
        <Col lg={7} md={12} sm={12}>
          <Card className="cute-card mt-3">
            <Card.Header>Challenge Type</Card.Header>
            <Card.Body>
              {gensLoading ? (
                <Spinner />
              ) : (
                <GenerationsGrid
                  selectedGenerationIds={selectedGenerationIds}
                  setSelectedGenerationIds={setSelectedGenerationIds}
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
                      {selectedGenerationIds.length === generationCount
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
            disabled={selectedGenerationIds.length === 0 || pokeLoading}
            variant="success"
            onClick={() => onStart()}
          >
            Challenge{" "}
            {pokeLoading ? <Spinner animation="border" size="sm" /> : null}
          </Button>
        </Col>
      </Row>
    </div>
  );
}
export default ChallengePanel;
