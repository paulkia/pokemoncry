import "bootstrap/dist/css/bootstrap.min.css";
import correctSound from "../audio/correct.mp3";
import incorrectSound from "../audio/incorrect.mp3";

export const CORRECT_RESULT_COLOR = "#d4edda";
export const INCORRECT_RESULT_COLOR = "#f8d7da";
export const NEUTRAL_RESULT_COLOR = "#ceebffff";
export const MASTERY_COLOR = "#c9bcffff";

export const PAUSE_TIME = 1000; // ms

export const DISABLE_ANIMATION_SWITCH = 152; // num pokemon
export const GameModes = {
  MENU: "menu",
  PRACTICE: "practice",
  CHALLENGE: "challenge",
};

// Reusable Audio refs for correct/incorrect feedback
export const CORRECT_AUDIO_SOUND = new Audio(correctSound);
export const INCORRECT_AUDIO_SOUND = new Audio(incorrectSound);

export function shuffle(array) {
  let newArray = Array.from(array);
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Swap array[i] and array[j]
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function getRandomElement(array) {
  if (array.length === 0) return null;
  return shuffle(array)[0];
}
