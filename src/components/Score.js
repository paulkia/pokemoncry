function Score({ numPokemonToGuess, pokeNum, numerator }) {
  if (pokeNum < numPokemonToGuess) {
    return null;
  }
  return (
    <div className="mb-2 mt-4">{`Score: ${numerator} / ${numPokemonToGuess}`}</div>
  );
}
export default Score;
