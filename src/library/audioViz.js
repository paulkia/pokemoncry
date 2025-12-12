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
  // Stop the Web Audio source (the decoded buffer)
  if (sourceNode) {
    try {
      sourceNode.stop();
      sourceNode.disconnect();
    } catch (e) {
      // Ignore errors if already stopped
    }
    sourceNode = null;
  }
  // DO NOT close audioCtx here.
  // keeping the context open is safer for iOS user-interaction rules.
}

export async function playAudioWithViz(url, canvas) {
  if (!url || !canvas) return;

  try {
    // 1. Stop previous sound
    stopAudioViz();

    // 2. Initialize AudioContext (Singleton pattern)
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }

    // 3. Resume context (Required for iOS if state is suspended)
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    // 4. Create Analyser (if not exists)
    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
    }

    // 5. Fetch and Decode Audio (The Fix for iOS)
    // We fetch the blob/url and decode it fully. This bypasses the streaming bugs.
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // 6. Create Buffer Source & Connect
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;

    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    // 7. Start Playback
    sourceNode.start(0);

    // --- Visualization Logic (Unchanged) ---
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    const canvasCtx = canvas.getContext("2d");
    const style = getComputedStyle(canvas);
    const width = parseInt(style.width, 10) || 300;
    const height = parseInt(style.height, 10) || 60;
    const dpr = window.devicePixelRatio || 1;

    // Resize handling
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

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

    draw();
  } catch (err) {
    console.error("Web Audio API Error:", err);
  }
}

export function playCryFromByteUrl(
  cryUrl,
  vizInitializedRef,
  audioRef, // We keep this argument to avoid breaking your call sites, but we ignore it.
  canvasRef
) {
  // We ignore audioRef completely now.
  // Using the HTML <audio> tag is what caused the bug.
  // We always use the Web Audio path (playAudioWithViz) for every play.

  if (canvasRef.current) {
    playAudioWithViz(cryUrl, canvasRef.current);
    vizInitializedRef.current = true;
  }
}

// Used by Practice modes
export function playCryForMon(
  monData,
  vizInitializedRef,
  audioRef,
  canvasRef,
  preferLegacyCries
) {
  if (!monData) return;

  let cryUrl = monData.latestCry || monData.legacyCry || null;

  if (preferLegacyCries) {
    cryUrl = monData.legacyCry || monData.latestCry || null;
  }

  playCryFromByteUrl(cryUrl, vizInitializedRef, audioRef, canvasRef);
}
