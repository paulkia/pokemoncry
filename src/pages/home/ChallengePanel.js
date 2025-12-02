import { useState } from "react";
import {
  ButtonGroup,
  ToggleButton,
  Col,
  Row,
  Spinner,
  OverlayTrigger,
  Tooltip,
  Button,
} from "react-bootstrap";
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
  const [pokeNum, setPokeNum] = useState(20);
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

    let pokemonNamesForRelevantGens = [];
    for (const gid of selectedGenerationIds) {
      const names = preloadedGenToNames[gid] || [];
      for (const n of names) pokemonNamesForRelevantGens.push(n);
    }
    pokemonNamesForRelevantGens = shuffle(pokemonNamesForRelevantGens).slice(
      0,
      pokeNum > 0 ? pokeNum : pokemonNamesForRelevantGens.length
    );
    navigate("/challenge", {
      state: {
        homeSettings: homeSettings,
        allPokemonData: preloadedPokemon, // Data of only the relevant Pokemon
        pokemonNamesForRelevantGens: pokemonNamesForRelevantGens, // All relevant Pokemon names
      },
    });
  };

  return (
    <div>
      <Row className="mb-3">
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
          <Settings
            style={{ marginTop: "-5rem" }}
            settings={settings}
            setSettings={setSettings}
          />
        </Col>
      </Row>
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
            <Col
              xs={6}
              md={4}
              lg={3}
              className="p-2 d-flex justify-content-center"
            >
              <Button variant="light" onClick={handleSelectAll}>
                {selectedGenerationIds.length === generationCount
                  ? "Select None"
                  : "Select All Generations"}
              </Button>
            </Col>
            <Col
              xs={6}
              md={4}
              lg={3}
              className="p-2 d-flex justify-content-center"
            >
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
                            ? "20 Pokemon"
                            : "All Pokemon from selected gens"}
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
                      checked={pokeNum === radio.value}
                      onChange={(e) =>
                        setPokeNum(Number(e.currentTarget.value))
                      }
                    >
                      {radio.name}
                    </ToggleButton>
                  </OverlayTrigger>
                ))}
              </ButtonGroup>
            </Col>
          </Row>
          <Row className="justify-content-center mt-3">
            <Col
              xs={6}
              md={4}
              lg={3}
              className="p-2 d-flex justify-content-center"
            >
              <Button
                disabled={
                  selectedGenerationIds.length === 0 || !preloadComplete
                }
                variant="success"
                onClick={() => onStart(selectedGenerationIds)}
              >
                Challenge{" "}
                {!preloadComplete ? (
                  <Spinner animation="border" size="sm" />
                ) : null}
              </Button>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
export default ChallengePanel;
