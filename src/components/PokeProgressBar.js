import { ProgressBar } from "react-bootstrap";

function PokeProgressBar({ className = "", completionPercent }) {
  const label =
    completionPercent === 100 ? `Done!` : `${Math.round(completionPercent)}%`;
  return (
    <div>
      <ProgressBar
        className={className}
        animated
        now={completionPercent}
        label={label}
      />
    </div>
  );
}

export default PokeProgressBar;
