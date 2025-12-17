import { useEffect } from "react";
import { Button, Row, Col } from "react-bootstrap";

function AudioDisplay({ buttonFn, canvasRef, showViz }) {
  // Toggle between real viz canvas and placeholder canvas (flat line when no viz)
  useEffect(() => {
    const real = canvasRef.current;
    if (!real) return;
    if (showViz) {
      real.style.display = "block";
    } else {
      real.style.display = "none";
    }
  }, [showViz]);

  let colClass = "col-xs-1 col-sm-2";
  if (!showViz) {
    colClass =
      "col-12 mb-custom-for-audio-display justify-content-center d-flex";
  }
  return (
    <Row className="align-items-center rounded justify-content-center">
      <Col xs={2} className={colClass}>
        <Button
          variant="outline-primary"
          onClick={buttonFn}
          className="height-auto"
        >
          <i className="bi bi-play-fill"></i>
        </Button>
      </Col>
      <Col
        xs={10}
        sm={9}
        className="pr-3s"
        style={{
          zIndex: -1,
          position: "relative",
          height: "64px",
        }}
      >
        {"  "}
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
          }}
        />{" "}
      </Col>
    </Row>
  );
}

export default AudioDisplay;
