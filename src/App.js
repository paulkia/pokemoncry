import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React from "react";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Home from "./pages/home/Home";
import MultipleChoicePractice from "./pages/practice/MultipleChoicePractice";
import ShortAnswerPractice from "./pages/practice/ShortAnswerPractice";
import UltimateTrainingPractice from "./pages/practice/UltimateTrainingPractice";
import Challenge from "./pages/Challenge";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/multiple-choice-practice"
        element={<MultipleChoicePractice />}
      />
      <Route path="/short-answer-practice" element={<ShortAnswerPractice />} />
      <Route
        path="/ultimate-training-practice"
        element={<UltimateTrainingPractice />}
      />
      <Route path="/challenge" element={<Challenge />} />
    </Routes>
  );
}

export default App;
