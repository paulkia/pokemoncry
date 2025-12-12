import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button, Spinner } from "react-bootstrap";
import { useState, useEffect } from "react";
import { useAuth } from "../../AppContext";
import {
  GoogleAuthProvider,
  signInWithCredential,
  linkWithPopup,
} from "firebase/auth";
import { auth, db, analytics } from "../../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import GoogleIcon from "../../components/GoogleIcon";
import { ROUTER_UTIL } from "../../library/util";

const updateLoginDoc = (firebaseId) => ({
  firebase_id: firebaseId,
  latestLoginTime: serverTimestamp(),
});

const newUserDoc = (firebaseId) => ({
  firebase_id: firebaseId,
  username: null,
  latestLoginTime: serverTimestamp(),
});

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { authUser, authUsername, authLoading } = useAuth();

  useEffect(() => {
    if (loading || authLoading) {
      return;
    }
    if (authUser && authUsername) {
      navigate(ROUTER_UTIL.PROFILE);
      return;
    }
    if (authUser && !authUser.isAnonymous && !authUsername) {
      navigate(ROUTER_UTIL.COMPLETE_PROFILE);
      return;
    }
  }, [loading, authLoading, authUser, authUsername, navigate]);

  const handleGoogleSignIn = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    const provider = new GoogleAuthProvider();
    // If user is anonymous, link accounts. Otherwise, sign in normally.
    if (!authUser || !authUser.isAnonymous) {
      setError("Sign in not possible at this time.");
      console.error(
        `Sign in status invalid. Should have auth user and be anonymous. Auth user: ${authUser}, isAnonymous: ${authUser?.isAnonymous}`
      );
      setLoading(false);
      return;
    }
    // For users that are not yet in the firebase system.
    linkWithPopup(authUser, provider)
      .then(() => {
        const firebaseId = authUser.uid;
        const userDocRef = doc(db, "users", firebaseId);
        setDoc(userDocRef, newUserDoc(firebaseId), { merge: true })
          .then(() => {
            analytics.logEvent("sign_up", { linkWithPopup });
            navigate(ROUTER_UTIL.COMPLETE_PROFILE);
          })
          .catch((err) => {
            setError(
              "Failed to create user profile in database, please try again later."
            );
            console.error("Creating userdoc profile failed", err);
            setLoading(false);
          });
      })
      .catch((linkError) => {
        if (linkError.code !== "auth/credential-already-in-use") {
          setError("Linking accounts failed, please try again later.");
          console.error("Linking accounts failed", linkError.code, linkError);
          setLoading(false);
          return;
        }
        // For users that already have an account with our firebase system, merge the accounts.
        const googleCredential =
          GoogleAuthProvider.credentialFromError(linkError);
        signInWithCredential(auth, googleCredential)
          .then((cred) => {
            const firebaseId = cred.user.uid;
            // If the user already has a profile with a username, log them in.
            const userDocRef = doc(db, "users", firebaseId);
            getDoc(userDocRef).then((userDoc) => {
              if (userDoc.exists() && userDoc.data().username) {
                // TODO: MERGE SCORE DATA.
                setDoc(userDocRef, updateLoginDoc(firebaseId), {
                  merge: true,
                })
                  .then(() => {
                    analytics.logEvent("login", { signInWithCredential });
                    navigate(ROUTER_UTIL.HOME);
                  })
                  .catch((err) => {
                    setError(
                      "Failed to update login time in database, please try again later."
                    );
                    console.error("Updating login time failed", err);
                    setLoading(false);
                  });
              } else {
                // Create new user profile and navigate to complete-profile.
                setDoc(userDocRef, newUserDoc(firebaseId), { merge: true })
                  .then(() => {
                    analytics.logEvent("sign_up", { signInWithCredential });
                    navigate(ROUTER_UTIL.COMPLETE_PROFILE);
                  })
                  .catch((err) => {
                    setError(
                      "Failed to create user profile in database, please try again later."
                    );
                    console.error("Creating userdoc profile failed", err);
                    setLoading(false);
                  });
              }
            });
          })
          .catch((err) => {
            setError("Sign in failed, please try again later.");
            console.error("Sign-in with credential failed", err);
            setLoading(false);
          });
      });
  };
  return authLoading || authUsername || !authUser?.isAnonymous ? (
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
                  onClick={() => navigate(ROUTER_UTIL.HOME)}
                >
                  Cancel
                </Button>
              </Card.Footer>
            </>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Login;
