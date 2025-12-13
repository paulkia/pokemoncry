import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import Pokedex from "pokedex-promise-v2";
import {
  getAnimatedShinySprite,
  getAnimatedSprite,
  getStaticShinySprite,
  getStaticSprite,
  getRandomElement,
  LOCAL_STORAGE_UTIL,
  DEFAULT_SETTINGS,
} from "./library/util";

const P = new Pokedex();

const ICON_ROTATE_INTERVAL_MS = 1000;

// 1. Create the Context
const AuthContext = createContext({
  authUser: null,
  authUsername: null,
  authLoading: true, // Indicates if the initial Firebase check is complete
});

const PokeContext = createContext({
  generationCount: 0,
  preloadedMon: {}, // name -> {legacyCry, latestCry, sprite}
  preloadedGenToNames: {}, // genId -> [names]
  preloadedGenIcons: {}, // genId -> iconUrl
  gensLoading: true,
  pokeLoading: true,
});

const SettingsContext = createContext({
  settings: {
    preferLegacyCries: true,
    disableAnimations: false,
    show: false,
  },
  setSettings: () => {},
});

// 2. Custom hook for easy access
export const usePoke = () => {
  return useContext(PokeContext);
};
export const useAuth = () => {
  return useContext(AuthContext);
};

export const useSettings = () => {
  return useContext(SettingsContext);
};

// Returns preloaded Mon data.
// - generationCount: number of generations to load (1..8)
// Returns:
// - map: { name -> {legacyCry, latestCry, sprite} }
// - allNames: [names]
// - byGen: { genId -> [names] } }
async function preloadMon(generationCount) {
  if (!generationCount || generationCount <= 0) return null;

  // Fetch generation resources to obtain species lists.
  const genIds = Array.from({ length: generationCount }, (_, i) => i + 1);
  const genUrls = genIds.map(
    (gen) => `https://pokeapi.co/api/v2/generation/${gen}`
  );
  const generationsFromPokedex = await P.getResource(genUrls);

  // Build per-gen species name lists and detail URLs
  const genToNames = {};
  const monDetailUrls = [];
  for (const generation of generationsFromPokedex) {
    const gid = generation.id;
    genToNames[gid] = generation.pokemon_species.map((p) => p.name);
    monDetailUrls.push(
      ...generation.pokemon_species.map((mon) =>
        mon.url.replace("pokemon-species", "pokemon")
      )
    );
  }

  // Fetch detailed mon resources (sprites, cries, etc.)
  const monFromPokedex = await P.getResource(monDetailUrls);
  const monToData = {};
  const pokeNameToAllData = {};
  for (const mon of monFromPokedex) {
    monToData[mon.species.name] = {
      legacyCry: mon.cries?.legacy ?? null,
      latestCry: mon.cries?.latest ?? null,
      displaySprite: getAnimatedSprite(mon),
      staticDisplaySprite: getStaticSprite(mon),
      sprite: getAnimatedSprite(mon),
      staticSprite: getStaticSprite(mon),
      shinySprite: getAnimatedShinySprite(mon),
      staticShinySprite: getStaticShinySprite(mon),
    };
    pokeNameToAllData[mon.species.name] = mon;
  }

  // Add random icons to generation buttons for decorative purposes.
  const genIcons = Object.fromEntries(
    genIds.map((gid) => {
      const names = genToNames[gid];
      let spriteIcons = [];
      for (let name of names) {
        const spriteUrl =
          pokeNameToAllData[name]?.sprites?.versions?.["generation-vii"]?.icons
            ?.front_default ?? pokeNameToAllData[name]?.sprites?.front_default;
        spriteIcons.push(spriteUrl);
      }
      return [gid, spriteIcons];
    })
  );

  return {
    monToData: monToData,
    genToNames: genToNames,
    allIconsPerGen: genIcons,
  };
}

// 3. The Provider Component
export const AppProvider = ({ children }) => {
  // Mon data values.
  const [generationCount, setGenerationCount] = useState(0);
  const [preloadedMon, setPreloadedMon] = useState({}); // name -> {legacyCry, latestCry, sprite}
  const [preloadedGenToNames, setPreloadedGenToNames] = useState({}); // genId -> [names]
  const [preloadedGenIcons, setPreloadedGenIcons] = useState({}); // genId -> iconUrl
  const [allIconsPerGen, setAllIconsPerGen] = useState({});
  const [gensLoading, setGensLoading] = useState(true);
  const [pokeLoading, setPokeLoading] = useState(true);
  // Auth data values.
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Settings data values
  const [settings, setSettings] = useState(
    JSON.parse(localStorage.getItem(LOCAL_STORAGE_UTIL.SETTINGS)) ||
      DEFAULT_SETTINGS
  );

  // Source Mon gens.
  useEffect(() => {
    // Poke context
    P.getResource(["https://pokeapi.co/api/v2/generation"])
      .then((response) => {
        setGenerationCount(response[0].count);
        setGensLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch generations", err);
      });
  }, []);

  // Source all Mon.
  useEffect(() => {
    const isMounted = { current: true };
    let intervalId = 0;
    const runPreload = async () => {
      if (!generationCount || generationCount <= 0) return;
      try {
        const result = await preloadMon(generationCount);
        if (!isMounted.current || !result) {
          return;
        }
        setPreloadedMon(result.monToData);
        setPreloadedGenToNames(result.genToNames);
        setPokeLoading(false);
        setAllIconsPerGen(result.allIconsPerGen);

        const someIconPerGen = Object.fromEntries(
          Object.entries(result.allIconsPerGen).map(([genId, icons]) => {
            const randomName = getRandomElement(result.genToNames[genId]);
            return [
              genId,
              {
                icon: getRandomElement(icons),
                sprite: result.monToData[randomName].sprite,
                staticSprite: result.monToData[randomName].staticSprite,
              },
            ];
          })
        );
        setPreloadedGenIcons(someIconPerGen);
      } catch (err) {
        console.error("Preload failed", err);
      }
    };

    runPreload();
    return () => {
      isMounted.current = false;
      clearInterval(intervalId);
    };
  }, [generationCount]);

  // Rotate generation icons periodically.
  useEffect(() => {
    if (generationCount <= 0 || Object.keys(preloadedGenIcons).length === 0) {
      return;
    }
    const intervalId = setInterval(() => {
      const randomGenId = getRandomElement(Object.keys(preloadedGenIcons));
      const randomName = getRandomElement(preloadedGenToNames[randomGenId]);
      setPreloadedGenIcons({
        ...preloadedGenIcons,
        [randomGenId]: {
          icon: getRandomElement(allIconsPerGen[randomGenId]),
          sprite: preloadedMon[randomName].sprite,
          staticSprite: preloadedMon[randomName].staticSprite,
        },
      });
    }, ICON_ROTATE_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
    };
  }, [generationCount, preloadedGenIcons, allIconsPerGen]);

  // Auth data init.
  useEffect(() => {
    // Listen for auth changes; then for the user's profile doc in Firestore.
    let userDocUnsub = null;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      // Tear down any previous user doc listener
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        // Real-time listener for profile updates (e.g., username added later)
        userDocUnsub = onSnapshot(
          userDocRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setUsername(data?.username || null);
            } else {
              setUsername(null);
            }
            setAuthLoading(false); // We got initial profile state
          },
          (err) => {
            console.error("User doc snapshot error", err);
            setUsername(null);
          }
        );
      } else {
        signInAnonymously(auth)
          .then(() => {
            setAuthLoading(false);
          })
          .catch((err) => {
            console.error("Anonymous sign-in failed", err);
            setAuthLoading(false);
          });
      }
    });

    // Cleanup on unmount
    return () => {
      authUnsub();
      if (userDocUnsub) userDocUnsub();
    };
  }, []);

  const pokeInfo = {
    generationCount: generationCount,
    preloadedMon: preloadedMon,
    preloadedGenToNames: preloadedGenToNames,
    preloadedGenIcons: preloadedGenIcons,
    gensLoading: gensLoading,
    pokeLoading: pokeLoading,
  };

  const authInfo = {
    authUser: currentUser,
    authUsername: username,
    authLoading: authLoading,
    // Add other auth functions like signIn, signOut if needed
  };

  const settingsInfo = {
    settings,
    setSettings,
  };

  return (
    <AuthContext.Provider value={authInfo}>
      <SettingsContext.Provider value={settingsInfo}>
        <PokeContext.Provider value={pokeInfo}>{children}</PokeContext.Provider>
      </SettingsContext.Provider>
    </AuthContext.Provider>
  );
};

export default AppProvider;
