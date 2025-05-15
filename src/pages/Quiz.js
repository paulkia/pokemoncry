import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Pokedex from "pokedex-promise-v2";
import { Button, FormControl, Container, InputGroup } from "react-bootstrap";
const P = new Pokedex();

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap array[i] and array[j]
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getGenerationResourceStrings(generationCount) {
  return Array.from({ length: generationCount }, (_, index) => index + 1).map(
    (gen) => {
      return "https://pokeapi.co/api/v2/generation/" + gen;
    }
  );
}

function Quiz() {
  const [inputDisabled, setInputDisabled] = useState(true);
  const [input, setInput] = useState("");
  const [pokeNum, setPokeNum] = useState(0);
  const [relevantPokemon, setRelevantPokemon] = useState({});
  const [pokemonInGameOrder, setPokemonInGameOrder] = useState([]);
  const [pokeSet, setPokeSet] = useState(new Set());
  const [correct, setCorrect] = useState([]);
  const [incorrect, setIncorrect] = useState([]);
  const location = useLocation();
  const { selectedGenerationIds, generationCount } = location.state || {};

  useEffect(() => {
    P.getResource(getGenerationResourceStrings(generationCount))
      .then((response) => {
        let pokemonUrls = [];
        let pokemonNamesFromApi = new Set();
        for (const generation of response) {
          if (selectedGenerationIds.includes(generation.id)) {
            pokemonUrls.push(
              ...generation.pokemon_species.map((pokemon) => {
                return pokemon.url.replace("pokemon-species", "pokemon");
              })
            );
          }
          for (const pokemon of generation.pokemon_species) {
            pokemonNamesFromApi.add(pokemon.name);
          }
        }
        setPokeSet(pokemonNamesFromApi);
        return P.getResource(pokemonUrls);
      })
      .then((response) => {
        let pokemonListFromApi = {};
        for (const pokemon of response) {
          pokemonListFromApi[pokemon.species.name] = {
            cry: pokemon.cries.legacy,
            sprite:
              pokemon.sprites.versions["generation-v"]["black-white"].animated
                .front_default,
          };
        }
        let pokemonNamesFromMap = Array.from(Object.keys(pokemonListFromApi));
        shuffle(pokemonNamesFromMap);
        if (pokemonNamesFromMap.length > 0) {
          const firstPokemon = pokemonNamesFromMap[0];
          console.log(pokemonListFromApi[firstPokemon].name);
          new Audio(pokemonListFromApi[firstPokemon].cry).play();
        }
        setPokeNum(pokeNum + 1);
        setRelevantPokemon(pokemonListFromApi);
        setPokemonInGameOrder(pokemonNamesFromMap);
        setInputDisabled(false);
      })
      .catch((err) => {
        console.log("There was an ERROR: ", err);
      });
  }, []);

  const handleEnter = (e) => {
    if (e.key !== "Enter") {
      return;
    }
    e.preventDefault(); // prevent form submit or page reload
    if (!pokeSet.has(input)) {
      return;
    }
    const currPokemon = pokemonInGameOrder[pokeNum - 1];
    console.log("currpokemon", pokemonInGameOrder);
    if (input === currPokemon) {
      console.log("correct!");
      setCorrect((correct) => [...correct, input]);
    } else {
      console.log("incorrect!");
      setIncorrect((incorrect) => [...incorrect, currPokemon]);
    }
    if (pokemonInGameOrder.length > pokeNum) {
      const nextPokemon = pokemonInGameOrder[pokeNum];
      console.log(nextPokemon);
      new Audio(relevantPokemon[nextPokemon].cry).play();
      setPokeNum(pokeNum + 1);
    } else {
      setInputDisabled(true);
    }
    setInput(""); // clear the input
  };

  let correctPokes = [];
  for (const pokemon of correct) {
    console.log(pokemon);
    correctPokes.push(
      <img
        src={relevantPokemon[pokemon].sprite}
        alt={pokemon + "sprite"}
        style={{ width: "50px", height: "50px", objectFit: "contain" }}
      />
    );
  }

  let incorrectPokes = [];
  for (const pokemon of incorrect) {
    console.log(pokemon);
    incorrectPokes.push(
      <img
        src={relevantPokemon[pokemon].sprite}
        alt={pokemon + "sprite"}
        style={{ width: "50px", height: "50px", objectFit: "contain" }}
      />
    );
  }

  return (
    <div className="App p-5">
      <Container>
        <h4>Who's that Pokemon?</h4>
        <InputGroup>
          <FormControl
            type="text"
            placeholder="Enter Pokemon"
            disabled={inputDisabled}
            value={input}
            onChange={(e) => setInput(e.target.value.trim().toLowerCase())}
            onKeyDown={handleEnter}
          />
        </InputGroup>
      </Container>
      <br />
      <p>[ Correct ]</p>
      {correctPokes}
      <p>[ Incorrect ]</p>
      {incorrectPokes}
    </div>
  );
}

export default Quiz;
