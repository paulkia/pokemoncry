import "../../App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Form,
  Card,
  Button,
  InputGroup,
  Spinner,
} from "react-bootstrap";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { useAuth } from "../../AppContext";
import { auth } from "../../firebase";
import { ROUTER_UTIL } from "../../library/util";
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const claimUsernameCallable = httpsCallable(functions, "claimUsername");

function Profile() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newUsername, setNewUsername] = useState(null);
  const editUsernameRef = useRef(null);
  const queryClient = useQueryClient();

  const { authUser, authUsername, authLoading } = useAuth();

  useEffect(() => {
    if (loading || authLoading) {
      return;
    }
    if (authUser === null || authUser.isAnonymous) {
      navigate(ROUTER_UTIL.LOGIN);
    }
    if (authUsername == null) {
      navigate(ROUTER_UTIL.COMPLETE_PROFILE);
    }
  }, [
    authUsername,
    authUser,
    navigate,
    signingOut,
    deletingAccount,
    loading,
    authLoading,
  ]);

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
      navigate(ROUTER_UTIL.HOME);
    }
  };

  const handleDeleteAccount = async () => {
    setError("");
    setDeletingAccount(true);
    setLoading(true);

    const user = auth.currentUser;
    if (user) {
      // Delete the Firebase Auth user account
      try {
        await user.delete();
        // Cloud function to delete user data auth trigger called.
        // Nothing more to do here.
      } catch (authErr) {
        // Deletion may fail if re-auth is required
        console.error("Firebase auth user deletion failed", authErr);
      }
    } else {
      console.error("No authenticated user to delete");
    }
    navigate(ROUTER_UTIL.HOME);
  };

  useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event) {
      if (
        !loading &&
        editUsernameRef.current &&
        !editUsernameRef.current.contains(event.target)
      ) {
        setNewUsername(null);
      }
    }
    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editUsernameRef, loading]);

  return authLoading || authUser?.isAnonymous || !authUsername ? (
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
          <Card className="shadow-sm cute-card border-0">
            <>
              <Card.Header>
                <h3>Profile</h3>
              </Card.Header>
              <Card.Body className="p-4">
                <Card.Title>Username</Card.Title>
                {authUsername !== null ? (
                  newUsername !== null ? (
                    <span
                      className="p-2 d-inline-block"
                      style={{ borderStyle: "dashed", borderRadius: "10px" }}
                      onClick={() =>
                        newUsername === null ? setNewUsername(authUsername) : {}
                      }
                      ref={editUsernameRef}
                    >
                      <InputGroup
                        id="shake-input-group"
                        style={{
                          alignItems: "stretch",
                          paddingLeft: "1rem",
                          paddingRight: "1rem",
                        }}
                      >
                        <Form.Control
                          placeholder="E.g. poke_master"
                          value={newUsername}
                          onChange={(e) => {
                            console.log(e);
                            setNewUsername(
                              e.target.value
                                .trim()
                                .toLowerCase()
                                .replace(/[^a-z0-9_]/g, "")
                            );
                          }}
                          maxLength={20}
                        ></Form.Control>
                        <Button
                          disabled={
                            !/^.{3,20}$/.test(newUsername) ||
                            newUsername === authUsername
                          }
                          variant="outline-success"
                          onClick={async () => {
                            setLoading(true);
                            try {
                              await claimUsernameCallable({
                                username: newUsername,
                              });
                              setNewUsername(null);
                              queryClient.invalidateQueries({
                                queryKey: ["globalTop"],
                              });
                            } catch (e) {
                              setError(
                                e?.message || "Could not save your profile"
                              );
                            }
                            setLoading(false);
                          }}
                        >
                          Confirm
                        </Button>
                      </InputGroup>
                      <Form.Text className="text-muted">
                        3-20 chars. Letters, numbers, underscore only. WARNING:
                        usernames are PUBLIC.
                      </Form.Text>
                    </span>
                  ) : (
                    <Row
                      className="p-2 d-inline-block"
                      style={{ borderStyle: "dashed", borderRadius: "10px" }}
                      onClick={() => setNewUsername(authUsername)}
                    >
                      {authUsername}{" "}
                      <i className="bi bi-pencil-square text-muted" />
                    </Row>
                  )
                ) : (
                  <Spinner />
                )}
                {error && (
                  <Row
                    className="alert alert-danger mt-3 mb-0 position-relative"
                    role="alert"
                    style={{ minHeight: "50px" }} // Ensures enough space for the button
                  >
                    {error}
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => setError(null)}
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        fontSize: "0.8rem",
                      }}
                    />
                  </Row>
                )}
              </Card.Body>
              <Card.Footer className="bg-white border-0 d-flex gap-2">
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
  );
}

export default Profile;
