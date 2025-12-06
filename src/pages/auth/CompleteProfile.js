import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Spinner,
} from "react-bootstrap";
import { useState, useEffect } from "react";
import { getAuth, signOut } from "firebase/auth";
import { ROUTER_UTIL } from "../../library/util";
import AppHeader from "../../components/AppHeader";
import { useAuth } from "../../AppContext";

import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const claimUsernameCallable = httpsCallable(functions, "claimUsername");

function CompleteProfile() {
  const navigate = useNavigate();
  const [someUsername, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (name.length < 3 || name.length > 12 || !/^[a-zA-Z0-9_]+$/.test(name)) {
      setError(
        "Please choose a display name 3–12 chars, letters/numbers/underscore only."
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
    <span>
      <div className="App p-5">
        <AppHeader disableLoginButton={true} />
      </div>
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
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white border-0 pt-4 pb-0">
                <h3 className="mb-1">Welcome</h3>
              </Card.Header>
              <Card.Body style={{ fontFamily: '"Roboto Mono", monospace' }}>
                <Form onSubmit={(e) => e.preventDefault()}>
                  <div className="mb-3">
                    <Form.Label>Choose a display name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="e.g. PokeMaster"
                      onChange={(e) => setUsername(e.target.value)}
                      maxLength={12}
                      autoFocus
                    />
                    <Form.Text className="text-muted">
                      3-12 chars. Letters, numbers, underscore only.
                    </Form.Text>
                  </div>
                </Form>
                {error && (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    {error}
                  </div>
                )}
              </Card.Body>
              <Card.Footer className="bg-white border-0 d-flex justify-content-end gap-2 p-4 pt-0">
                <>
                  <Button variant="outline-secondary" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleConfirm}>
                    Create Account
                  </Button>
                </>
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </Container>
    </span>
  );
}

export default CompleteProfile;
