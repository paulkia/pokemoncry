import { OverlayTrigger, Tooltip, Button } from "react-bootstrap";

export const OUTLINE_TYPE = {
  NONE: 0,
  GREEN: 1,
  RED: 2,
};

const GREEN_BORDER_STYLE = "4px solid #28a745";
const RED_BORDER_STYLE = "4px solid #dc3545";

function PokeButton({ name, sprite, outlineType, onClick, label = null }) {
  let outlineStyle = {};
  if (outlineType === OUTLINE_TYPE.GREEN) {
    outlineStyle = { border: GREEN_BORDER_STYLE };
  } else if (outlineType === OUTLINE_TYPE.RED) {
    outlineStyle = { border: RED_BORDER_STYLE };
  }
  let flair = "";
  if (sprite && sprite.includes("shiny")) {
    flair = "*";
  }
  return (
    <OverlayTrigger
      placement="top"
      overlay={
        <Tooltip>
          <div className="App">{`${name}${flair}`}</div>
        </Tooltip>
      }
      key={name}
    >
      <Button
        variant="light"
        className="me-1 mb-1"
        onClick={() => onClick(name)}
        style={{ position: "relative", ...outlineStyle }}
      >
        {/* Top-left badge */}
        <img
          src={sprite}
          alt={`${name} sprite`}
          style={{
            width: "75px",
            height: "75px",
            objectFit: "contain",
          }}
        />
        {label && (
          <span
            style={{
              position: "absolute",
              top: 4,
              left: 75,
              borderRadius: 8,
              padding: "2px 4px",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1,
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}
          >
            {label}
          </span>
        )}
      </Button>
    </OverlayTrigger>
  );
}

export default PokeButton;
