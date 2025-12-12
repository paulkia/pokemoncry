import Pokedex from "pokedex-promise-v2";
import axios from "axios";
import admin from "firebase-admin";
import * as fs from "fs/promises"; // For reading the file

// --- Configuration ---
// Use require() to safely load the JSON file
const SERVICE_ACCOUNT_PATH =
  "./guessthecry-firebase-adminsdk-fbsvc-da0829213a.json";
const BUCKET_NAME = "gs://guessthecry.firebasestorage.app";
let serviceAccount = null; // Variable to hold the parsed JSON object
const P = new Pokedex();
let bucket = null; // Variable to hold the storage bucket
// -------------------------------------

/**
 * Loads the Service Account JSON file.
 */
async function loadServiceAccount() {
  try {
    console.log(`Loading service account from: ${SERVICE_ACCOUNT_PATH}`);

    // Read the file content as a string
    const fileContent = await fs.readFile(SERVICE_ACCOUNT_PATH, "utf-8");

    // Parse the string content into a JSON object
    serviceAccount = JSON.parse(fileContent);

    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: BUCKET_NAME,
    });
    bucket = admin.storage().bucket();

    console.log("Firebase Admin SDK initialized successfully.");
  } catch (err) {
    console.error("Failed to load or initialize Firebase Admin SDK.");
    console.error(
      `Please ensure the file path is correct: ${SERVICE_ACCOUNT_PATH}`
    );
    throw err; // Stop execution if we can't authenticate
  }
}

/**
 * 1. Fetches all Pokemon cry URLs from PokeAPI.
 * @returns {Array<Object>} An array of objects: [{ name: 'pikachu', legacyCry: 'url', latestCry: 'url' }, ...]
 */
async function fetchCryUrls() {
  console.log("Fetching cry URLs from PokeAPI...");
  const generationResponse = await P.getResource([
    "https://pokeapi.co/api/v2/generation",
  ]);
  const generationCount = generationResponse[0].count;

  const genIds = Array.from({ length: generationCount }, (_, i) => i + 1);
  const genUrls = genIds.map(
    (gen) => `https://pokeapi.co/api/v2/generation/${gen}`
  );

  const generationsFromPokedex = await P.getResource(genUrls);

  const pokemonDetailUrls = [];
  for (const generation of generationsFromPokedex) {
    pokemonDetailUrls.push(
      ...generation.pokemon_species.map((pokemon) =>
        pokemon.url.replace("pokemon-species", "pokemon")
      )
    );
  }

  const pokemonFromPokedex = await P.getResource(pokemonDetailUrls);

  const cryData = [];
  for (const pokemon of pokemonFromPokedex) {
    cryData.push({
      name: pokemon.species.name,
      // Use nullish coalescing to safely get URLs, preventing errors if a cry is missing
      legacyCry: pokemon.cries?.legacy ?? null,
      latestCry: pokemon.cries?.latest ?? null,
    });
  }

  console.log(`Found ${cryData.length} unique Pokemon.`);
  return cryData;
}

/**
 * 2. Downloads the sound file from a URL and uploads it to Cloud Storage.
 * @param {string} url The public URL of the sound file.
 * @param {string} destinationPath The path to save the file in Cloud Storage (e.g., 'cries/pikachu-latest.ogg').
 */
async function downloadAndUploadCry(url, destinationPath) {
  if (!url) {
    // console.log(`Skipping missing cry for path: ${destinationPath}`);
    return;
  }

  try {
    // Axios request to download the file data as a Buffer
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const fileBuffer = Buffer.from(response.data);

    // Determine the MIME type based on the file extension (PokeAPI typically uses OGG or MP3)
    const fileExtension = url.split(".").pop().split("?")[0]; // Simple extension extraction
    let contentType = "audio/ogg"; // Default for PokeAPI
    if (fileExtension === "mp3") {
      contentType = "audio/mpeg";
    }

    // Upload the buffer to Cloud Storage
    if (bucket === null) {
      throw new Error("Firebase Storage bucket is not initialized.");
    }
    const file = bucket.file(destinationPath);
    await file.save(fileBuffer, {
      metadata: {
        contentType: contentType,
      },
      public: true, // Set to true if you want the files to be publicly accessible via URL
    });

    console.log(`✅ Uploaded: gs://${BUCKET_NAME}/${destinationPath}`);
  } catch (error) {
    console.error(
      `❌ Failed to process URL: ${url} at ${destinationPath}. Error: ${error.message}`
    );
  }
}

/**
 * Main function to orchestrate the process.
 */
async function main() {
  // 1. Load the service account and initialize Firebase first
  await loadServiceAccount();

  // 2. Continue with your existing logic
  const allCryUrls = await fetchCryUrls();

  // ... (The rest of your main function)
  const uploadPromises = [];
  let cryCounter = 0;

  for (const pokemon of allCryUrls) {
    // ... (existing loop content) ...
    const { name, legacyCry, latestCry } = pokemon;

    if (latestCry) {
      cryCounter++;
      const latestPath = `cries/${name}-latest.ogg`;
      uploadPromises.push(downloadAndUploadCry(latestCry, latestPath));
    }

    if (legacyCry) {
      cryCounter++;
      const legacyPath = `cries/${name}-legacy.ogg`;
      uploadPromises.push(downloadAndUploadCry(legacyCry, legacyPath));
    }
  }

  console.log(
    `\nAttempting to upload ${cryCounter} total cries... This may take a few minutes.`
  );
  await Promise.all(uploadPromises);

  console.log("\n✨ All cry uploads complete!");
}

main().catch(console.error);
