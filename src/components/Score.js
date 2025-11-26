function Score({ numPokemonToGuess, pokeNum, numerator, score }) {
  if (score > 0) {
    return <div>Score: {Math.round(score)} points</div>;
  }
  if (pokeNum < numPokemonToGuess) {
    return null;
  }
  return (
    <div className="mb-2 mt-4">{`Score: ${numerator} / ${numPokemonToGuess}`}</div>
  );
}
export default Score;
