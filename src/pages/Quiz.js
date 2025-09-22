import "../App.css";
import Settings from "./Settings";
import "bootstrap/dist/css/bootstrap.min.css";
import React, { useState, useReducer, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Pokedex from "pokedex-promise-v2";
import {
  FormControl,
  Modal,
  OverlayTrigger,
  Tooltip,
  ProgressBar,
  Button,
  Form,
  InputGroup,
} from "react-bootstrap";
import { Trie } from "../library/trie";
import { shuffle } from "../library/util";

export const ACTION_TYPES = {
  INITIAL_SETUP: "INITIAL_SETUP",
  UPDATE_INPUT: "UPDATE_INPUT",
  NEXT_POKEMON: "NEXT_POKEMON",
  ADD_CORRECT: "ADD_CORRECT",
  ADD_INCORRECT: "ADD_INCORRECT",
  DISABLE_INPUT: "DISABLE_INPUT",
};

const P = new Pokedex();

const initialState = {
  // User input.
  input: "",
  // Whether input should be disabled. True when loading, or after game completion.
  inputDisabled: true,
  // All relevant pokemon data. Maps from pokemon name to cries, sprites, etc.
  relevantPokemon: {},
  // List of pokemon the user will guess.
  pokemonInGameOrder: [],
  // Index of pokemon the user is currently guessing.
  pokeNum: 0,
  // Set of relevant pokemon names. Time complexity optimization.
  pokeTrie: new Trie(),
  // List of correctly guessed pokemon.
  correct: [],
  // List of incorrectly guessed pokemon.
  incorrect: [],
};

function quizReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.INITIAL_SETUP:
      state.pokeTrie.insert(action.allPokemonNames);
      return {
        ...state,
        inputDisabled: false,
        relevantPokemon: action.relevantPokemon,
        pokemonInGameOrder: action.pokemonInGameOrder,
        pokeNum: 1,
      };
    case ACTION_TYPES.UPDATE_INPUT:
      return { ...state, input: action.input };
    case ACTION_TYPES.NEXT_POKEMON:
      return { ...state, pokeNum: state.pokeNum + 1, input: "" };
    case ACTION_TYPES.ADD_CORRECT:
      return { ...state, correct: [...state.correct, action.pokemon] };
    case ACTION_TYPES.ADD_INCORRECT:
      return { ...state, incorrect: [...state.incorrect, action.pokemon] };
    case ACTION_TYPES.DISABLE_INPUT:
      return { ...state, inputDisabled: true };
    case ACTION_TYPES.END_GAME:
      return {
        ...state,
        inputDisabled: true,
        pokeNum: state.pokeNum + 1,
        input: "",
      };
    default:
      return state;
  }
}

function Quiz() {
  const location = useLocation();
  const { selectedGenerationIds, generationCount, homeSettings } =
    location.state || {};
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const [settings, setSettings] = useState(homeSettings);

  const useLatestCries = settings.useLatestCries;
  useEffect(() => {
    const fetchPokemonData = async () => {
      // Gets all generations.
      const generationsFromPokedex = await P.getResource(
        Array.from({ length: generationCount }, (_, index) => index + 1).map(
          (gen) => {
            return "https://pokeapi.co/api/v2/generation/" + gen;
          }
        )
      );
      let pokemonUrls = [];
      let pokemonNamesFromApi = new Set();
      for (const generation of generationsFromPokedex) {
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
      const pokemonFromPokedex = await P.getResource(pokemonUrls);
      let pokemonListFromApi = {};
      for (const pokemon of pokemonFromPokedex) {
        const spriteUrl =
          pokemon.sprites.versions["generation-v"]["black-white"].animated
            .front_default !== null
            ? pokemon.sprites.versions["generation-v"]["black-white"].animated
                .front_default
            : pokemon.sprites.other.showdown.front_default !== null
            ? pokemon.sprites.other.showdown.front_default
            : pokemon.sprites.front_default;
        pokemonListFromApi[pokemon.species.name] = {
          legacyCry: pokemon.cries.legacy,
          latestCry: pokemon.cries.latest,
          sprite: (
            <img
              src={spriteUrl}
              alt={`${pokemon.species.name} sprite`}
              style={{ width: "50px", height: "50px", objectFit: "contain" }}
            />
          ),
        };
      }
      let pokemonNamesFromMap = Array.from(Object.keys(pokemonListFromApi));
      shuffle(pokemonNamesFromMap);
      if (pokemonNamesFromMap.length > 0) {
        const firstPokemon = pokemonNamesFromMap[0];
        if (
          !useLatestCries &&
          pokemonListFromApi[firstPokemon].legacyCry != null
        ) {
          new Audio(pokemonListFromApi[firstPokemon].legacyCry).play();
        } else {
          new Audio(pokemonListFromApi[firstPokemon].latestCry).play();
        }
      }
      dispatch({
        type: ACTION_TYPES.INITIAL_SETUP,
        relevantPokemon: pokemonListFromApi,
        allPokemonNames: pokemonNamesFromApi,
        pokemonInGameOrder: pokemonNamesFromMap,
        pokeNum: 1,
      });
    };
    fetchPokemonData();
  }, [selectedGenerationIds, generationCount]);

  useEffect(() => {
    const handleSpecialCommands = (e) => {
      if (state.inputDisabled || settings.show) {
        return;
      }
      switch (e.key) {
        case "1":
          // Replay the sound and do nothing else.
          const currPokemon = state.pokemonInGameOrder[state.pokeNum - 1];
          if (
            !settings.useLatestCries &&
            state.relevantPokemon[currPokemon].legacyCry != null
          ) {
            new Audio(state.relevantPokemon[currPokemon].legacyCry).play();
          } else {
            new Audio(state.relevantPokemon[currPokemon].latestCry).play();
          }
          return;
        default:
          return;
      }
    };
    window.addEventListener("keydown", handleSpecialCommands);

    // Clean up on unmount
    return () => {
      window.removeEventListener("keydown", handleSpecialCommands);
    };
  }, [state, settings]);

  const getSuggestionRemainder = () => {
    let trieResult = state.pokeTrie.getWord(state.input);
    if (trieResult.length > state.input.length) {
      return trieResult.substring(state.input.length);
    }
    return "";
  };

  const handleSpecialKey = (e) => {
    // Ignore non-special keys.
    if (e.key !== "Enter" && e.key !== "Tab") {
      return;
    }
    e.preventDefault(); // prevent form submit or page reload
    let input = `${state.input}${getSuggestionRemainder()}`;
    dispatch({
      type: ACTION_TYPES.UPDATE_INPUT,
      input: `${state.input}${getSuggestionRemainder()}`,
    });
    if (e.key !== "Enter" || !state.pokeTrie.words.has(input)) {
      return;
    }
    const currPokemon = state.pokemonInGameOrder[state.pokeNum - 1];
    if (input === currPokemon) {
      dispatch({ type: ACTION_TYPES.ADD_CORRECT, pokemon: currPokemon });
    } else {
      dispatch({ type: ACTION_TYPES.ADD_INCORRECT, pokemon: currPokemon });
    }
    if (state.pokemonInGameOrder.length > state.pokeNum) {
      dispatch({ type: ACTION_TYPES.NEXT_POKEMON });
      setTimeout(() => {
        const nextPokemon = state.pokemonInGameOrder[state.pokeNum];
        new Audio(state.relevantPokemon[nextPokemon].cry).play();
      }, 500);
    } else {
      dispatch({ type: ACTION_TYPES.END_GAME });
    }
  };

  return (
    <div className="App p-5">
      <h1>Who's that Pokemon?</h1>
      <p>Repeat the sound by pressing '1'.</p>
      {/* Container for relative positioning */}
      <div style={{ position: "relative", width: "25%", margin: "0 auto" }}>
        {/* Top-right icon */}
        <Settings settings={settings} setSettings={setSettings} />
        <ProgressBar
          animated
          now={
            (state.pokeNum / Math.max(1, state.pokemonInGameOrder.length)) * 100
          }
          label={
            (state.pokeNum - 1) / Math.max(1, state.pokemonInGameOrder.length) <
            0.15
              ? `${Math.round(
                  (state.pokeNum /
                    Math.max(1, state.pokemonInGameOrder.length)) *
                    100
                )}%`
              : state.pokeNum > Math.max(1, state.pokemonInGameOrder.length)
              ? `Done!`
              : `${state.pokeNum - 1}/${state.pokemonInGameOrder.length}`
          }
        />
        <br />
        <InputGroup>
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                <div className="App">
                  Use dashes instead of spaces. E.g. mime-jr
                </div>
              </Tooltip>
            }
          >
            <InputGroup.Text id="basic-addon1">?</InputGroup.Text>
          </OverlayTrigger>

          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "49px",
              transform: "translateY(-50%)",
              color: "gray",
              pointerEvents: "none",
              zIndex: 0,
              fontFamily: "inherit",
              fontSize: "1rem",
            }}
          >
            {state.input}
            <span style={{ opacity: 0.5 }}>{getSuggestionRemainder()}</span>
          </span>
          {/* The actual input, with a transparent background */}
          <FormControl
            type="text"
            // placeholder={state.pokemonInGameOrder[state.pokeNum - 1]}
            disabled={state.inputDisabled}
            value={state.input}
            style={{
              backgroundColor: "transparent",
              position: "relative",
              zIndex: 1,
            }}
            onChange={(e) =>
              dispatch({
                type: ACTION_TYPES.UPDATE_INPUT,
                input: e.target.value
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z-]/g, ""),
              })
            }
            onKeyDown={handleSpecialKey}
          />
        </InputGroup>
      </div>
      <br />
      <p>[Correct]</p>
      <p>{state.correct.map((name) => state.relevantPokemon[name].sprite)}</p>

      <p>[Incorrect]</p>
      <p>{state.incorrect.map((name) => state.relevantPokemon[name].sprite)}</p>
      {/* Have an invisible set of rendered images at the end. This pre-loads the gifs. */}
    </div>
  );
}

export default Quiz;
