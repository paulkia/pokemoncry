import { Col, Row, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { ROUTER_UTIL } from "../../library/util";
import "bootstrap/dist/css/bootstrap.min.css";

import AppHeader from "../../components/AppHeader";

// ***** MAIN MENU PANEL ***** //
function MainMenu() {
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
          >
            Challenge <i class="bi bi-play-fill"></i>
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
          >
            Leaderboard <i class="bi bi-trophy-fill"></i>
          </Button>
        </Col>
      </Row>
    </div>
  );
}

function Home() {
  return (
    <div className="App p-5">
      <AppHeader />
      <MainMenu />
    </div>
  );
}

export default Home;
