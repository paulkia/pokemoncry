import React, { useState, useEffect } from "react";
import { Container, Col, Row, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Pokedex from "pokedex-promise-v2";
import { useNavigate } from "react-router-dom";

const P = new Pokedex();

function GenerationsGrid() {
  // Selected gens user wants to test cries against.
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([]);
  // Num pokemon generations. Retrieved from Pokedex. 9 in early 2025...
  const [generationCount, setGenerationCount] = useState(0);
  // Tracks whether we have retrieved number of Pokemon gens yet.
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    P.getResource(["https://pokeapi.co/api/v2/generation"])
      .then((response) => {
        console.log(response);
        setGenerationCount(response[0].count);
        setLoading(false);
      })
      .catch((err) => {
        console.log("There was an ERROR: ", err);
      });
  }, []);

  if (loading) {
    return <Container></Container>;
  }

  // Toggle selection of a button
  const handleButtonClick = (buttonId) => {
    setSelectedGenerationIds((prevSelectedGenerations) => {
      if (prevSelectedGenerations.includes(buttonId)) {
        // If the button is already selectedGenerations, deselect it
        return prevSelectedGenerations.filter((id) => id !== buttonId);
      } else {
        // Otherwise, select the button
        return [...prevSelectedGenerations, buttonId];
      }
    });
  };

  // Array containing generation numbers.
  const buttonNumbers = Array.from(
    { length: generationCount },
    (_, index) => index + 1
  );

  // Handle "Select" button click to select all
  const handleSelectAllClick = () => {
    if (selectedGenerationIds.length === generationCount) {
      setSelectedGenerationIds([]);
    } else {
      setSelectedGenerationIds(buttonNumbers); // Select all buttons
    }
  };

  // Handle "[ Start ]" button click
  const handleStart = () => {
    navigate("/quiz", { state: { selectedGenerationIds, generationCount } });
  };

  // Generate rows dynamically (3 buttons per row)
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
                onClick={() => handleButtonClick(buttonId)}
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

  return (
    <Container className="justify-content-center">
      {generateRows()}
      <Row className="justify-content-center mt-3">
        <Col xs={2} className="p-2">
          <Button
            variant="light"
            onClick={handleSelectAllClick}
            className="w-100"
          >
            {selectedGenerationIds.length === generationCount
              ? "[ Select None ]"
              : "[ Select All ]"}
          </Button>
        </Col>
        <Col xs={2} className="p-2">
          <Button
            disabled={selectedGenerationIds.length === 0}
            variant="success"
            onClick={handleStart}
          >
            [ Start ]
          </Button>
        </Col>
      </Row>
    </Container>
  );
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
      {GenerationsGrid()}
    </div>
  );
}

export default Home;
