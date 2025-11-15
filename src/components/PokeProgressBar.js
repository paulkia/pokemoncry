import { ProgressBar } from "react-bootstrap";

function PokeProgressBar({ completionPercent }) {
  const label =
    completionPercent === 100 ? `Done!` : `${Math.round(completionPercent)}%`;
  return (
    <div style={{ position: "relative", margin: "1rem" }}>
      <ProgressBar
        style={{ maxWidth: "400px", margin: "0 auto" }}
        animated
        now={completionPercent}
        label={label}
      />
    </div>
  );
}

export default PokeProgressBar;
