import "bootstrap/dist/css/bootstrap.min.css";
import correctSound from "../audio/correct.mp3";
import incorrectSound from "../audio/incorrect.mp3";
import shinySound from "../audio/shiny.mp3";

export const DEFAULT_SETTINGS = {
  preferLegacyCries: true,
  disableAnimations: false,
  show: false,
};
export const LOCAL_STORAGE_UTIL = {
  SETTINGS: "userSettings",
};

export const ROUTER_UTIL = {
  HOME: "/",
  PRACTICE_MENU: "/practice-menu",
  CHALLENGE_MENU: "/challenge-menu",
  MULTIPLE_CHOICE_PRACTICE: "/multiple-choice-practice",
  SHORT_ANSWER_PRACTICE: "/short-answer-practice",
  ULTIMATE_TRAINING_PRACTICE: "/ultimate-training-practice",
  CHALLENGE: "/challenge",
  LOGIN: "/login",
  COMPLETE_PROFILE: "/complete-profile",
  PROFILE: "/profile",
  REFRESHER: "/refresher",
  LEADERBOARD: "/leaderboard",
  PRIVACY_POLICY: "/privacy-policy",
};

export const CORRECT_RESULT_COLOR = "#d4edda";
export const INCORRECT_RESULT_COLOR = "#f8d7da";
export const NEUTRAL_RESULT_COLOR = "#ceebffff";
export const MASTERY_COLOR = "#c9bcffff";

export const PAUSE_TIME = 1000; // ms

export const SHINY_PROBABILITY = 1 / 69;

export const DISABLE_ANIMATION_SWITCH = 152; // num mon
export const GameModes = {
  MENU: "menu",
  PRACTICE: "practice",
  CHALLENGE: "challenge",
};

// Reusable Audio refs for correct/incorrect feedback
export const CORRECT_AUDIO_SOUND = new Audio(correctSound);
export const INCORRECT_AUDIO_SOUND = new Audio(incorrectSound);
export const SHINY_AUDIO_SOUND = new Audio(shinySound);

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

export function getAnimatedSprite(monData) {
  return (
    monData?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated
      ?.front_default ??
    monData?.sprites?.other?.showdown?.front_default ??
    monData?.sprites?.front_default ??
    null
  );
}

export function getStaticSprite(monData) {
  const v = monData?.sprites?.versions;
  return (
    v?.["generation-i"]?.["yellow"]?.front_default ??
    v?.["generation-i"]?.["red-blue"]?.front_default ??
    v?.["generation-ii"]?.["crystal"]?.front_default ??
    v?.["generation-iii"]?.["emerald"]?.front_default ??
    v?.["generation-iv"]?.["platinum"]?.front_default ??
    v?.["generation-v"]?.["black-white"]?.front_default ??
    monData?.sprites?.front_default ??
    null
  );
}

export function getAnimatedShinySprite(monData) {
  return (
    monData?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated
      ?.front_shiny ??
    monData?.sprites?.other?.showdown?.front_shiny ??
    monData?.sprites?.front_shiny ??
    monData?.sprites?.front_default ??
    null
  );
}

export function getStaticShinySprite(monData) {
  const v = monData?.sprites?.versions;
  return (
    v?.["generation-ii"]?.["crystal"]?.front_shiny ??
    v?.["generation-iii"]?.["emerald"]?.front_shiny ??
    v?.["generation-iv"]?.["platinum"]?.front_shiny ??
    v?.["generation-v"]?.["black-white"]?.front_shiny ??
    monData?.sprites?.front_shiny ??
    null
  );
}
