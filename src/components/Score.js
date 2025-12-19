function Score({ points, numerator = 0, denominator = 1 }) {
  if (points !== undefined) {
    return <div>Score: {Math.round(points)} points</div>;
  }
  return (
    <span>
      Score: {numerator} / {denominator}
    </span>
  );
}
export default Score;
