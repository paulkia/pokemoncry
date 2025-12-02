import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button, Spinner } from "react-bootstrap";
import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import AppHeader from "../../components/AppHeader";
import { useAuth } from "../../components/AuthProvider";
import { auth, db } from "../../firebase";

function Profile() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  const { authUser, authUsername } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (authUser === null) {
      navigate("/login");
    }
    if (authUsername == null) {
      navigate("/complete-profile");
    }
  }, [authUsername, authUser, navigate, signingOut, deletingAccount, loading]);

  const handleBackButton = () => {
    setLoading(true);
    navigate("/");
  };

  const handleSignOut = async () => {
    setError("");
    setSigningOut(true);
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed", err);
      setError(err?.message || "Sign-out failed");
    } finally {
      navigate("/");
    }
  };

  const handleDeleteAccount = async () => {
    setError("");
    setDeletingAccount(true);
    setLoading(true);

    const user = auth.currentUser;
    if (user) {
      // Remove user document from Firestore 'users' collection
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (firestoreErr) {
        console.warn("Could not delete Firestore user doc", firestoreErr);
        // Continue; we still attempt to delete the auth user
      }
      // Delete the Firebase Auth user account
      try {
        await user.delete();
      } catch (authErr) {
        // Deletion may fail if re-auth is required
        console.error("Firebase Auth user deletion failed", authErr);
      }
    } else {
      console.error("No authenticated user to delete");
    }
    navigate("/");
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
                {" "}
                <Card.Header className="bg-white border-0 pt-4 pb-0">
                  {authUsername !== null ? (
                    <h3 className="mb-1">{authUsername}</h3>
                  ) : (
                    <Spinner />
                  )}
                </Card.Header>
                <Card.Body className="p-4">
                  {error && (
                    <div className="alert alert-danger mt-3 mb-0" role="alert">
                      {error}
                    </div>
                  )}
                </Card.Body>
                <Card.Footer className="bg-white border-0 d-flex gap-2 p-4 pt-0">
                  <Button
                    variant="outline-secondary"
                    onClick={handleBackButton}
                  >
                    Back
                  </Button>
                  <Button
                    className="justify-content-end"
                    variant="outline-danger"
                    disabled={loading}
                    onClick={handleSignOut}
                  >
                    {signingOut ? "Signing out..." : "Sign out"}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={loading}
                    onClick={handleDeleteAccount}
                  >
                    {deletingAccount ? "Deleting..." : "Delete account"}
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

export default Profile;
