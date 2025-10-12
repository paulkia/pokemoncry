import React, { useState, useEffect } from "react";
import { Container, Col, Row, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Pokedex from "pokedex-promise-v2";
import Settings from "./Settings";
import { useNavigate } from "react-router-dom";
import { GameModes } from "../library/util";

const P = new Pokedex();

// Make GameModes global so we use constants everywhere instead of string literals
function MainMenu() {
  const [gameMode, setGameMode] = useState(GameModes.MENU);

  // Shared state moved to MainMenu so GenerationsGrid is only the grid component.
  const [generationCount, setGenerationCount] = useState(0);
  const [loadingGens, setLoadingGens] = useState(true);
  const [settings, setSettings] = useState({
    useLatestCries: false,
    fastMode: false,
  });

  useEffect(() => {
    P.getResource(["https://pokeapi.co/api/v2/generation"])
      .then((response) => {
        setGenerationCount(response[0].count);
        setLoadingGens(false);
      })
      .catch((err) => {
        console.log("There was an ERROR: ", err);
        setLoadingGens(false);
      });
  }, []);

  // PRACTICE two-column layout handled by PracticePanel
  if (gameMode === GameModes.PRACTICE) {
    return (
      <PracticePanel
        generationCount={generationCount}
        loadingGens={loadingGens}
        settings={settings}
        setSettings={setSettings}
        setGameMode={setGameMode}
      />
    );
  }

  // CHALLENGE flow handled by ChallengePanel
  if (gameMode === GameModes.CHALLENGE) {
    return (
      <ChallengePanel
        generationCount={generationCount}
        loadingGens={loadingGens}
        settings={settings}
        setSettings={setSettings}
        setGameMode={setGameMode}
      />
    );
  }

  // Default main menu
  return (
    <Container className="justify-content-center">
      <Row className="justify-content-center mt-3">
        <Col xs={3} className="p-2">
          <Button
            className="square-btn w-100"
            variant="success"
            style={{
              minHeight: "100px",
              fontSize: "1.2rem",
              padding: "0.75rem 1rem",
            }}
            onClick={() => setGameMode(GameModes.PRACTICE)}
          >
            Practice!
          </Button>
        </Col>
        <Col xs={3} className="p-2">
          <Button
            className="square-btn w-100"
            variant="primary"
            style={{
              minHeight: "100px",
              fontSize: "1.2rem",
              padding: "0.75rem 1rem",
            }}
            onClick={() => setGameMode(GameModes.CHALLENGE)}
          >
            Challenge!
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

// New: Practice two-column panel (keeps layout previously inline in MainMenu)
function PracticePanel({
  generationCount,
  loadingGens,
  settings,
  setSettings,
  setGameMode,
}) {
  // panel-local selection state (independent from ChallengePanel)
  const navigate = useNavigate();
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([]);
  const [practiceType, setPracticeType] = useState("multiple");
  const [numberOfPokemon, setNumberOfPokemon] = useState(10);

  const allButtonNumbers = Array.from(
    { length: generationCount },
    (_, i) => i + 1
  );

  const handleToggle = (id) => {
    setSelectedGenerationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedGenerationIds.length === generationCount) {
      setSelectedGenerationIds([]);
    } else {
      setSelectedGenerationIds(allButtonNumbers);
    }
  };

  const onStart = (selectedGenerationIds) => {
    const homeSettings = settings;
    navigate("/quiz", {
      state: {
        selectedGenerationIds,
        generationCount,
        homeSettings,
        practiceType, // MULTIPLE vs SHORT
        numberOfPokemon, // 10 | 30 | "all"
        mode: GameModes.PRACTICE,
      },
    });
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
                onToggle={handleToggle}
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
          className="p-2 d-flex flex-column justify-content-center align-items-center"
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
          <div className="d-flex justify-content-center gap-2 mb-3">
            <Button
              variant={
                practiceType === "multiple" ? "primary" : "outline-secondary"
              }
              onClick={() => setPracticeType("multiple")}
            >
              Multiple Choice
            </Button>
            <Button
              variant={
                practiceType === "short" ? "primary" : "outline-secondary"
              }
              onClick={() => setPracticeType("short")}
            >
              Short Answer
            </Button>
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
              variant={
                numberOfPokemon === "all" ? "primary" : "outline-secondary"
              }
              onClick={() => setNumberOfPokemon("all")}
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
            disabled={selectedGenerationIds.length === 0}
            variant="success"
            onClick={() => onStart(selectedGenerationIds)}
            className="w-100"
          >
            Start
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

// New: Challenge single-column panel
function ChallengePanel({
  generationCount,
  loadingGens,
  settings,
  setSettings,
  setGameMode,
}) {
  // challenge-local selection state (single-select or all)
  const navigate = useNavigate();
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([]);

  const allButtonNumbers = Array.from(
    { length: generationCount },
    (_, i) => i + 1
  );

  const handleToggle = (id) => {
    // single-select: pick only this id
    setSelectedGenerationIds([id]);
  };

  const handleSelectAll = () => {
    if (selectedGenerationIds.length === generationCount) {
      setSelectedGenerationIds([]);
    } else {
      setSelectedGenerationIds(allButtonNumbers);
    }
  };

  const onStart = (selectedGenerationIds) => {
    const homeSettings = settings;
    navigate("/quiz", {
      state: {
        selectedGenerationIds,
        generationCount,
        homeSettings,
        mode: GameModes.CHALLENGE,
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
            onToggle={handleToggle}
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
                disabled={selectedGenerationIds.length === 0}
                variant="success"
                onClick={() => onStart(selectedGenerationIds)}
              >
                Start
              </Button>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}

function GenerationsGrid({
  generationCount = 0,
  selectedGenerationIds = [],
  onToggle,
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
                onClick={() => onToggle(buttonId)}
              >
                Gen {buttonId}
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

function Home() {
  return (
    <div className="App p-5">
      <header>Ultimate Pokémon Cry Quiz!</header>
      <p>
        by [{" "}
        <a
          href="https://www.youtube.com/@Zechla"
          target="_blank"
          rel="noopener noreferrer"
        >
          Zechla
        </a>{" "}
        ]
      </p>
      <MainMenu />
    </div>
  );
}

export default Home;
