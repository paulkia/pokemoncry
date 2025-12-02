import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

// 1. Create the Context
const AuthContext = createContext({
  authUser: null,
  authUsername: null,
  authLoading: true, // Indicates if the initial Firebase check is complete
});

// 2. Custom hook for easy access
export const useAuth = () => {
  return useContext(AuthContext);
};

// 3. The Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth changes; then for the user's profile doc in Firestore.
    let userDocUnsub = null;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      // Tear down any previous user doc listener
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        // Real-time listener for profile updates (e.g., username added later)
        userDocUnsub = onSnapshot(
          userDocRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setUsername(data?.username || null);
            } else {
              setUsername(null);
            }
            setLoading(false); // We got initial profile state
          },
          (err) => {
            console.error("User doc snapshot error", err);
            setUsername(null);
            setLoading(false);
          }
        );
      } else {
        // Signed out
        setUsername(null);
        setLoading(false);
      }
    });

    // Cleanup on unmount
    return () => {
      authUnsub();
      if (userDocUnsub) userDocUnsub();
    };
  }, []);

  // Context value object
  const value = {
    authUser: currentUser,
    authUsername: username,
    authLoading: loading,
    // Add other auth functions like signIn, signOut if needed
  };

  // Only render children after the initial authentication check is complete
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {/* Optionally render a loading screen here if loading is true */}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
