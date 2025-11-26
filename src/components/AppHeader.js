import { Row, Col, Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import React from "react";

import { LOGIN_STATUS } from "../pages/Login";

function AppHeader({ disableLoginButton }) {
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = React.useState(false);
  return (
    <Row className="mb-4">
      <Col></Col>
      <Col>
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
      <Col>
        {
          disableLoginButton ? null : (
            // loginStatus === LOGIN_STATUS.LOGGED_IN ? (
            <Button variant="light" onClick={() => navigate("/login")}>
              <i className="bi bi-person" style={{ fontSize: "24px" }}></i>
            </Button>
          )
          // ) : loginStatus === LOGIN_STATUS.SIGNED_OUT ? (
          //   <OverlayTrigger
          //     placement="top"
          //     overlay={<Tooltip id="tooltip-legacy">Sign in</Tooltip>}
          //   >
          //     <Button variant="light" onClick={() => navigate("/login")}>
          //       <i className="bi bi-person-plus" style={{ fontSize: "24px" }}></i>
          //     </Button>
          //   </OverlayTrigger>
          // )
        }
      </Col>
    </Row>
  );
}

export default AppHeader;
