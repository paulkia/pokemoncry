import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AuthProvider from "./components/AuthProvider";

///// Pages /////
import Home from "./pages/home/Home";
// Practice modes
import MultipleChoicePractice from "./pages/practice/MultipleChoicePractice";
import ShortAnswerPractice from "./pages/practice/ShortAnswerPractice";
import UltimateTrainingPractice from "./pages/practice/UltimateTrainingPractice";
// Challenge modes
import Challenge from "./pages/challenge/Challenge";
// Login or account creation step: from email or provider login
import Login from "./pages/auth/Login";
// Account creation step: username assignment
import CompleteProfile from "./pages/auth/CompleteProfile.js";
// Profile view: sign out, delete account
import Profile from "./pages/auth/Profile.js";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/multiple-choice-practice"
          element={<MultipleChoicePractice />}
        />
        <Route
          path="/short-answer-practice"
          element={<ShortAnswerPractice />}
        />
        <Route
          path="/ultimate-training-practice"
          element={<UltimateTrainingPractice />}
        />
        <Route path="/challenge" element={<Challenge />} />
        <Route path="/login" element={<Login />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
