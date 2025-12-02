import {
  Row,
  Col,
  Button,
  OverlayTrigger,
  Tooltip,
  Spinner,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";

function AppHeader({ disableLoginButton }) {
  const navigate = useNavigate();
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
        {disableLoginButton ? null : authLoading ? (
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
            <Button variant="light" onClick={() => navigate("/profile")}>
              <i className="bi bi-person" style={{ fontSize: "24px" }}></i>
            </Button>
          </OverlayTrigger>
        ) : authUser ? (
          <Button variant="light" onClick={() => navigate("/complete-profile")}>
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
            <Button variant="light" onClick={() => navigate("/login")}>
              <i className="bi bi-person-plus" style={{ fontSize: "24px" }}></i>
            </Button>
          </OverlayTrigger>
        )}
      </Col>
    </Row>
  );
}

export default AppHeader;
