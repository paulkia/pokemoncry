import { useCallback, useRef } from "react";
import { Row, Col } from "react-bootstrap";

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let dataArray = null;
let animationId = null;

export function stopAudioViz(audioEl) {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {}
    sourceNode = null;
  }
  if (analyser) {
    try {
      analyser.disconnect();
    } catch {}
    analyser = null;
  }
  if (audioEl) {
    try {
      audioEl.pause();
      audioEl.src = "";
    } catch {}
    audioEl = null;
  }
  if (audioCtx) {
    try {
      audioCtx.close();
    } catch {}
    audioCtx = null;
  }
  dataArray = null;
}

export function playAudioWithViz(url, audioEl, canvas) {
  if (!url || !canvas) return;
  try {
    // stop previous sound before playing new one
    stopAudioViz(audioEl);

    // create audio element
    audioEl.crossOrigin = "anonymous";
    audioEl.src = url;
    audioEl.autoplay = true;
    audioEl.play().catch((err) => {
      console.error(
        "Audio play failed. Likely because user refreshed page. ",
        err
      );
    });

    // create or reuse audio context
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();

    // analyser
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    // source
    sourceNode = audioCtx.createMediaElementSource(audioEl);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    // buffer
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // canvas sizing
    const canvasCtx = canvas.getContext("2d");
    const style = getComputedStyle(canvas);
    const width = parseInt(style.width, 10) || 300;
    const height = parseInt(style.height, 10) || 60;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // resume if suspended
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch((err) => {
        console.error("Error resuming audio context:", err);
      });
    }

    // draw loop
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      canvasCtx.clearRect(0, 0, width, height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#00aaff";
      canvasCtx.beginPath();
      const slice = width / dataArray.length;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += slice;
      }
      canvasCtx.lineTo(width, height / 2);
      canvasCtx.stroke();
    };

    if (animationId) cancelAnimationFrame(animationId);
    draw();
  } catch (err) {
    // fallback: try simple playback without viz
    console.error("Error in playAudioWithViz:", err);
    try {
      const a = new Audio(url);
      a.play().catch(() => {});
    } catch {}
  }
}

export function playCryForPokemon(
  pokemonData,
  vizInitializedRef,
  audioRef,
  canvasRef,
  preferLegacyCries
) {
  if (!pokemonData) return;

  let cryUrl = pokemonData.latestCry || pokemonData.legacyCry || null;

  if (preferLegacyCries) {
    cryUrl = pokemonData.legacyCry || pokemonData.latestCry || null;
  }

  const audio = audioRef.current;

  // Ensure only one audio at a time: pause and rewind before every play.
  try {
    audio.pause();
  } catch (err) {
    console.error("Error pausing audio:", err);
  }
  audio.currentTime = 0;

  if (!vizInitializedRef.current) {
    playAudioWithViz(cryUrl, audioRef.current, canvasRef.current);
    vizInitializedRef.current = true;
    return;
  }
  audio.src = cryUrl;
  audio.play().catch((err) => {
    console.error("Audio play failed:", err);
  });
}
