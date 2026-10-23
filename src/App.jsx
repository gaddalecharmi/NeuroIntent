import React, { useRef, useState, useCallback, useEffect } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { tree, domainOrder, quickResponses } from "./data";
import { CategoryIllustration, QuickResponseGlyph, OptionArt } from "./illustrations";
import "./styles.css";

// ─── Web Speech API Hook ───────────────────────────────────────────────────
function useSpeech(enabled) {
  const cancel = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    (text, onEnd) => {
      if (!enabled || !("speechSynthesis" in window)) {
        onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      if (onEnd) utterance.onend = onEnd;
      window.speechSynthesis.speak(utterance);
    },
    [enabled]
  );

  return { speak, cancel };
}

// ─── Configurable Eye-Gaze Dwell Selection Hook ─────────────────────────────
function useGazeDwell({ enabled, dwellMs, onDwell }) {
  const dwellRef = useRef(null);
  const currentTarget = useRef(null);
  const [activeGazeId, setActiveGazeId] = useState(null);
  const [progressPct, setProgressPct] = useState(0);

  const clearDwell = useCallback(() => {
    if (dwellRef.current) {
      clearInterval(dwellRef.current);
      dwellRef.current = null;
    }
    currentTarget.current = null;
    setActiveGazeId(null);
    setProgressPct(0);
  }, []);

  const startDwell = useCallback(
    (id) => {
      if (!enabled) return;
      if (currentTarget.current === id) return;
      clearDwell();
      currentTarget.current = id;
      setActiveGazeId(id);

      const startTime = Date.now();
      dwellRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, (elapsed / dwellMs) * 100);
        setProgressPct(pct);

        if (elapsed >= dwellMs) {
          clearDwell();
          onDwell(id);
        }
      }, 30);
    },
    [enabled, dwellMs, clearDwell, onDwell]
  );

  return { startDwell, clearDwell, activeGazeId, progressPct };
}

// ─── MediaPipe Hands-Free Both-Eyes Gaze + Long-Blink Hook ─────────────────
function useMediaPipeGaze({ gazeEnabled, onGazePoint, onLongBlink }) {
  const [status, setStatus] = useState("idle");
  const [calProgress, setCalProgress] = useState(0);
  const videoRef = useRef(null);
  const onGazePointRef = useRef(onGazePoint);
  const onLongBlinkRef = useRef(onLongBlink);

  useEffect(() => {
    onGazePointRef.current = onGazePoint;
    onLongBlinkRef.current = onLongBlink;
  }, [onGazePoint, onLongBlink]);

  useEffect(() => {
    if (!gazeEnabled) {
      setStatus("idle");
      setCalProgress(0);
      return;
    }

    let landmarker = null;
    let animationFrameId = null;
    let stream = null;
    let isCancelled = false;

    // Unflipped MediaPipe Landmark IDs for Both Eyes
    const R_OUTER = 33, R_INNER = 133, R_TOP = 159, R_BOTTOM = 145, R_IRIS = 468;
    const L_INNER = 362, L_OUTER = 263, L_TOP = 386, L_BOTTOM = 374, L_IRIS = 473;

    // Thresholds & Sensitivity
    const BLINK_EAR_THRESHOLD = 0.20;
    const LONG_BLINK_MS = 450;
    const COOLDOWN_MS = 2200;
    const H_SENSITIVITY = 0.045; // Horizontal eye range from center to screen edge
    const V_SENSITIVITY = 0.055; // Vertical eye range from center to screen edge

    let calibrated = false;
    let calSamplesH = [];
    let calSamplesV = [];
    let calStartTime = null;
    let centerH = 0.5;
    let centerV = 0.5;
    let smoothX = window.innerWidth / 2;
    let smoothY = window.innerHeight / 2;
    let blinkStart = null;
    let lastBlinkTrigger = 0;

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    // Projects pupil onto the vector connecting the two eye corners in mirrored screen space
    const getHorizontalRatio = (mesh, leftCornerIdx, rightCornerIdx, irisIdx) => {
      const pL = { x: 1.0 - mesh[leftCornerIdx].x, y: mesh[leftCornerIdx].y };
      const pR = { x: 1.0 - mesh[rightCornerIdx].x, y: mesh[rightCornerIdx].y };
      const pI = { x: 1.0 - mesh[irisIdx].x, y: mesh[irisIdx].y };
      const vx = pR.x - pL.x;
      const vy = pR.y - pL.y;
      const ix = pI.x - pL.x;
      const iy = pI.y - pL.y;
      return (ix * vx + iy * vy) / (vx * vx + vy * vy + 1e-6);
    };

    // Measures vertical iris offset relative to eye corners (head-pose compensated)
    const getVerticalRatio = (mesh, corner1Idx, corner2Idx, irisIdx, eyeWidth) => {
      const midY = (mesh[corner1Idx].y + mesh[corner2Idx].y) * 0.5;
      return (mesh[irisIdx].y - midY) / (eyeWidth + 1e-6);
    };

    async function initGaze() {
      try {
        setStatus("starting");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        if (isCancelled) return;

        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (isCancelled) return;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            if (!isCancelled) {
              setStatus("calibrating");
              predictFrame();
            }
          };
        }
      } catch (err) {
        console.error("MediaPipe Gaze Error:", err);
        setStatus("denied");
      }
    }

    function predictFrame() {
      if (isCancelled) return;

      const video = videoRef.current;
      if (video && landmarker && video.readyState >= 2) {
        const now = performance.now();
        const results = landmarker.detectForVideo(video, now);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const mesh = results.faceLandmarks[0];

          // 1. Both-Eyes EAR for Blink Detection
          const wR = dist(mesh[R_OUTER], mesh[R_INNER]);
          const hR = dist(mesh[R_TOP], mesh[R_BOTTOM]);
          const earR = hR / (wR + 1e-6);

          const wL = dist(mesh[L_INNER], mesh[L_OUTER]);
          const hL = dist(mesh[L_TOP], mesh[L_BOTTOM]);
          const earL = hL / (wL + 1e-6);

          const ear = (earR + earL) * 0.5;

          // 2. Both-Eyes Horizontal & Vertical Gaze Ratios
          const ratioHR = getHorizontalRatio(mesh, R_INNER, R_OUTER, R_IRIS);
          const ratioHL = getHorizontalRatio(mesh, L_OUTER, L_INNER, L_IRIS);
          const rawH = (ratioHR + ratioHL) * 0.5;

          const ratioVR = getVerticalRatio(mesh, R_INNER, R_OUTER, R_IRIS, wR);
          const ratioVL = getVerticalRatio(mesh, L_OUTER, L_INNER, L_IRIS, wL);
          // Blend iris vertical shift with gentle nose-tip vertical head movement
          const rawV = (ratioVR + ratioVL) * 0.5 + (mesh[1].y - 0.5) * 0.25;

          // 3. Hands-Free 3-Second Startup Auto-Calibration
          if (!calibrated) {
            if (!calStartTime) calStartTime = now;
            if (ear >= BLINK_EAR_THRESHOLD) {
              calSamplesH.push(rawH);
              calSamplesV.push(rawV);
            }
            const elapsed = now - calStartTime;
            setCalProgress(Math.min(100, Math.round((elapsed / 3000) * 100)));

            if (elapsed >= 3000 && calSamplesH.length > 10) {
              calSamplesH.sort((a, b) => a - b);
              calSamplesV.sort((a, b) => a - b);
              centerH = calSamplesH[Math.floor(calSamplesH.length / 2)];
              centerV = calSamplesV[Math.floor(calSamplesV.length / 2)];
              calibrated = true;
              setStatus("active");
            }
          } else {
            // 4. Intentional Long-Blink Instant Click OR Smooth Gaze Coordinate Update
            if (ear < BLINK_EAR_THRESHOLD) {
              if (!blinkStart) {
                blinkStart = now;
              } else if (
                now - blinkStart >= LONG_BLINK_MS &&
                now - lastBlinkTrigger > COOLDOWN_MS
              ) {
                lastBlinkTrigger = now;
                blinkStart = null;
                onLongBlinkRef.current?.(smoothX, smoothY);
              }
            } else {
              blinkStart = null;

              // Normalize gaze ratios to (0.0 -> 1.0) screen coordinates
              const normX = Math.max(
                0,
                Math.min(1, 0.5 + (rawH - centerH) / (H_SENSITIVITY * 2))
              );
              const normY = Math.max(
                0,
                Math.min(1, 0.5 + (rawV - centerV) / (V_SENSITIVITY * 2))
              );

              const targetX = normX * window.innerWidth;
              const targetY = normY * window.innerHeight;

              // EMA Smoothing Filter so cursor glides across tiles without jitter
              smoothX = 0.22 * targetX + 0.78 * smoothX;
              smoothY = 0.22 * targetY + 0.78 * smoothY;

              onGazePointRef.current?.(smoothX, smoothY);
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(predictFrame);
    }

    initGaze();

    return () => {
      isCancelled = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (landmarker) landmarker.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [gazeEnabled]);

  return { status, calProgress, videoRef };
}

function findElementUnderGaze(x, y) {
  const targets = document.querySelectorAll("[data-gaze-id]");
  for (const element of targets) {
    const rect = element.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return element.dataset.gazeId;
    }
  }
  return null;
}

// ─── Compact Quick Responses Toolbar (Pictograms + Short Labels) ────────────
function QuickResponsesDeck({
  onSelect,
  gazeEnabled,
  startDwell,
  clearDwell,
  activeGazeId,
  progressPct,
}) {
  return (
    <section className="ni-quick-dock" aria-label="Quick Responses">
      <div className="ni-quick-grid">
        {quickResponses.map((qr) => {
          const gid = `quick-${qr.id}`;
          const isGazed = activeGazeId === gid;

          return (
            <button
              key={qr.id}
              className={`ni-quick-card quick-${qr.id} ${isGazed ? "is-gazed" : ""}`}
              onClick={() => onSelect(qr)}
              data-gaze-id={gid}
              onMouseEnter={() => gazeEnabled && startDwell(gid)}
              onMouseLeave={() => gazeEnabled && clearDwell()}
              aria-label={qr.label}
            >
              <QuickResponseGlyph id={qr.id} className="w-5 h-5 shrink-0" />
              <strong className="ni-quick-title">{qr.label}</strong>

              {/* Dwell Progress Line Inside Card */}
              {isGazed && (
                <div className="ni-tile-progress">
                  <div className="ni-tile-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Picture-First Category Card (Home Screen) ──────────────────────────────
function CategoryTile({ id, item, onClick, gazeEnabled, startDwell, clearDwell, isGazed, progressPct }) {
  const gid = `tile-${id}`;

  return (
    <button
      className={`ni-tile tile-${id} ${isGazed ? "is-gazed" : ""}`}
      onClick={onClick}
      data-gaze-id={gid}
      onMouseEnter={() => gazeEnabled && startDwell(gid)}
      onMouseLeave={() => gazeEnabled && clearDwell()}
      aria-label={item.title}
    >
      <div className="ni-tile-icon-container">
        <CategoryIllustration id={id} className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28" />
      </div>

      <h2 className="ni-tile-title">{item.title}</h2>

      {isGazed && (
        <div className="ni-tile-progress">
          <div className="ni-tile-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </button>
  );
}

// ─── Main Home Dashboard Screen ────────────────────────────────────────────
function HomeScreen({ onSelectDomain, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct }) {
  return (
    <div className="ni-category-grid" role="region" aria-label="Category dashboard">
      {domainOrder.map((id) => (
        <CategoryTile
          key={id}
          id={id}
          item={tree[id]}
          onClick={() => onSelectDomain(id)}
          gazeEnabled={gazeEnabled}
          startDwell={startDwell}
          clearDwell={clearDwell}
          isGazed={activeGazeId === `tile-${id}`}
          progressPct={progressPct}
        />
      ))}
    </div>
  );
}

// ─── Picture-First Option Tile (Meals, Water, Bathroom, etc.) ──────────────
function OptionTile({
  domainId,
  item,
  onClick,
  gazeEnabled,
  startDwell,
  clearDwell,
  isGazed,
  progressPct,
  gazeId,
}) {
  const isLeaf = Boolean(item.message);

  return (
    <button
      className={`ni-option-tile opt-${domainId} ${isGazed ? "is-gazed" : ""}`}
      onClick={onClick}
      data-gaze-id={gazeId}
      onMouseEnter={() => gazeEnabled && startDwell(gazeId)}
      onMouseLeave={() => gazeEnabled && clearDwell()}
      aria-label={item.title}
    >
      {isLeaf && (
        <span className="ni-option-speak-indicator" title="Spoken option">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
          </svg>
        </span>
      )}

      <div className="ni-option-art-box">
        <OptionArt
          domainId={domainId}
          title={item.title}
          emoji={item.icon}
          className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24"
        />
      </div>

      <strong className="ni-option-title">{item.title}</strong>

      {isGazed && (
        <div className="ni-tile-progress">
          <div className="ni-tile-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </button>
  );
}

// ─── Category Subpage Screen ───────────────────────────────────────────────
function CategoryScreen({
  domainId,
  path,
  onOption,
  gazeEnabled,
  startDwell,
  clearDwell,
  activeGazeId,
  progressPct,
  isSpeakingPreview,
  onRepeatPreview,
  onStopPreview,
}) {
  const current = path[path.length - 1];
  const isCompactGrid = current.children.length > 6;

  return (
    <div className="ni-subpage">
      <div className="ni-subpage-header">
        <div className="ni-subpage-heading-group">
          <CategoryIllustration id={domainId} className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
          <h2 className="ni-subpage-title">{current.title}</h2>
        </div>

        <div className="ni-subpage-voice-control">
          {isSpeakingPreview && (
            <span className="ni-voice-active-pill" role="status">
              <svg className="w-3 h-3 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 5L6 9H2v6h4l5 4V5z" fill="#C7D2FE" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" />
              </svg>
              <span>Speaking choices…</span>
            </span>
          )}
          <button
            className="ni-voice-mini-btn"
            onClick={onRepeatPreview}
            data-gaze-id="voice-repeat-preview"
            title="Repeat spoken options aloud"
          >
            🔁 Repeat
          </button>
          {isSpeakingPreview && (
            <button
              className="ni-voice-mini-btn"
              onClick={onStopPreview}
              data-gaze-id="voice-stop-preview"
              title="Stop speaking"
            >
              ⏹ Stop
            </button>
          )}
        </div>
      </div>

      <div className={`ni-subpage-options-grid subpage-${domainId} ${isCompactGrid ? "is-compact-grid" : ""}`}>
        {current.children.map((item, i) => {
          const gid = `opt-${current.title}-${i}`;
          return (
            <OptionTile
              key={i}
              domainId={domainId}
              item={item}
              onClick={() => onOption(item)}
              gazeEnabled={gazeEnabled}
              startDwell={startDwell}
              clearDwell={clearDwell}
              isGazed={activeGazeId === gid}
              progressPct={progressPct}
              gazeId={gid}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Context-Sensitive Pain Details Screen ─────────────────────────────────
function PainDetailsScreen({ painNode, onConfirmSelection, onBack, gazeEnabled, startDwell, clearDwell, activeGazeId }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedSeverity, setSelectedSeverity] = useState(null);

  const canConfirm = selectedType && selectedSeverity;
  const compositeMessage = canConfirm
    ? `I have ${selectedSeverity.toLowerCase()} ${selectedType.toLowerCase()} pain in my ${painNode.place.toLowerCase()}.`
    : null;

  return (
    <div className="ni-subpage">
      <div className="ni-subpage-header">
        <div className="ni-subpage-heading-group">
          <CategoryIllustration id="pain" className="w-7 h-7 shrink-0" />
          <h2 className="ni-subpage-title">{painNode.place} Pain</h2>
        </div>
      </div>

      <div className="ni-pain-workspace">
        <div className="ni-pain-section-card">
          <h3 className="ni-pain-section-title">1. Sensation</h3>
          <div className="ni-chips-wrap">
            {painNode.types.map((type) => {
              const gid = `pain-type-${type}`;
              const isSelected = selectedType === type;
              const isGazed = activeGazeId === gid;
              return (
                <button
                  key={type}
                  className={`ni-pain-chip ${isSelected ? "is-selected" : ""} ${isGazed ? "is-gazed" : ""}`}
                  onClick={() => setSelectedType(type)}
                  data-gaze-id={gid}
                  onMouseEnter={() => gazeEnabled && startDwell(gid)}
                  onMouseLeave={() => gazeEnabled && clearDwell()}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ni-pain-section-card">
          <h3 className="ni-pain-section-title">2. Severity</h3>
          <div className="ni-severity-trio">
            {["Mild", "Moderate", "Severe"].map((sev) => {
              const gid = `pain-sev-${sev}`;
              const isSelected = selectedSeverity === sev;
              const isGazed = activeGazeId === gid;
              const emoji = sev === "Mild" ? "🙂" : sev === "Moderate" ? "😣" : "😫";
              return (
                <button
                  key={sev}
                  className={`ni-severity-card ${isSelected ? "is-selected" : ""} ${isGazed ? "is-gazed" : ""}`}
                  onClick={() => setSelectedSeverity(sev)}
                  data-gaze-id={gid}
                  onMouseEnter={() => gazeEnabled && startDwell(gid)}
                  onMouseLeave={() => gazeEnabled && clearDwell()}
                >
                  <span className="text-2xl sm:text-3xl">{emoji}</span>
                  <span>{sev}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex gap-3 pt-2">
            <button
              className="ni-primary-btn flex-1 justify-center disabled:opacity-40"
              disabled={!canConfirm}
              data-gaze-id="pain-confirm-btn"
              onClick={() =>
                onConfirmSelection({
                  title: `${painNode.place} Pain`,
                  icon: painNode.icon,
                  message: compositeMessage,
                })
              }
            >
              ✅ Speak Pain
            </button>
            <button className="ni-secondary-btn" data-gaze-id="pain-back-btn" onClick={onBack}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Urgent Difficulty Breathing Screen ────────────────────────────────────
function DifficultyBreathingScreen({ onSelectUrgent, onBack }) {
  return (
    <div className="ni-subpage">
      <div className="ni-subpage-header border-red-200 bg-red-50">
        <div className="ni-subpage-heading-group">
          <span className="text-2xl">🌬️</span>
          <h2 className="ni-subpage-title text-red-700">Breathing Difficulty — Urgent</h2>
        </div>
      </div>

      <div className="ni-urgent-breathing-tray">
        <button
          className="ni-big-urgent-action ni-action-breathing"
          data-gaze-id="urgent-breathing-btn"
          onClick={() =>
            onSelectUrgent({
              title: "Difficulty Breathing",
              icon: "🌬️",
              message: "I am having difficulty breathing.",
            })
          }
        >
          <span className="text-3xl">🌬️</span>
          <span>I am having difficulty breathing.</span>
        </button>

        <button
          className="ni-big-urgent-action ni-action-emergency"
          data-gaze-id="urgent-help-now-btn"
          onClick={() =>
            onSelectUrgent({
              title: "Urgent Help Needed",
              icon: "🚨",
              message: "I need urgent help right now. Please come immediately.",
            })
          }
        >
          <span className="text-3xl">🚨</span>
          <span>I need urgent help right now!</span>
        </button>

        <button className="ni-secondary-btn self-center mt-2" data-gaze-id="urgent-back-btn" onClick={onBack}>
          ← Back to Categories
        </button>
      </div>
    </div>
  );
}

// ─── Concise Picture-First Confirmation Screen ─────────────────────────────
function MessagePreviewScreen({ selection, onConfirm, onCancel, activeGazeId }) {
  return (
    <div className="ni-dialog-screen">
      <div className="ni-dialog-card">
        <div className="ni-dialog-icon" aria-hidden="true">{selection.icon || "💬"}</div>
        <h3 className="ni-dialog-title">{selection.title || selection.label}</h3>
        <p className="ni-dialog-status">Ready to speak</p>
        <div className="ni-dialog-actions">
          <button
            className={`ni-primary-btn ${activeGazeId === "dialog-speak-btn" ? "is-gazed" : ""}`}
            data-gaze-id="dialog-speak-btn"
            onClick={onConfirm}
            aria-label={`Speak ${selection.title || selection.label}`}
          >
            <span aria-hidden="true">🔊</span> Speak
          </button>
          <button
            className={`ni-secondary-btn ${activeGazeId === "dialog-cancel-btn" ? "is-gazed" : ""}`}
            data-gaze-id="dialog-cancel-btn"
            onClick={onCancel}
          >
            ← Change
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmedScreen({ selection, onHome, onRepeat, activeGazeId }) {
  return (
    <div className="ni-dialog-screen">
      <div className="ni-dialog-card">
        <div className="ni-dialog-success" aria-hidden="true">✓</div>
        <h3 className="ni-dialog-title">{selection.title || selection.label}</h3>
        <p className="ni-dialog-status is-success">Spoken</p>
        <div className="ni-dialog-actions">
          <button
            className={`ni-primary-btn ${activeGazeId === "confirmed-repeat-btn" ? "is-gazed" : ""}`}
            data-gaze-id="confirmed-repeat-btn"
            onClick={onRepeat}
          >
            <span aria-hidden="true">🔊</span> Repeat
          </button>
          <button
            className={`ni-secondary-btn ${activeGazeId === "confirmed-home-btn" ? "is-gazed" : ""}`}
            data-gaze-id="confirmed-home-btn"
            onClick={onHome}
          >
            ⌂ Home
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Screen ───────────────────────────────────────────────────────
function SettingsScreen({ soundEnabled, setSoundEnabled, dwellMs, setDwellMs, onClose }) {
  return (
    <div className="ni-subpage">
      <div className="ni-subpage-header">
        <h2 className="ni-subpage-title">Settings &amp; Calibration</h2>
      </div>

      <div className="ni-settings-container">
        <div className="ni-settings-row">
          <div>
            <strong className="text-base block text-slate-800">Voice Output &amp; Spoken Guidance</strong>
            <span className="text-xs text-slate-500">Voice guidance</span>
          </div>
          <div
            className={`ni-switch-track ${soundEnabled ? "is-on" : ""}`}
            role="switch"
            aria-checked={soundEnabled}
            tabIndex={0}
            data-gaze-id="settings-toggle-sound"
            onClick={() => setSoundEnabled((v) => !v)}
            onKeyDown={(e) => e.key === " " && setSoundEnabled((v) => !v)}
          >
            <span className="ni-switch-thumb" />
          </div>
        </div>

        <div className="ni-settings-row">
          <div>
            <strong className="text-base block text-slate-800">Eye-Gaze Dwell Duration</strong>
            <span className="text-xs text-slate-500">Hold gaze duration to trigger selection ({dwellMs} ms)</span>
          </div>
          <input
            type="range"
            min={500}
            max={3000}
            step={100}
            value={dwellMs}
            onChange={(e) => setDwellMs(Number(e.target.value))}
            className="w-32 accent-indigo-600 cursor-pointer"
            aria-label="Dwell duration in milliseconds"
          />
        </div>
      </div>

      <div className="flex justify-center mt-2">
        <button className="ni-primary-btn" data-gaze-id="settings-close-btn" onClick={onClose}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Dedicated Compact Navigation & Controls Bar ──────────────────────────
function BottomNav({
  onHome,
  onBack,
  onSOS,
  currentScreen,
  gazeEnabled,
  onToggleGaze,
  gazeStatus,
  onSettings,
  activeGazeId,
}) {
  const isGazeActive = gazeEnabled && gazeStatus === "active";

  return (
    <footer className="ni-bottom-bar" aria-label="Main navigation and controls">
      <div className="ni-nav-group">
        <button
          className={`ni-nav-pill-btn ${currentScreen === "home" ? "is-active" : ""} ${
            activeGazeId === "nav-home-btn" ? "is-gazed" : ""
          }`}
          data-gaze-id="nav-home-btn"
          onClick={onHome}
          aria-label="Navigate to Home dashboard"
        >
          <span>⌂</span>
          <span>Home</span>
        </button>

        <button
          className={`ni-nav-pill-btn ${activeGazeId === "nav-back-btn" ? "is-gazed" : ""}`}
          data-gaze-id="nav-back-btn"
          onClick={onBack}
          aria-label="Go back one screen"
        >
          <span>←</span>
          <span>Back</span>
        </button>
      </div>

      {/* Center Utility Controls: Gaze Toggle & Settings */}
      <div className="flex items-center gap-2">
        <button
          className={`ni-action-icon-btn ${gazeEnabled ? "is-active" : ""}`}
          onClick={onToggleGaze}
          title={gazeEnabled ? "Disable Eye-Gaze Tracking" : "Enable Eye-Gaze Tracking"}
          aria-label={gazeEnabled ? "Disable Eye-Gaze Tracking" : "Enable Eye-Gaze Tracking"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isGazeActive ? "bg-emerald-500 animate-pulse" : gazeEnabled ? "bg-amber-500" : "bg-slate-400"
            }`}
          />
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" fill={gazeEnabled ? "#10B981" : "none"} />
          </svg>
          <span className="font-bold text-xs sm:text-sm">
            {isGazeActive ? "Gaze ON" : gazeStatus === "calibrating" ? "Calibrating..." : "Eye Gaze"}
          </span>
        </button>

        <button
          className="ni-settings-btn"
          data-gaze-id="nav-settings-btn"
          onClick={onSettings}
          title="Display & Sound Settings"
          aria-label="Display and Sound Settings"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {/* Immediate Emergency SOS Action */}
      <button
        className={`ni-sos-urgent-btn ${activeGazeId === "nav-sos-btn" ? "is-gazed" : ""}`}
        data-gaze-id="nav-sos-btn"
        onClick={onSOS}
        aria-label="Urgent Assistance SOS"
      >
        <span>🚨</span>
        <span>Urgent Help</span>
      </button>
    </footer>
  );
}

// ─── Master Application Root ───────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [domainId, setDomainId] = useState(null);
  const [path, setPath] = useState([]);
  const [selection, setSelection] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dwellMs, setDwellMs] = useState(1500);
  // HANDS-FREE DEFAULT: Start with Eye Gaze Enabled automatically!
  const [gazeEnabled, setGazeEnabled] = useState(true);
  const [gazePoint, setGazePoint] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [voicePreviewSpeaking, setVoicePreviewSpeaking] = useState(false);
  const [activePainNode, setActivePainNode] = useState(null);
  const lastVisitedDomain = useRef(null);

  const { speak, cancel: cancelSpeech } = useSpeech(soundEnabled);

  // Universal Dwell & Long-Blink Trigger Handler (Clicks ANY [data-gaze-id] element across all screens!)
  const handleDwellTrigger = useCallback(
    (id) => {
      if (!id) return;
      if (id.startsWith("tile-")) {
        const did = id.replace("tile-", "");
        if (lastVisitedDomain.current === did) return;
        lastVisitedDomain.current = did;
        activateDomain(did);
      } else if (id.startsWith("quick-")) {
        const qid = id.replace("quick-", "");
        const qr = quickResponses.find((q) => q.id === qid);
        if (qr) handleQuickResponse(qr);
      } else {
        // Automatically click subpage options, pain chips, dialog buttons, and bottom nav buttons!
        const el = document.querySelector(`[data-gaze-id="${id}"]`);
        if (el && !el.disabled) {
          el.click();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [soundEnabled, dwellMs, path, domainId, screen, selection]
  );

  const { startDwell, clearDwell, activeGazeId, progressPct } = useGazeDwell({
    enabled: gazeEnabled,
    dwellMs,
    onDwell: handleDwellTrigger,
  });

  const handleGazeCoordinates = useCallback(
    (x, y) => {
      setGazePoint({ x, y });
      const targetId = findElementUnderGaze(x, y);
      if (targetId) {
        startDwell(targetId);
      } else {
        clearDwell();
      }
    },
    [startDwell, clearDwell]
  );

  // Intentional Long-Blink (450ms) immediately selects whatever button the user is looking at
  const handleLongBlink = useCallback(
    (x, y) => {
      const targetId = findElementUnderGaze(x, y);
      if (targetId) {
        clearDwell();
        handleDwellTrigger(targetId);
      }
    },
    [clearDwell, handleDwellTrigger]
  );

  const { status: gazeStatus, calProgress, videoRef } = useMediaPipeGaze({
    gazeEnabled,
    onGazePoint: handleGazeCoordinates,
    onLongBlink: handleLongBlink,
  });

  useEffect(() => {
    lastVisitedDomain.current = null;
  }, [screen]);

  // Navigation handlers
  const navigateHome = () => {
    cancelSpeech();
    setVoicePreviewSpeaking(false);
    setScreen("home");
    setDomainId(null);
    setPath([]);
    setSelection(null);
    setActivePainNode(null);
    clearDwell();
  };

  const navigateBack = () => {
    cancelSpeech();
    setVoicePreviewSpeaking(false);
    clearDwell();

    if (["settings", "preview", "confirmed"].includes(screen)) {
      domainId ? setScreen("domain") : navigateHome();
      return;
    }
    if (screen === "pain" || screen === "breathing") {
      setScreen("domain");
      return;
    }
    if (screen === "domain") {
      if (path.length > 1) {
        setPath(path.slice(0, -1));
      } else {
        navigateHome();
      }
      return;
    }
    navigateHome();
  };

  const activateDomain = (id) => {
    const item = tree[id];
    if (!item) return;

    cancelSpeech();
    setDomainId(id);
    setPath([item]);
    setScreen("domain");

    if (soundEnabled && item.voicePreview) {
      setVoicePreviewSpeaking(true);
      speak(item.voicePreview, () => {
        setVoicePreviewSpeaking(false);
      });
    } else {
      setVoicePreviewSpeaking(false);
    }
  };

  const stopVoicePreview = () => {
    cancelSpeech();
    setVoicePreviewSpeaking(false);
  };

  const repeatVoicePreview = () => {
    const item = tree[domainId];
    if (!item?.voicePreview) return;
    cancelSpeech();
    setVoicePreviewSpeaking(true);
    speak(item.voicePreview, () => {
      setVoicePreviewSpeaking(false);
    });
  };

  const handleOptionSelect = (item) => {
    cancelSpeech();
    setVoicePreviewSpeaking(false);

    if (item.isDifficultyBreathing) {
      setScreen("breathing");
      return;
    }
    if (item.isPainLocation) {
      setActivePainNode(item);
      setScreen("pain");
      return;
    }
    if (item.children) {
      setPath([...path, item]);
      return;
    }
    setSelection(item);
    setScreen("preview");
    speak(item.message);
  };

  const handleQuickResponse = (qr) => {
    cancelSpeech();
    setVoicePreviewSpeaking(false);
    setSelection(qr);
    setScreen("preview");
    speak(qr.message);
  };

  const handleConfirmAndSpeak = () => {
    speak(selection.message);
    setScreen("confirmed");
  };

  const handleSOSUrgent = () => {
    cancelSpeech();
    setVoicePreviewSpeaking(false);
    setDomainId("help");
    setPath([tree.help]);
    setScreen("domain");
  };

  // Screen routing
  let screenContent;
  const isMessageFlowScreen = screen === "preview" || screen === "confirmed";

  if (screen === "home") {
    screenContent = (
      <HomeScreen
        onSelectDomain={activateDomain}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
        progressPct={progressPct}
      />
    );
  } else if (screen === "settings") {
    screenContent = (
      <SettingsScreen
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        dwellMs={dwellMs}
        setDwellMs={setDwellMs}
        onClose={navigateBack}
      />
    );
  } else if (screen === "preview") {
    screenContent = (
      <MessagePreviewScreen
        selection={selection}
        onConfirm={handleConfirmAndSpeak}
        onCancel={navigateBack}
        activeGazeId={activeGazeId}
      />
    );
  } else if (screen === "confirmed") {
    screenContent = (
      <ConfirmedScreen
        selection={selection}
        onHome={navigateHome}
        onRepeat={handleConfirmAndSpeak}
        activeGazeId={activeGazeId}
      />
    );
  } else if (screen === "pain") {
    screenContent = (
      <PainDetailsScreen
        painNode={activePainNode}
        onConfirmSelection={(item) => {
          setSelection(item);
          setScreen("preview");
          speak(item.message);
        }}
        onBack={navigateBack}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
      />
    );
  } else if (screen === "breathing") {
    screenContent = (
      <DifficultyBreathingScreen
        onSelectUrgent={(item) => {
          setSelection(item);
          setScreen("preview");
          speak(item.message);
        }}
        onBack={navigateBack}
      />
    );
  } else if (screen === "domain") {
    screenContent = (
      <CategoryScreen
        domainId={domainId}
        path={path}
        onOption={handleOptionSelect}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
        progressPct={progressPct}
        isSpeakingPreview={voicePreviewSpeaking}
        onRepeatPreview={repeatVoicePreview}
        onStopPreview={stopVoicePreview}
      />
    );
  } else {
    screenContent = (
      <HomeScreen
        onSelectDomain={activateDomain}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
        progressPct={progressPct}
      />
    );
  }

  return (
    <>
      {/* Hidden/Mini Webcam Feed for MediaPipe Iris Tracking */}
      {gazeEnabled && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "fixed",
            bottom: "68px",
            right: "16px",
            width: "140px",
            height: "105px",
            objectFit: "cover",
            transform: "scaleX(-1)",
            borderRadius: "12px",
            border: "2px solid #10B981",
            zIndex: 9998,
            pointerEvents: "none",
            opacity: 0.85,
          }}
        />
      )}

      {/* 3-Second Hands-Free Startup Auto-Calibration Overlay */}
      {gazeEnabled && gazeStatus === "calibrating" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.88)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            textAlign: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#10B981",
              boxShadow: "0 0 25px #10B981",
              marginBottom: "20px",
            }}
          />
          <h2 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>
            Hands-Free Auto Calibration ({calProgress}%)
          </h2>
          <p style={{ fontSize: "18px", color: "#cbd5e1", maxWidth: "460px" }}>
            Just look at the green dot in the center of the screen for 3 seconds. No clicking needed.
          </p>
        </div>
      )}

      {/* Eye Gaze Cursor Marker */}
      {gazeEnabled && gazeStatus === "active" && (
        <div
          className="ni-eyegaze-point"
          style={{ left: gazePoint.x, top: gazePoint.y }}
          aria-hidden="true"
        />
      )}

      {/* Viewport Top Ambient Dwell Indicator */}
      <div className="ni-dwell-line" aria-hidden="true">
        <div className="ni-dwell-line-bar" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="ni-viewport">
        <div className="ni-communication-area">
          {/* Primary Interactive Workspace — Maximized for Pictures */}
          <main className="ni-workspace">{screenContent}</main>

          {/* High-visibility quick communication actions */}
          {!isMessageFlowScreen && screen !== "settings" && (
            <QuickResponsesDeck
              onSelect={handleQuickResponse}
              gazeEnabled={gazeEnabled}
              startDwell={startDwell}
              clearDwell={clearDwell}
              activeGazeId={activeGazeId}
              progressPct={progressPct}
            />
          )}
        </div>

        {/* Navigation and gaze controls */}
        <BottomNav
          onHome={navigateHome}
          onBack={navigateBack}
          onSOS={handleSOSUrgent}
          currentScreen={screen}
          gazeEnabled={gazeEnabled}
          onToggleGaze={() => setGazeEnabled((v) => !v)}
          gazeStatus={gazeStatus}
          onSettings={() => setScreen("settings")}
          activeGazeId={activeGazeId}
        />
      </div>
    </>
  );
}