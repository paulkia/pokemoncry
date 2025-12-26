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
  [ROUTER_UTIL.PROFILE]: ROUTER_UTIL.HOME,
  [ROUTER_UTIL.LOGIN]: ROUTER_UTIL.HOME,
  [ROUTER_UTIL.COMPLETE_PROFILE]: ROUTER_UTIL.HOME,
  [ROUTER_UTIL.LEADERBOARD]: ROUTER_UTIL.HOME,
  [ROUTER_UTIL.PRIVACY_POLICY]: ROUTER_UTIL.HOME,
  [ROUTER_UTIL.TOS]: ROUTER_UTIL.HOME,
};

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, authUsername, authLoading } = useAuth();

  const authMissingData = !authUser || authLoading;

  const getBackRoute = () => {
    const path = location.pathname;
    // For incomplete profiles, assume TOS was reached from profile completion page.
    if (
      !authMissingData &&
      !authUsername &&
      !authUser.isAnonymous &&
      path === ROUTER_UTIL.TOS
    ) {
      return ROUTER_UTIL.COMPLETE_PROFILE;
    }
    return backRoutes[path];
  };

  const profileButton = () => {
    if (authMissingData) return <Spinner />;
    if (authUsername)
      return (
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip>
              <div className="App">{authUsername}</div>
            </Tooltip>
          }
        >
          <Button variant="light" onClick={() => navigate(ROUTER_UTIL.PROFILE)}>
            <i className="bi bi-person" style={{ fontSize: "24px" }}></i>
          </Button>
        </OverlayTrigger>
      );
    if (!authUser?.isAnonymous)
      return (
        <Button
          variant="light"
          onClick={() => navigate(ROUTER_UTIL.COMPLETE_PROFILE)}
        >
          <i className="bi bi-person" style={{ fontSize: "24px" }}></i>
        </Button>
      );
    return (
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
    );
  };

  return (
    <span>
      <Row className="mb-4">
        <Col sm={4} xs={12} className="text-center mb-4">
          {![
            ROUTER_UTIL.HOME,
            ROUTER_UTIL.COMPLETE_PROFILE,
            ROUTER_UTIL.REFRESHER,
          ].includes(location.pathname) && (
            <Button
              variant="secondary"
              onClick={() => navigate(getBackRoute())}
            >
              ← Back
            </Button>
          )}
        </Col>
        <Col sm={4} xs={12} className="text-center">
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
        </Col>
        <Col sm={4} xs={12} className="text-center">
          {![
            ROUTER_UTIL.LOGIN,
            ROUTER_UTIL.COMPLETE_PROFILE,
            ROUTER_UTIL.PROFILE,
          ].includes(location.pathname) && profileButton()}{" "}
          <Settings />
        </Col>
      </Row>
    </span>
  );
}

export default AppHeader;
