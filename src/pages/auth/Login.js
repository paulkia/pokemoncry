import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useState, useEffect } from "react";
import { useAuth } from "../../components/AuthProvider";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import AppHeader from "../../components/AppHeader";
import GoogleIcon from "../../components/GoogleIcon";

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { authUser, authUsername } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (authUser !== null && authUsername !== null) {
      navigate("/profile");
    }
    if (authUser !== null && authUsername == null) {
      navigate("/complete-profile");
    }
  }, [authUsername, authUser, navigate, loading]);

  const handleGoogleSignIn = async (e) => {
    e?.preventDefault?.();
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      if (!auth.currentUser) {
        throw new Error("No user after sign-in");
      }
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data().username) {
        // Existing user with profile
        navigate("/");
      } else {
        await setDoc(
          userDocRef,
          {
            firebase_id: auth.currentUser.uid,
            username: null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        navigate("/complete-profile");
      }
    } catch (err) {
      console.error("Google sign-in failed", err);
      setError(err?.message || "Sign-in failed");
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
              <>
                <Card.Header className="bg-white border-0 pt-4 pb-0">
                  <h3 className="mb-1">Welcome</h3>
                  <div className="text-muted">Sign in to continue</div>
                </Card.Header>
                <Card.Body
                  className="p-4"
                  style={{ fontFamily: '"Roboto Mono", monospace' }}
                >
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
                  {error && (
                    <div className="alert alert-danger mt-3 mb-0" role="alert">
                      {error}
                    </div>
                  )}
                </Card.Body>
                <Card.Footer className="bg-white border-0 d-flex justify-content-end gap-2 p-4 pt-0">
                  <Button
                    variant="outline-secondary"
                    onClick={() => navigate("/")}
                  >
                    Cancel
                  </Button>
                </Card.Footer>
              </>
            </Card>
          </Col>
        </Row>
      </Container>
    </span>
  );
}

export default Login;
