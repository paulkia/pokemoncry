import React, { useState, useEffect, useContext } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  // isSignInWithEmailLink, // Not used in this implementation
  // signInWithEmailLink, // Not used in this implementation
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  Trophy,
  User,
  Save,
  Activity,
  Gamepad2,
  AlertCircle,
  CheckCircle,
  Mail,
  LogOut,
  ArrowRight,
} from "lucide-react";

// --- 1. CONFIGURATION & SETUP ---
const firebaseConfig =
  typeof __firebase_config !== "undefined" ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

// Initialize core services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PUBLIC_DATA_PATH = "data";

// --- 2. AUTH CONTEXT DEFINITION ---

const AuthContext = React.createContext(null);

// Custom hook to use the auth context
const useAuth = () => useContext(AuthContext);

// --- 3. AUTH PROVIDER COMPONENT (Holds all state and logic) ---

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLoginScreen, setShowLoginScreen] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loginStep, setLoginStep] = useState("options"); // 'options' | 'email-sent'
  const [emailInput, setEmailInput] = useState("");

  // Expose these via context for other components to access
  const [userProfile, setUserProfile] = useState({ name: "", bestScore: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

  // Initial Authentication & State Listener
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
        setErrorMsg("System connection failed. Please refresh.");
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      // If a real authenticated user exists (not just anonymous), show the main app
      if (currentUser && !currentUser.isAnonymous) {
        setShowLoginScreen(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Data Syncing (Leaderboard & Profile)
  useEffect(() => {
    if (!user) return;
    const leaderboardRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      PUBLIC_DATA_PATH,
      "leaderboard"
    );

    const unsubscribe = onSnapshot(leaderboardRef, (snapshot) => {
      const scores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      scores.sort((a, b) => b.score - a.score);
      setLeaderboard(scores.slice(0, 20));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "profile",
      "main"
    );
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Login Handlers
  const handleGoogleLogin = async () => {
    // --- PRODUCTION CODE START (Uncomment in your real app) ---
    /* try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowLoginScreen(false);
    } catch (error) {
      setErrorMsg(error.message);
    }
    */
    // --- SANDBOX SIMULATION ---
    setSuccessMsg("Logged in via Google (Simulation)");
    setTimeout(() => {
      setShowLoginScreen(false);
      setSuccessMsg("");
    }, 1000);
  };

  const handleAppleLogin = async () => {
    // --- PRODUCTION CODE START (Uncomment in your real app) ---
    /*
    try {
      const provider = new OAuthProvider('apple.com');
      await signInWithPopup(auth, provider);
      setShowLoginScreen(false);
    } catch (error) {
      setErrorMsg(error.message);
    }
    */
    // --- SANDBOX SIMULATION ---
    setSuccessMsg("Logged in via Apple (Simulation)");
    setTimeout(() => {
      setShowLoginScreen(false);
      setSuccessMsg("");
    }, 1000);
  };

  const handleEmailLogin = async () => {
    if (!emailInput.includes("@")) {
      setErrorMsg("Please enter a valid email.");
      return;
    }
    // --- PRODUCTION CODE START ---
    /*
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };
    try {
      await sendSignInLinkToEmail(auth, emailInput, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', emailInput);
      setLoginStep('email-sent');
    } catch (error) {
      setErrorMsg(error.message);
    }
    */
    // --- SANDBOX SIMULATION ---
    setLoginStep("email-sent");
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowLoginScreen(true);
    setSuccessMsg("Logged out successfully.");
    // Clear local states on logout
    setUserProfile({ name: "", bestScore: 0 });
    setLoginStep("options");
  };

  const contextValue = {
    user,
    authLoading,
    showLoginScreen,
    leaderboard,
    userProfile,
    errorMsg,
    successMsg,
    setErrorMsg,
    setSuccessMsg,
    handleLogout,
    handleGoogleLogin,
    handleAppleLogin,
    handleEmailLogin,
    loginStep,
    setLoginStep,
    emailInput,
    setEmailInput,
    db, // Pass db instance for data operations
    appId, // Pass appId for path construction
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// --- 4. LOGIN SCREEN COMPONENT (Consumes Context) ---

const LoginScreen = () => {
  const {
    errorMsg,
    successMsg,
    setErrorMsg,
    setSuccessMsg,
    handleGoogleLogin,
    handleAppleLogin,
    handleEmailLogin,
    loginStep,
    setLoginStep,
    emailInput,
    setEmailInput,
  } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
            Neon Clicker
          </h1>
          <p className="text-slate-400">
            Sign in to save your unique username and compete on the global
            leaderboard.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-900/30 border border-red-500/50 p-3 rounded text-sm text-red-200 text-center">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-900/30 border border-green-500/50 p-3 rounded text-sm text-green-200 text-center">
            {successMsg}
          </div>
        )}

        {loginStep === "options" ? (
          <div className="space-y-4">
            {/* Google Button */}
            <button
              onClick={() => {
                setErrorMsg("");
                handleGoogleLogin();
              }}
              className="w-full bg-white hover:bg-gray-100 text-slate-900 font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            {/* Apple Button */}
            <button
              onClick={() => {
                setErrorMsg("");
                handleAppleLogin();
              }}
              className="w-full bg-black hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-3 border border-slate-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.29-1.23 3.57-1.23.6 0 2.43.16 3.03 1.38-3.17 1.29-2.8 5.76.32 6.8-1.15 3.03-3.08 4.19-4 5.28zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Sign in with Apple
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-400">
                  Or using email
                </span>
              </div>
            </div>

            {/* Email Magic Link */}
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@example.com"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none transition"
              />
              <button
                onClick={() => {
                  setErrorMsg("");
                  handleEmailLogin();
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-lg transition"
              >
                <ArrowRight />
              </button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              We will send you a one-time login link (Passwordless).
            </p>
          </div>
        ) : (
          <div className="text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto text-purple-400">
              <Mail size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">Check your inbox!</h3>
            <p className="text-slate-400">
              We sent a login link to{" "}
              <span className="text-white font-mono">{emailInput}</span>. Click
              the link to sign in automatically.
            </p>
            <button
              onClick={() => setLoginStep("options")}
              className="text-sm text-cyan-400 hover:text-cyan-300 underline"
            >
              Use a different method
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 5. MAIN GAME SCREEN COMPONENT (Consumes Context) ---

const MainGameScreen = () => {
  const {
    user,
    userProfile,
    leaderboard,
    handleLogout,
    setErrorMsg,
    setSuccessMsg,
    errorMsg,
    successMsg,
    db,
    appId,
  } = useAuth();

  // Local Game State
  const [gameScore, setGameScore] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);

  // Local Name Input State (synced from profile on load, managed here for input)
  const [nameInput, setNameInput] = useState(userProfile.name || "");
  const [isCheckingName, setIsCheckingName] = useState(false);

  useEffect(() => {
    setNameInput(userProfile.name || "");
  }, [userProfile.name]);

  // Actions
  const handleSaveName = async () => {
    if (!user || !nameInput.trim()) return;
    setIsCheckingName(true);
    setErrorMsg("");
    setSuccessMsg("");

    const newName = nameInput.trim();
    const normalizedNewName = newName.toLowerCase();
    const oldName = userProfile.name;
    const normalizedOldName = oldName ? oldName.toLowerCase() : null;

    try {
      if (normalizedNewName !== normalizedOldName) {
        const nameRegistryRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "usernames",
          normalizedNewName
        );
        const nameSnap = await getDoc(nameRegistryRef);

        if (nameSnap.exists() && nameSnap.data().uid !== user.uid) {
          setErrorMsg(`The name "${newName}" is already taken.`);
          setIsCheckingName(false);
          return;
        }
        await setDoc(nameRegistryRef, { uid: user.uid });
        if (oldName) {
          const oldNameRef = doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "usernames",
            normalizedOldName
          );
          await deleteDoc(oldNameRef);
        }
      }

      const profileRef = doc(
        db,
        "artifacts",
        appId,
        "users",
        user.uid,
        "profile",
        "main"
      );
      await setDoc(
        profileRef,
        { name: newName, updatedAt: serverTimestamp() },
        { merge: true }
      );

      const leaderboardDocRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        PUBLIC_DATA_PATH,
        "leaderboard",
        user.uid
      );
      const lbSnap = await getDoc(leaderboardDocRef);
      if (lbSnap.exists()) {
        await setDoc(leaderboardDocRef, { userName: newName }, { merge: true });
      }

      setSuccessMsg("Name updated successfully!");
    } catch (err) {
      console.error("Error saving name:", err);
      setErrorMsg("Failed to save name.");
    } finally {
      setIsCheckingName(false);
    }
  };

  const handleSubmitScore = async () => {
    if (!user) return;
    if (!userProfile.name) {
      setErrorMsg("Please save a display name before submitting scores!");
      return;
    }

    try {
      const leaderboardDocRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        PUBLIC_DATA_PATH,
        "leaderboard",
        user.uid
      );
      const existingDoc = await getDoc(leaderboardDocRef);
      if (existingDoc.exists()) {
        const existingScore = existingDoc.data().score;
        if (existingScore >= gameScore) {
          setErrorMsg(
            `Score ${gameScore} is not higher than your best (${existingScore}).`
          );
          setGameScore(0);
          setIsGameActive(false);
          return;
        }
      }

      await setDoc(leaderboardDocRef, {
        userId: user.uid,
        userName: userProfile.name,
        score: gameScore,
        timestamp: serverTimestamp(),
      });

      const profileRef = doc(
        db,
        "artifacts",
        appId,
        "users",
        user.uid,
        "profile",
        "main"
      );
      await setDoc(profileRef, { bestScore: gameScore }, { merge: true });

      setSuccessMsg(`New High Score Submitted: ${gameScore}!`);
      setGameScore(0);
      setIsGameActive(false);

      // Clear errors after success
      setErrorMsg("");
    } catch (err) {
      setErrorMsg("Failed to submit score.");
    }
  };

  const handleClicker = () => {
    if (!isGameActive) {
      setIsGameActive(true);
      setErrorMsg("");
      setSuccessMsg("");
    }
    setGameScore((prev) => prev + 10);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <header className="max-w-4xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
            Neon Clicker
          </h1>
          <p className="text-xs text-slate-400">
            Logged in as {user?.email || "Simulated User"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition"
        >
          <LogOut size={14} /> Logout
        </button>
      </header>

      {/* Notifications */}
      <div className="max-w-4xl mx-auto mb-6 space-y-2">
        {errorMsg && (
          <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="text-red-400 shrink-0" />
            <p className="text-red-200 text-sm">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-900/50 border border-green-500 p-4 rounded-lg flex items-center gap-3 animate-fadeIn">
            <CheckCircle className="text-green-400 shrink-0" />
            <p className="text-green-200 text-sm">{successMsg}</p>
          </div>
        )}
      </div>

      <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Col: Identity & Game */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <User className="text-cyan-400" size={24} />
              <h2 className="text-xl font-bold">Player Identity</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
                  Unique Display Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter Unique Name..."
                    disabled={isCheckingName}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 focus:border-cyan-500 focus:outline-none transition disabled:opacity-50"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isCheckingName || !nameInput.trim()}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white px-4 py-2 rounded transition flex items-center gap-2 min-w-[90px] justify-center"
                  >
                    {isCheckingName ? (
                      <span className="animate-spin">⌛</span>
                    ) : (
                      <>
                        <Save size={16} /> Save
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  * Name must be unique. This name is now tied to your login
                  account.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Gamepad2 className="text-purple-400" size={24} />
                <h2 className="text-xl font-bold">Play Game</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase">Current Run</p>
                <p className="text-3xl font-black text-purple-400">
                  {gameScore}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleClicker}
                className="w-full py-8 bg-slate-900 border-2 border-dashed border-purple-500/50 hover:border-purple-400 rounded-xl text-purple-200 hover:text-white hover:bg-slate-700 transition active:scale-95 text-lg font-bold select-none"
              >
                CLICK ME (+10)
              </button>

              <button
                onClick={handleSubmitScore}
                disabled={gameScore === 0}
                className={`w-full py-3 rounded-lg font-bold shadow-lg transition flex items-center justify-center gap-2
                  ${
                    gameScore > 0
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white cursor-pointer"
                      : "bg-slate-700 text-slate-500 cursor-not-allowed"
                  }
                `}
              >
                <Activity size={18} /> Submit High Score
              </button>

              {userProfile.bestScore > 0 && (
                <p className="text-center text-xs text-slate-400">
                  Your Personal Best:{" "}
                  <span className="text-cyan-400 font-bold">
                    {userProfile.bestScore}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Leaderboard */}
        <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 flex flex-col h-[500px]">
          <div className="p-6 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2">
              <Trophy className="text-yellow-400" size={24} />
              <h2 className="text-xl font-bold text-yellow-100">Top Players</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              One entry per verified account
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {leaderboard.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <p>No scores yet...</p>
                <p className="text-sm">Be the first!</p>
              </div>
            ) : (
              leaderboard.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`flex items-center p-3 rounded-lg border ${
                    entry.userId === user?.uid
                      ? "bg-cyan-900/30 border-cyan-500/50"
                      : "bg-slate-700/50 border-transparent"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                      idx === 0
                        ? "bg-yellow-500 text-yellow-900"
                        : idx === 1
                        ? "bg-slate-400 text-slate-900"
                        : idx === 2
                        ? "bg-orange-600 text-orange-100"
                        : "bg-slate-600 text-slate-300"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-semibold ${
                        entry.userId === user?.uid
                          ? "text-cyan-400"
                          : "text-white"
                      }`}
                    >
                      {entry.userName || "Anonymous"}
                    </p>
                  </div>
                  <div className="text-xl font-mono font-bold text-purple-300">
                    {entry.score}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// --- 6. MAIN APP COMPONENT (Router) ---

const App = () => {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
};

const AppRouter = () => {
  const { showLoginScreen } = useAuth();

  // Decide which "page" (component) to show based on login state
  return showLoginScreen ? <LoginScreen /> : <MainGameScreen />;
};

export default App;
