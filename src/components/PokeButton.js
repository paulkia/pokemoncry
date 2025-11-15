import { OverlayTrigger, Tooltip, Button } from "react-bootstrap";

export const OUTLINE_TYPE = {
  NONE: 0,
  GREEN: 1,
  RED: 2,
};

const GREEN_BORDER_STYLE = "4px solid #28a745";
const RED_BORDER_STYLE = "4px solid #dc3545";

function PokeButton({ name, sprite, outlineType, onClick }) {
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
        style={outlineStyle} // added
      >
        <img
          src={sprite}
          alt={`${name} sprite`}
          style={{
            width: "50px",
            height: "50px",
            objectFit: "contain",
          }}
        />
      </Button>
    </OverlayTrigger>
  );
}

export default PokeButton;
