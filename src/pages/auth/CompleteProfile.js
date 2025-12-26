import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";

import { useNavigate, Link } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Spinner,
  ListGroup,
} from "react-bootstrap";
import { useState, useEffect } from "react";
import { getAuth, signOut } from "firebase/auth";
import { ROUTER_UTIL } from "../../library/util";
import { useAuth } from "../../AppContext";

import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const claimUsernameCallable = httpsCallable(functions, "claimUsername");

function CompleteProfile() {
  const navigate = useNavigate();
  const [someUsername, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const { authUser, authUsername, authLoading } = useAuth();

  useEffect(() => {
    if (loading || authLoading) {
      return;
    }
    if (authUsername) {
      navigate(ROUTER_UTIL.PROFILE);
    }
    if (!authUser || authUser.isAnonymous) {
      navigate(ROUTER_UTIL.LOGIN);
    }
  }, [authUser, authUsername, loading, authLoading, navigate]);

  const handleCancel = async () => {
    const auth = getAuth();
    setLoading(true);
    try {
      await signOut(auth);
      navigate(ROUTER_UTIL.HOME);
    } catch (err) {
      setLoading(false);
      console.error("Sign out failed during profile completion cancel", err);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    const name = someUsername.trim();
    if (name.length < 3 || name.length > 20 || !/^[a-zA-Z0-9_]+$/.test(name)) {
      setError(
        "Please choose a display name 3–20 chars, letters/numbers/underscore only."
      );
      return;
    }
    try {
      setLoading(true);
      await claimUsernameCallable({ username: name });
      navigate(ROUTER_UTIL.HOME);
    } catch (err) {
      console.error("Profile update/token retrieval failed", err);
      setError(err?.message || "Could not save your profile");
      setLoading(false);
    }
  };

  return authLoading || authUsername || authUser?.isAnonymous ? (
    <Spinner />
  ) : (
    <Container
      className="d-flex align-items-center justify-content-center py-5"
      style={{
        maxWidth: "100%",
        fontFamily: '"Roboto Mono", monospace',
        fontOpticalSizing: "auto",
        fontWeight: 600,
        fontStyle: "normal",
      }}
    >
      <Row className="w-100" style={{ maxWidth: 480 }}>
        <Col>
          <Card className="shadow-sm border-0 cute-card">
            <Card.Header className="bg-white border-0 pt-3">
              <h3 className="mb-1">Complete Profile</h3>
            </Card.Header>
            <Card.Body style={{ fontFamily: '"Roboto Mono", monospace' }}>
              <Form onSubmit={(e) => e.preventDefault()}>
                <div className="mb-3">
                  <Form.Label>Choose a display name</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. poke_master"
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, "")
                      )
                    }
                    value={someUsername}
                    maxLength={20}
                    autoFocus
                  />
                  <Form.Text className="text-muted">
                    3-20 chars. Letters, numbers, underscore only. WARNING:
                    usernames are PUBLIC to other players.
                  </Form.Text>
                </div>
              </Form>
              {error && (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {error}
                </div>
              )}
              <ListGroup.Item>
                <Form.Check
                  type="checkbox"
                  label={
                    <span>
                      I agree to the{" "}
                      {<Link to={ROUTER_UTIL.TOS}>Terms and Conditions</Link>}.
                    </span>
                  }
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                  }}
                />
              </ListGroup.Item>
            </Card.Body>
            <Card.Footer className="bg-white border-0 d-flex justify-content-end gap-2">
              <>
                <Button
                  variant="outline-secondary"
                  disabled={loading}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={loading || !agreed || someUsername.length < 3}
                  onClick={handleConfirm}
                >
                  Create Account
                </Button>
              </>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default CompleteProfile;
