import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Home from "./pages/home/Home";
import MultipleChoicePractice from "./pages/practice/MultipleChoicePractice";
import ShortAnswerPractice from "./pages/practice/ShortAnswerPractice";
import UltimateTrainingPractice from "./pages/practice/UltimateTrainingPractice";
import Challenge from "./pages/challenge/Challenge";
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import Login from "./pages/Login";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDKC0eQeUK_H2yn8EIKOxCU0p8i_WPKisU",
  authDomain: "guessthecry.firebaseapp.com",
  projectId: "guessthecry",
  storageBucket: "guessthecry.firebasestorage.app",
  messagingSenderId: "120789701006",
  appId: "1:120789701006:web:ce6c186dd5a3ebec0e54df",
  measurementId: "G-3PJM1S7EPR",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

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
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}

export default App;
