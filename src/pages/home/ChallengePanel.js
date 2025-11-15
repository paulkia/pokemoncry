import { useState } from "react";
import { Container, Col, Row, Spinner, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Settings from "../../components/Settings";
import { useNavigate } from "react-router-dom";
import { GameModes, shuffle } from "../../library/util";

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
            <Col key={buttonId} xs={2} className="p-2">
              <Button
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

function ChallengePanel({
  generationCount,
  loadingGens,
  settings,
  setSettings,
  setGameMode,
  preloadInfo,
}) {
  // challenge-local selection state (single-select or all)
  const navigate = useNavigate();
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([]);

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

    // Get the subset of relevant Pokemon data for selected gens.
    const subsetNames = new Set();
    for (const gid of selectedGenerationIds) {
      const names = preloadedGenToNames[gid] || [];
      for (const n of names) subsetNames.add(n);
    }
    const subsetMap = {};
    for (const [name, data] of Object.entries(preloadedPokemon)) {
      if (subsetNames.has(name)) subsetMap[name] = data;
    }

    navigate("/challenge", {
      state: {
        selectedGenerationIds,
        generationCount,
        homeSettings,
        relevantPokemon: subsetMap, // Data of only the relevant Pokemon
        allNames: Object.keys(preloadedPokemon), // All Pokemon names
      },
    });
  };

  return (
    <Container className="justify-content-center">
      <Row className="justify-content-center mt-3">
        <Col xs={10} className="p-2">
          <Button
            variant="secondary"
            onClick={() => setGameMode(GameModes.MENU)}
          >
            ← Back to Menu
          </Button>
        </Col>
      </Row>
      <Settings settings={settings} setSettings={setSettings} />
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
            <Col xs={6} md={4} lg={3} className="p-2">
              <Button variant="light" onClick={handleSelectAll}>
                {selectedGenerationIds.length === generationCount
                  ? "Select None"
                  : "Select All"}
              </Button>
            </Col>
          </Row>
          <Row className="justify-content-center mt-3">
            <Col xs={2} className="p-2">
              <Button
                disabled={
                  selectedGenerationIds.length === 0 || !preloadComplete
                }
                variant="success"
                onClick={() => onStart(selectedGenerationIds)}
              >
                Start{" "}
                {!preloadComplete ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  ""
                )}
              </Button>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}
export default ChallengePanel;
