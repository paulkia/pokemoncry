function Score({ numMonToGuess, pokeNum, numerator, score }) {
  if (score > 0) {
    return <div>Score: {Math.round(score)} points</div>;
  }
  if (pokeNum < numMonToGuess) {
    return null;
  }
  return (
    <div className="mb-2 mt-4">{`Score: ${numerator} / ${numMonToGuess}`}</div>
  );
}
export default Score;
