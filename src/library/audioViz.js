// Module that manages audio playback + WebAudio Analyser visualization on a canvas.

let audioEl = null;
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let dataArray = null;
let animationId = null;

export function stopAudioViz() {
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

export function playAudioWithViz(url, canvas) {
  if (!url || !canvas) return;
  try {
    // stop previous
    stopAudioViz();

    // create audio element
    audioEl = document.createElement("audio");
    audioEl.crossOrigin = "anonymous";
    audioEl.src = url;
    audioEl.autoplay = true;
    audioEl.play().catch(() => {});

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
      audioCtx.resume().catch(() => {});
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
    try {
      const a = new Audio(url);
      a.play().catch(() => {});
    } catch {}
  }
}
