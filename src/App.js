import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AppProvider from "./AppContext.js";

///// Pages /////
import Home from "./pages/home/Home";
import PracticePanel from "./pages/home/PracticePanel.js";
import ChallengePanel from "./pages/home/ChallengePanel.js";
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

import Refresher from "./pages/Refresher.js";

import Leaderboard from "./pages/Leaderboard.js";

import { ROUTER_UTIL } from "./library/util.js";

function App() {
  return (
    <AppProvider>
      {" "}
      <BrowserRouter>
        <Routes>
          <Route path={ROUTER_UTIL.HOME} element={<Home />} />
          <Route path={ROUTER_UTIL.PRACTICE_MENU} element={<PracticePanel />} />
          <Route
            path={ROUTER_UTIL.CHALLENGE_MENU}
            element={<ChallengePanel />}
          />
          <Route
            path={ROUTER_UTIL.MULTIPLE_CHOICE_PRACTICE}
            element={<MultipleChoicePractice />}
          />
          <Route
            path={ROUTER_UTIL.SHORT_ANSWER_PRACTICE}
            element={<ShortAnswerPractice />}
          />
          <Route
            path={ROUTER_UTIL.ULTIMATE_TRAINING_PRACTICE}
            element={<UltimateTrainingPractice />}
          />
          <Route path={ROUTER_UTIL.CHALLENGE} element={<Challenge />} />
          <Route path={ROUTER_UTIL.LOGIN} element={<Login />} />
          <Route
            path={ROUTER_UTIL.COMPLETE_PROFILE}
            element={<CompleteProfile />}
          />
          <Route path={ROUTER_UTIL.PROFILE} element={<Profile />} />
          <Route path={ROUTER_UTIL.REFRESHER} element={<Refresher />} />
          <Route path={ROUTER_UTIL.LEADERBOARD} element={<Leaderboard />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
