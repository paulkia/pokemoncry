function Clock({ totalStartRef, totalClock }) {
  return (
    <span>
      {totalStartRef.current - Date.now() > 0 ? "00:00:00" : totalClock}
    </span>
  );
}
export default Clock;
