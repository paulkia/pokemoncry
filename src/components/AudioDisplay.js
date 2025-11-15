import { useEffect } from "react";
import { Button, Row, Col } from "react-bootstrap";
import { NEUTRAL_RESULT_COLOR } from "../library/util";

function AudioDisplay({
  buttonFn,
  canvasRef,
  audioRef,
  vizInitializedRef,
  showViz,
}) {
  // Pause and reset audio on unmount
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        try {
          a.pause();
        } catch (_) {}
        a.removeAttribute("src");
        a.load();
      }
    };
  }, []);

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

  let soundButtonPlacement = "col-2";
  if (!showViz) {
    soundButtonPlacement = "col-12 mt-1 mb-n20";
  }
  return (
    <Row className="align-items-center rounded ">
      <Col className={soundButtonPlacement}>
        <Button variant="outline-primary" onClick={buttonFn}>
          <i className="bi bi-play-fill"></i>
        </Button>
      </Col>
      <Col>
        {" "}
        <div
          style={{
            margin: "8px auto",
            position: "relative",
            width: "100%",
            height: "64px",
            zIndex: -1,
          }}
        >
          {" "}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "transparent",
            }}
          />{" "}
        </div>
      </Col>
    </Row>
  );
}

export default AudioDisplay;
