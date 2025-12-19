import { Col, Row, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { ROUTER_UTIL } from "../../library/util";
import BuyCoffeeButton from "../../components/BuyCoffeeButton";
import "bootstrap/dist/css/bootstrap.min.css";

export const genLoadingMessage = {
  0: "Loading Kanto...",
  1: "Loading Johto...",
  2: "Loading Hoenn...",
  3: "Loading Sinnoh...",
  4: "Loading Unova...",
  5: "Loading Kalos...",
  6: "Loading Alola...",
  7: "Loading Galar...",
  8: "Loading Paldea...",
};

// ***** MAIN MENU PANEL ***** //
function Home() {
  const navigate = useNavigate();

  // Default main menu
  return (
    <div className="">
      <Row className="mt-3 justify-content-center">
        <Col xl={4} md={12} className="text-center">
          <Button
            className="square-btn w-100 mb-3"
            variant="success"
            style={{
              minHeight: "100px",
              fontSize: "1.2rem",
              padding: "0.75rem 1rem",
            }}
            onClick={() => navigate(ROUTER_UTIL.PRACTICE_MENU)}
            onMouseOver={(e) =>
              (e.currentTarget.style.transform = "scale(1.1)")
            }
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            Practice +
          </Button>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col className="text-center" xl={4} md={12}>
          <Button
            className="square-btn w-100"
            variant="primary"
            style={{
              minHeight: "100px",
              fontSize: "1.2rem",
              padding: "0.75rem 1rem",
            }}
            onClick={() => navigate(ROUTER_UTIL.CHALLENGE_MENU)}
            onMouseOver={(e) =>
              (e.currentTarget.style.transform = "scale(1.1)")
            }
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            Challenge <i className="bi bi-play-fill"></i>
          </Button>
        </Col>
      </Row>
      <Row className="mt-3 justify-content-center">
        <Col xl={4} md={12} className="text-center">
          <Button
            className="square-btn w-100 mb-3"
            variant="info"
            style={{
              fontSize: "1.2rem",
              padding: "0.75rem 1rem",
            }}
            onClick={() => navigate(ROUTER_UTIL.LEADERBOARD)}
            onMouseOver={(e) =>
              (e.currentTarget.style.transform = "scale(1.1)")
            }
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            Leaderboard <i className="bi bi-trophy-fill"></i>
          </Button>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col xl={4} md={12} className="text-center">
          <BuyCoffeeButton className="w-100" />
        </Col>
      </Row>
    </div>
  );
}
export default Home;
