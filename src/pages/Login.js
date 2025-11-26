import "../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { Container, Row, Col, Card, Button, Form } from "react-bootstrap";
import { useState } from "react";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import GoogleIcon from "../components/GoogleIcon";

export const LOGIN_STATUS = {
  EMPTY: 0,
  SIGNED_OUT: 1,
  LOGGED_IN: 2,
};

function Login() {
  const [step, setStep] = useState("signin"); // signin | username | done
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signinMethod, setSigninMethod] = useState("");

  const handleGoogleSignIn = async (e) => {
    e?.preventDefault?.();
    setError("");
    setLoading(true);
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const signedInUser = result.user;
      setUser(signedInUser);
      setDisplayName(signedInUser?.displayName || "");
      setSigninMethod("Google");
      setStep("username");
    } catch (err) {
      console.error("Google sign-in failed", err);
      setError(err?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
    } catch (_) {}
    setUser(null);
    setDisplayName("");
    setError("");
    setStep("signin");
  };

  const handleConfirm = async () => {
    setError("");
    const name = displayName.trim();
    if (name.length < 3 || name.length > 24 || !/^[a-zA-Z0-9_]+$/.test(name)) {
      setError(
        "Please choose a display name 3–24 chars, letters/numbers/underscore only."
      );
      return;
    }
    try {
      const auth = getAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
        const token = await auth.currentUser.getIdToken(true);
        localStorage.setItem("idToken", token);
        localStorage.setItem("displayName", name);
        const db = getFirestore();
        const userDoc = doc(db, "users", auth.currentUser.uid);
        console.log("here");
        await setDoc(
          userDoc,
          {
            firebase_id: auth.currentUser.uid,
            username: name,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        console.log("also here");
      }
      setStep("done");
    } catch (err) {
      console.error("Profile update/token retrieval failed", err);
      setError(err?.message || "Could not save your profile");
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
                <div className="text-muted">
                  {step === "signin" && "Sign in to continue"}
                  {step === "username" && "Choose a public display name"}
                  {step === "done" && "You're all set!"}
                </div>
              </Card.Header>
              <Card.Body className="p-4">
                {step === "signin" && (
                  <div className="d-grid gap-3">
                    <Button
                      variant="light"
                      disabled={loading}
                      onClick={handleGoogleSignIn}
                      className="border d-flex align-items-center justify-content-center gap-2 py-2"
                    >
                      <GoogleIcon />
                      {loading ? "Signing in..." : "Sign in with Google"}
                    </Button>
                  </div>
                )}

                {step === "username" && (
                  <Form onSubmit={(e) => e.preventDefault()}>
                    <div className="mb-3">
                      <div className="small text-muted mb-2">
                        Signed in through {signinMethod}
                      </div>
                      <Form.Label>Choose a display name</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="e.g. PokeMaster"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={24}
                        autoFocus
                      />
                      <Form.Text className="text-muted">
                        3–24 chars. Letters, numbers, underscore only.
                      </Form.Text>
                    </div>
                  </Form>
                )}

                {step === "done" && (
                  <div className="text-center">
                    <div className="mb-2">
                      Welcome, {displayName || user?.displayName}!
                    </div>
                    <div className="text-muted small">
                      You're signed in and ready to play.
                    </div>
                  </div>
                )}

                {error && (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    {error}
                  </div>
                )}
              </Card.Body>
              <Card.Footer className="bg-white border-0 d-flex justify-content-end gap-2 p-4 pt-0">
                {step === "signin" && (
                  <Button
                    variant="outline-secondary"
                    onClick={() => window.history.back()}
                  >
                    Cancel
                  </Button>
                )}
                {step === "username" && (
                  <>
                    <Button variant="outline-secondary" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleConfirm}>
                      Confirm
                    </Button>
                  </>
                )}
                {step === "done" && (
                  <Button
                    variant="primary"
                    onClick={() => (window.location.href = "/")}
                  >
                    Continue
                  </Button>
                )}
              </Card.Footer>
            </Card>
          </Col>
        </Row>
      </Container>
    </span>
  );
}

export default Login;
