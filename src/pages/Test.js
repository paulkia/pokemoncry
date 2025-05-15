import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Pokedex from "pokedex-promise-v2";
import { Button, FormControl, InputGroup } from "react-bootstrap";

const P = new Pokedex();

function Test() {
  const [loading, setLoading] = useState(true);
  const [pokemon, setPokemon] = useState("");
  const location = useLocation();

  const handlePokemon = () => {
    if (pokemon === "") {
      return;
    }
    P.getPokemonByName(pokemon)
      .then((response) => {
        const sound = new Audio(response.cries.legacy);
        sound.play();
      })
      .catch((err) => {
        console.log("There was an ERROR: ", err);
      });
  };

  return (
    <InputGroup className="mb-3" style={{ maxWidth: "400px" }}>
      <FormControl
        placeholder="Enter Pokemon"
        value={pokemon}
        onChange={(e) => setPokemon(e.target.value)}
      />
      <Button variant="primary" onClick={handlePokemon}>
        Play Cry
      </Button>
    </InputGroup>
  );
}

export default Test;
