import {
  Row,
  Col,
  Button,
  OverlayTrigger,
  Tooltip,
  Spinner,
} from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AppContext";
import { ROUTER_UTIL } from "../library/util";
import Settings from "./Settings";

const backRoutes = {
  [ROUTER_UTIL.MULTIPLE_CHOICE_PRACTICE]: ROUTER_UTIL.PRACTICE_MENU,
  [ROUTER_UTIL.SHORT_ANSWER_PRACTICE]: ROUTER_UTIL.PRACTICE_MENU,
  [ROUTER_UTIL.ULTIMATE_TRAINING_PRACTICE]: ROUTER_UTIL.PRACTICE_MENU,
  [ROUTER_UTIL.PRACTICE_MENU]: ROUTER_UTIL.HOME,
  [ROUTER_UTIL.CHALLENGE_MENU]: ROUTER_UTIL.HOME,
  [ROUTER_UTIL.CHALLENGE]: ROUTER_UTIL.CHALLENGE_MENU,
  [ROUTER_UTIL.LEADERBOARD]: ROUTER_UTIL.HOME,
};

function AppHeader({ disableLoginButton }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, authUsername, authLoading } = useAuth();
  return (
    <Row className="mb-4">
      <Col></Col>
      <Col style={{ textAlign: "center" }}>
        <header>Ultimate Guess the Cry!</header>
        <p>
          by [ Zechla{" "}
          <a
            href="https://www.youtube.com/@Zechla"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="bi bi-youtube"></i>
          </a>{" "}
          ]
        </p>
        <br />
      </Col>
      <Col className="text-center">
        {disableLoginButton ? null : !authUser || authLoading ? (
          <Spinner />
        ) : authUsername ? (
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                <div className="App">{authUsername}</div>
              </Tooltip>
            }
          >
            <Button
              variant="light"
              onClick={() => navigate(ROUTER_UTIL.PROFILE)}
            >
              <i className="bi bi-person" style={{ fontSize: "24px" }}></i>
            </Button>
          </OverlayTrigger>
        ) : !authUser?.isAnonymous ? (
          <Button
            variant="light"
            onClick={() => navigate(ROUTER_UTIL.COMPLETE_PROFILE)}
          >
            <i className="bi bi-person" style={{ fontSize: "24px" }}></i>
          </Button>
        ) : (
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                {" "}
                <div className="App">Sign in</div>
              </Tooltip>
            }
          >
            <Button variant="light" onClick={() => navigate(ROUTER_UTIL.LOGIN)}>
              <i className="bi bi-person-plus" style={{ fontSize: "24px" }}></i>
            </Button>
          </OverlayTrigger>
        )}{" "}
        <Settings />
      </Col>
      {location.pathname !== ROUTER_UTIL.HOME && (
        <Row>
          <Col>
            <Button
              variant="secondary"
              onClick={() => navigate(backRoutes[location.pathname])}
            >
              ← Back
            </Button>
          </Col>
        </Row>
      )}
    </Row>
  );
}

export default AppHeader;
