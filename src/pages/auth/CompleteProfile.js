import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button, Form } from "react-bootstrap";
import { useState, useEffect } from "react";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import AppHeader from "../../components/AppHeader";
import { useAuth } from "../../components/AuthProvider";

import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const claimUsernameCallable = httpsCallable(functions, "claimUsername");

function CompleteProfile() {
  const navigate = useNavigate();
  const [someUsername, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { authUser, authUsername } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (authUsername) {
      navigate("/profile");
    }
    if (!authUser) {
      navigate("/login");
    }
  }, [authUser, authUsername, loading, navigate]);

  const handleCancel = async () => {
    const auth = getAuth();
    setLoading(true);
    try {
      await signOut(auth);
      navigate("/");
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
      await claimUsernameCallable({ username: name });
      navigate("/");
    } catch (err) {
      console.error("Profile update/token retrieval failed", err);
      setError(err?.message || "Could not save your profile");
      setLoading(false);
    }
  };

  return (
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
