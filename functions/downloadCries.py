"""
Downloads all Pokémon cry audio files from PokeAPI to local machine.
This script mirrors the functionality of uploadCries.js but saves files locally
instead of uploading to Firebase Storage.
"""

import asyncio
import aiohttp
import os
from pathlib import Path
from typing import List, Dict, Optional

# --- Configuration ---
OUTPUT_DIR = "./cries"  # Directory where cries will be saved
# ---------------------


async def fetch_cry_urls(session: aiohttp.ClientSession) -> List[Dict[str, Optional[str]]]:
    """
    Fetches all Pokemon cry URLs from PokeAPI.
    
    Returns:
        List of dictionaries containing: [{ 'name': 'pikachu', 'legacyCry': 'url', 'latestCry': 'url' }, ...]
    """
    print("Fetching cry URLs from PokeAPI...")
    
    # Get the number of generations
    async with session.get("https://pokeapi.co/api/v2/generation") as response:
        generation_data = await response.json()
        generation_count = generation_data['count']
    
    # Fetch all generations
    gen_urls = [f"https://pokeapi.co/api/v2/generation/{i}" for i in range(1, generation_count + 1)]
    
    # Fetch all generation data concurrently
    generation_tasks = [fetch_json(session, url) for url in gen_urls]
    generations = await asyncio.gather(*generation_tasks)
    
    # Extract Pokemon URLs
    pokemon_detail_urls = []
    for generation in generations:
        for pokemon_species in generation['pokemon_species']:
            # Convert pokemon-species URL to pokemon URL
            pokemon_url = pokemon_species['url'].replace('pokemon-species', 'pokemon')
            pokemon_detail_urls.append(pokemon_url)
    
    print(f"Fetching details for {len(pokemon_detail_urls)} Pokémon...")
    
    # Fetch all Pokemon details concurrently (in batches to avoid overwhelming the API)
    batch_size = 100
    all_pokemon = []
    
    for i in range(0, len(pokemon_detail_urls), batch_size):
        batch = pokemon_detail_urls[i:i + batch_size]
        pokemon_tasks = [fetch_json(session, url) for url in batch]
        batch_results = await asyncio.gather(*pokemon_tasks)
        all_pokemon.extend(batch_results)
        print(f"  Fetched {min(i + batch_size, len(pokemon_detail_urls))}/{len(pokemon_detail_urls)} Pokémon details...")
    
    # Extract cry data
    cry_data = []
    for pokemon in all_pokemon:
        cry_data.append({
            'name': pokemon['species']['name'],
            'legacyCry': pokemon.get('cries', {}).get('legacy'),
            'latestCry': pokemon.get('cries', {}).get('latest'),
        })
    
    print(f"Found {len(cry_data)} unique Pokémon.")
    return cry_data


async def fetch_json(session: aiohttp.ClientSession, url: str) -> dict:
    """
    Fetches JSON data from a URL.
    
    Args:
        session: aiohttp session
        url: URL to fetch
        
    Returns:
        Parsed JSON data
    """
    async with session.get(url) as response:
        return await response.json()


async def download_cry(session: aiohttp.ClientSession, url: str, destination_path: str) -> None:
    """
    Downloads a sound file from a URL and saves it to the local filesystem.
    
    Args:
        session: aiohttp session
        url: The public URL of the sound file
        destination_path: The local path to save the file (e.g., 'cries/pikachu-latest.ogg')
    """
    if not url:
        return
    
    try:
        async with session.get(url) as response:
            if response.status == 200:
                file_data = await response.read()
                
                # Ensure the directory exists
                os.makedirs(os.path.dirname(destination_path), exist_ok=True)
                
                # Write the file
                with open(destination_path, 'wb') as f:
                    f.write(file_data)
                
                print(f"✅ Downloaded: {destination_path}")
            else:
                print(f"❌ Failed to download {url}: HTTP {response.status}")
    except Exception as error:
        print(f"❌ Failed to process URL: {url} at {destination_path}. Error: {error}")


async def main():
    """
    Main function to orchestrate the download process.
    """
    # Create output directory if it doesn't exist
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}\n")
    
    # Create a single aiohttp session for all requests
    async with aiohttp.ClientSession() as session:
        # Fetch all cry URLs
        all_cry_urls = await fetch_cry_urls(session)
        
        # Prepare download tasks
        download_tasks = []
        cry_counter = 0
        
        for pokemon in all_cry_urls:
            name = pokemon['name']
            latest_cry = pokemon['latestCry']
            legacy_cry = pokemon['legacyCry']
            
            if latest_cry:
                cry_counter += 1
                latest_path = os.path.join(OUTPUT_DIR, f"{name}-latest.ogg")
                download_tasks.append(download_cry(session, latest_cry, latest_path))
            
            if legacy_cry:
                cry_counter += 1
                legacy_path = os.path.join(OUTPUT_DIR, f"{name}-legacy.ogg")
                download_tasks.append(download_cry(session, legacy_cry, legacy_path))
        
        print(f"\nAttempting to download {cry_counter} total cries... This may take a few minutes.\n")
        
        # Download all cries concurrently
        await asyncio.gather(*download_tasks)
        
        print("\n✨ All cry downloads complete!")
        print(f"Files saved to: {os.path.abspath(OUTPUT_DIR)}")


if __name__ == "__main__":
    asyncio.run(main())
