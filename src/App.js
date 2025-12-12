import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { Col, Row } from "react-bootstrap";
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

import AppHeader from "./components/AppHeader.js";
import AppFooter from "./components/AppFooter.js";

import { ROUTER_UTIL } from "./library/util.js";

function App() {
  return (
    <Col style={{ minHeight: "100vh" }} className="d-flex flex-column">
      <AppProvider className="h-100">
        <BrowserRouter>
          <Routes>
            <Route
              path={ROUTER_UTIL.HOME}
              element={
                <div
                  className="App p-5 d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <Home />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.PRACTICE_MENU}
              element={
                <div
                  className="App p-5 d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <PracticePanel />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.CHALLENGE_MENU}
              element={
                <div
                  className="App p-5 d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <ChallengePanel />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.MULTIPLE_CHOICE_PRACTICE}
              element={
                <div
                  className="App p-5 text-center d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <MultipleChoicePractice />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.SHORT_ANSWER_PRACTICE}
              element={
                <div
                  className="App p-5 text-center d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <ShortAnswerPractice />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.ULTIMATE_TRAINING_PRACTICE}
              element={
                <div
                  className="App p-5 text-center d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <UltimateTrainingPractice />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.CHALLENGE}
              element={
                <div
                  className="App p-5 text-center d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <Challenge />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.LOGIN}
              element={
                <div
                  className="d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <div className="App p-5">
                    <AppHeader />
                  </div>
                  <div className="flex-grow-1">
                    <Login />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.COMPLETE_PROFILE}
              element={
                <div
                  className="d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <div className="App p-5">
                    <AppHeader />
                  </div>
                  <div className="flex-grow-1">
                    <CompleteProfile />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route
              path={ROUTER_UTIL.PROFILE}
              element={
                <div
                  className="d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <div className="App p-5">
                    <AppHeader />
                  </div>
                  <div className="flex-grow-1">
                    <Profile />
                  </div>
                  <AppFooter />
                </div>
              }
            />
            <Route path={ROUTER_UTIL.REFRESHER} element={<Refresher />} />
            <Route
              path={ROUTER_UTIL.LEADERBOARD}
              element={
                <div
                  className="App p-5 d-flex flex-column"
                  style={{ minHeight: "100vh" }}
                >
                  <AppHeader />
                  <div className="flex-grow-1">
                    <Leaderboard />
                  </div>
                  <AppFooter />
                </div>
              }
            />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </Col>
  );
}

export default App;
