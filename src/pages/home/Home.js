import { useState, useEffect } from "react";
import { Container, Col, Row, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import Pokedex from "pokedex-promise-v2";
import { GameModes, getRandomElement } from "../../library/util";
import PracticePanel from "./PracticePanel";
import ChallengePanel from "./ChallengePanel";

const P = new Pokedex();

function getAnimatedSprite(pokemonData) {
  return (
    pokemonData?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated
      ?.front_default ??
    pokemonData?.sprites?.other?.showdown?.front_default ??
    pokemonData?.sprites?.front_default ??
    null
  );
}

function getStaticSprite(pokemonData) {
  const v = pokemonData?.sprites?.versions;
  return (
    v?.["generation-i"]?.["yellow"]?.front_default ??
    v?.["generation-i"]?.["red-blue"]?.front_default ??
    v?.["generation-ii"]?.["crystal"]?.front_default ??
    v?.["generation-iii"]?.["emerald"]?.front_default ??
    v?.["generation-iv"]?.["platinum"]?.front_default ??
    v?.["generation-v"]?.["black-white"]?.front_default ??
    pokemonData?.sprites?.front_default ??
    null
  );
}

function getAnimatedShinySprite(pokemonData) {
  return (
    pokemonData?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated
      ?.front_shiny ??
    pokemonData?.sprites?.other?.showdown?.front_shiny ??
    pokemonData?.sprites?.front_shiny ??
    pokemonData?.sprites?.front_default ??
    null
  );
}

function getStaticShinySprite(pokemonData) {
  const v = pokemonData?.sprites?.versions;
  return (
    v?.["generation-ii"]?.["crystal"]?.front_shiny ??
    v?.["generation-iii"]?.["emerald"]?.front_shiny ??
    v?.["generation-iv"]?.["platinum"]?.front_shiny ??
    v?.["generation-v"]?.["black-white"]?.front_shiny ??
    pokemonData?.sprites?.front_shiny ??
    null
  );
}

// Returns preloaded Pokemon data.
// - generationCount: number of generations to load (1..8)
// Returns:
// - map: { name -> {legacyCry, latestCry, sprite} }
// - allNames: [names]
// - byGen: { genId -> [names] } }
async function preloadPokemon(generationCount) {
  if (!generationCount || generationCount <= 0) return null;

  // Fetch generation resources to obtain species lists.
  const genIds = Array.from({ length: generationCount }, (_, i) => i + 1);
  const genUrls = genIds.map(
    (gen) => `https://pokeapi.co/api/v2/generation/${gen}`
  );
  const generationsFromPokedex = await P.getResource(genUrls);

  // Build per-gen species name lists and detail URLs
  const genToNames = {};
  const pokemonDetailUrls = [];
  for (const generation of generationsFromPokedex) {
    const gid = generation.id;
    genToNames[gid] = generation.pokemon_species.map((p) => p.name);
    pokemonDetailUrls.push(
      ...generation.pokemon_species.map((pokemon) =>
        pokemon.url.replace("pokemon-species", "pokemon")
      )
    );
  }

  // Fetch detailed pokemon resources (sprites, cries, etc.)
  const pokemonFromPokedex = await P.getResource(pokemonDetailUrls);
  const pokemonToData = {};
  const pokeNameToAllData = {};
  for (const pokemon of pokemonFromPokedex) {
    // NOTE: store only serializable data (spriteUrl string), not JSX
    pokemonToData[pokemon.species.name] = {
      legacyCry: pokemon.cries?.legacy ?? null,
      latestCry: pokemon.cries?.latest ?? null,
      sprite: getAnimatedSprite(pokemon),
      staticSprite: getStaticSprite(pokemon),
      shinySprite: getAnimatedShinySprite(pokemon),
      staticShinySprite: getStaticShinySprite(pokemon),
    };
    pokeNameToAllData[pokemon.species.name] = pokemon;
  }

  // Add random icons to generation buttons for decorative purposes.
  const genIcons = Object.fromEntries(
    genIds.map((gid) => {
      const names = genToNames[gid];
      const randomName = getRandomElement(names);
      const spriteUrl =
        pokeNameToAllData[randomName]?.sprites?.versions?.["generation-vii"]
          ?.icons?.front_default ??
        pokeNameToAllData[randomName]?.sprites?.front_default;
      return [gid, spriteUrl];
    })
  );

  return {
    pokemonToData: pokemonToData,
    genToNames: genToNames,
    genIcons: genIcons,
  };
}

// ***** MAIN MENU PANEL ***** //
function MainMenu() {
  // Game pages tracked here, such as menu or practice mode.
  const [gameMode, setGameMode] = useState(GameModes.MENU);
  // Number of pokemon generations.
  const [generationCount, setGenerationCount] = useState(0);
  // Loading state for generations.
  const [loadingGens, setLoadingGens] = useState(true);
  // Settings shared across pages.
  const [settings, setSettings] = useState({
    preferLegacyCries: true,
  });
  // Preloading state for pokemon data.
  const [preloadedPokemon, setPreloadedPokemon] = useState({}); // name -> {legacyCry, latestCry, sprite}
  const [preloadedGenToNames, setPreloadedGenToNames] = useState({}); // genId -> [names]
  const [preloadedGenIcons, setPreloadedGenIcons] = useState({}); // genId -> iconUrl
  const [preloadComplete, setPreloadComplete] = useState(false);

  // Source Pokemon generations.
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

  // Source all Pokemon.
  useEffect(() => {
    const isMounted = { current: true };
    const runPreload = async () => {
      if (!generationCount || generationCount <= 0) return;
      try {
        const result = await preloadPokemon(generationCount);
        if (!isMounted.current || !result) return;
        setPreloadedPokemon(result.pokemonToData);
        setPreloadedGenToNames(result.genToNames);
        setPreloadedGenIcons(result.genIcons);
        setPreloadComplete(true);
      } catch (err) {
        console.error("Preload failed", err);
      }
    };

    runPreload();
    return () => {
      isMounted.current = false;
    };
  }, [generationCount]);

  // PRACTICE two-column layout handled by PracticePanel
  if (gameMode === GameModes.PRACTICE) {
    return (
      <PracticePanel
        generationCount={generationCount}
        loadingGens={loadingGens}
        settings={settings}
        setSettings={setSettings}
        setGameMode={setGameMode}
        // pass preloaded pieces so PracticePanel can include them when navigating
        preloadInfo={{
          preloadedPokemon,
          preloadedGenToNames,
          preloadComplete,
          preloadedGenIcons,
        }}
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
        preloadInfo={{
          preloadedPokemon,
          preloadedGenToNames,
          preloadComplete,
          preloadedGenIcons,
        }}
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

function Home() {
  return (
    <div className="App p-5">
      <header>Ultimate Pokemon Cry Quiz!</header>
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
