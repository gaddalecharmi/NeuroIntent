import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export function useGazeTracker({ onTrigger, zones = ["LEFT", "CENTER", "RIGHT"] }) {
  const videoRef = useRef(null);
  const [activeZone, setActiveZone] = useState("CENTER");
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);

  useEffect(() => {
    let landmarker = null;
    let animationFrameId = null;
    let stream = null;

    // Eye Landmark IDs
    const R_OUTER = 33, R_INNER = 133, R_TOP = 159, R_BOTTOM = 145, R_IRIS = 468;
    const L_INNER = 362, L_OUTER = 263, L_TOP = 386, L_BOTTOM = 374, L_IRIS = 473;

    // Settings
    const BLINK_THRESHOLD = 0.20;
    const LONG_BLINK_MS = 450;
    const DWELL_MS = 2000;
    const COOLDOWN_MS = 2500;
    const GAZE_SENSITIVITY = 0.035;

    let calibrated = false;
    let calSamples = [];
    let calStartTime = null;
    let centerRatio = 0.5;
    let smoothedRatio = 0.5;
    let currentZone = "CENTER";
    let blinkStart = null;
    let dwellStart = performance.now();
    let lastTriggerTime = 0;

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    // Vector projection in mirrored screen space
    const getEyeScreenRatio = (mesh, leftCornerIdx, rightCornerIdx, irisIdx) => {
      const pL = { x: 1.0 - mesh[leftCornerIdx].x, y: mesh[leftCornerIdx].y };
      const pR = { x: 1.0 - mesh[rightCornerIdx].x, y: mesh[rightCornerIdx].y };
      const pI = { x: 1.0 - mesh[irisIdx].x, y: mesh[irisIdx].y };

      const vx = pR.x - pL.x;
      const vy = pR.y - pL.y;
      const ix = pI.x - pL.x;
      const iy = pI.y - pL.y;
      const lenSq = vx * vx + vy * vy + 1e-6;
      return (ix * vx + iy * vy) / lenSq;
    };

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });

      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => predict();
      }
    }

    function predict() {
      if (videoRef.current && landmarker) {
        const now = performance.now();
        const results = landmarker.detectForVideo(videoRef.current, now);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const mesh = results.faceLandmarks[0];

          // 1. Blink EAR (Both Eyes)
          const earR = dist(mesh[R_TOP], mesh[R_BOTTOM]) / (dist(mesh[R_OUTER], mesh[R_INNER]) + 1e-6);
          const earL = dist(mesh[L_TOP], mesh[L_BOTTOM]) / (dist(mesh[L_INNER], mesh[L_OUTER]) + 1e-6);
          const ear = (earR + earL) / 2.0;

          // 2. Horizontal Gaze Ratio (Both Eyes)
          const ratioR = getEyeScreenRatio(mesh, R_INNER, R_OUTER, R_IRIS);
          const ratioL = getEyeScreenRatio(mesh, L_OUTER, L_INNER, L_IRIS);
          const rawRatio = (ratioR + ratioL) / 2.0;

          // 3. Hands-Free 3-Second Startup Auto-Calibration
          if (!calibrated) {
            if (!calStartTime) calStartTime = now;
            if (ear >= BLINK_THRESHOLD) calSamples.push(rawRatio);

            if (now - calStartTime >= 3000 && calSamples.length > 10) {
              calSamples.sort((a, b) => a - b);
              centerRatio = calSamples[Math.floor(calSamples.length / 2)];
              smoothedRatio = centerRatio;
              calibrated = true;
              setIsCalibrated(true);
              dwellStart = now;
            }
          } else {
            // 4. Normal Gaze & Blink Selection
            let triggered = false;

            if (ear < BLINK_THRESHOLD) {
              if (!blinkStart) blinkStart = now;
              else if (now - blinkStart >= LONG_BLINK_MS && now - lastTriggerTime > COOLDOWN_MS) {
                triggered = true;
                blinkStart = null;
              }
            } else {
              blinkStart = null;
              smoothedRatio = 0.3 * rawRatio + 0.7 * smoothedRatio;

              let newZone = "CENTER";
              if (smoothedRatio < centerRatio - GAZE_SENSITIVITY) newZone = "LEFT";
              else if (smoothedRatio > centerRatio + GAZE_SENSITIVITY) newZone = "RIGHT";

              if (newZone !== currentZone) {
                currentZone = newZone;
                setActiveZone(newZone);
                dwellStart = now;
                setDwellProgress(0);
              } else {
                const elapsed = now - dwellStart;
                setDwellProgress(Math.min((elapsed / DWELL_MS) * 100, 100));
                if (elapsed >= DWELL_MS && now - lastTriggerTime > COOLDOWN_MS) {
                  triggered = true;
                  dwellStart = now;
                }
              }
            }

            if (triggered) {
              lastTriggerTime = now;
              setDwellProgress(0);
              if (onTrigger) onTrigger(currentZone);
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(predict);
    }

    init();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (landmarker) landmarker.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, activeZone, isCalibrated, dwellProgress };
}