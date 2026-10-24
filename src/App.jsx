import React, { useRef, useState, useCallback, useEffect } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { tree, quickResponses } from "./data";
import { CategoryIllustration, QuickResponseGlyph, OptionArt } from "./illustrations";
import "./styles.css";

// ─── Web Speech API Hook ───────────────────────────────────────────────────
function useSpeech(enabled) {
  const utteranceRef = useRef(null);
  const requestRef = useRef(0);
  const voiceRef = useRef(null);

  const selectVoice = useCallback((voices) => {
    const englishVoices = voices.filter(voice => voice.lang?.toLowerCase().startsWith("en"));
    const indianVoices = englishVoices.filter(voice => {
      const lang = voice.lang.toLowerCase();
      const name = voice.name.toLowerCase();
      return lang === "en-in" || name.includes("india") || name.includes("indian");
    });

    // Prefer an actual Indian English voice; the remaining choices are
    // deterministic English fallbacks when the browser does not provide one.
    voiceRef.current =
      indianVoices[0] ||
      englishVoices.find(voice => ["en-gb", "en-au", "en-ca"].includes(voice.lang.toLowerCase())) ||
      englishVoices.find(voice => voice.lang.toLowerCase() !== "en-us") ||
      englishVoices.find(voice => voice.lang.toLowerCase() === "en-us") ||
      null;
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;

    const loadVoices = () => selectVoice(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, [selectVoice]);

  const cancel = useCallback(() => {
    requestRef.current += 1;
    utteranceRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (text, onEnd) => {
      if (!enabled || !("speechSynthesis" in window)) { onEnd?.(); return; }
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      window.speechSynthesis.cancel();
      if (!voiceRef.current) selectVoice(window.speechSynthesis.getVoices());
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 1.0;
      if (voiceRef.current) u.voice = voiceRef.current;
      utteranceRef.current = u;
      const finish = () => {
        if (requestRef.current !== requestId || utteranceRef.current !== u) return;
        utteranceRef.current = null;
        onEnd?.();
      };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
    },
    [enabled, selectVoice]
  );
  return { speak, cancel };
}

// ─── Dwell Selection Hook with Cooldown Lock ───────────────────────────────
function useGazeDwell({ enabled, dwellMs, onDwell }) {
  const dwellRef   = useRef(null);
  const curTarget  = useRef(null);
  const lockRef    = useRef(null);
  const lockTimer  = useRef(null);
  const triggeredRef = useRef(null);
  const [activeGazeId, setActiveGazeId] = useState(null);
  const [progressPct, setProgressPct]   = useState(0);
  const LOCK_MS = 900;

  const clearDwell = useCallback(() => {
    if (dwellRef.current) { clearInterval(dwellRef.current); dwellRef.current = null; }
    curTarget.current = null;
    setActiveGazeId(null);
    setProgressPct(0);
    triggeredRef.current = null;
  }, []);

  const startDwell = useCallback((id) => {
    if (!enabled) return;
    if (lockRef.current === id) return;
    if (triggeredRef.current === id) return;
    if (curTarget.current === id) return;
    clearDwell();
    curTarget.current = id;
    setActiveGazeId(id);
    const t0 = Date.now();
    dwellRef.current = setInterval(() => {
      const elapsed = Date.now() - t0;
      setProgressPct(Math.min(100, (elapsed / dwellMs) * 100));
      if (elapsed >= dwellMs) {
        clearDwell();
        triggeredRef.current = id;
        lockRef.current = id;
        if (lockTimer.current) clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => { lockRef.current = null; }, LOCK_MS);
        onDwell(id);
      }
    }, 30);
  }, [enabled, dwellMs, clearDwell, onDwell]);

  const resetLock = useCallback(() => {
    lockRef.current = null;
    triggeredRef.current = null;
    if (lockTimer.current) clearTimeout(lockTimer.current);
  }, []);

  return { startDwell, clearDwell, activeGazeId, progressPct, resetLock };
}

// ─── MediaPipe Gaze Hook with Jitter Reduction & Center Calibration ────────
function useMediaPipeGaze({ gazeEnabled, onGazePoint, onLongBlink }) {
  const [status, setStatus]           = useState("idle");
  const [calProgress, setCalProgress] = useState(0);
  const [calCount, setCalCount]       = useState(0);
  const videoRef  = useRef(null);
  const onGazeRef = useRef(onGazePoint);
  const onBlinkRef= useRef(onLongBlink);

  useEffect(() => {
    onGazeRef.current  = onGazePoint;
    onBlinkRef.current = onLongBlink;
  }, [onGazePoint, onLongBlink]);

  const recalibrate = useCallback(() => {
    setStatus("calibrating");
    setCalProgress(0);
    setCalCount(c => c + 1);
  }, []);

  useEffect(() => {
    if (!gazeEnabled) {
      setStatus("idle");
      setCalProgress(0);
      return;
    }

    let landmarker = null, raf = null, stream = null, cancelled = false;

    // Landmark IDs for both eyes
    const R_OUTER=33, R_INNER=133, R_TOP=159, R_BOT=145, R_IRIS=468;
    const L_INNER=362, L_OUTER=263, L_TOP=386, L_BOT=374,  L_IRIS=473;

    const BLINK_THRESH  = 0.20;
    const LONG_BLINK_MS = 450;
    const BLINK_COOL    = 2200;

    const CAL_DURATION_MS = 3200;
    let calibrated = false;
    let calStart = null;
    let calSamplesH = [];
    let calSamplesV = [];

    let centerH = 0.5;
    let centerV = 0.0;

    // Physiological scale multipliers
    const SCALE_H = 7.5;
    const SCALE_V = 8.5;

    // Dual-stage filtering values:
    // Stage 1: Raw ratio low-pass filter
    let rawFilteredH = 0.5;
    let rawFilteredV = 0.0;
    let rawInitialized = false;

    // Stage 2: Smoothed screen coordinates
    let smoothX = window.innerWidth / 2;
    let smoothY = window.innerHeight / 2;
    let blinkStart = null, lastBlink = 0;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const getH = (mesh, li, ri, iris) => {
      const pL = { x: 1 - mesh[li].x, y: mesh[li].y };
      const pR = { x: 1 - mesh[ri].x, y: mesh[ri].y };
      const pI = { x: 1 - mesh[iris].x, y: mesh[iris].y };
      const vx = pR.x - pL.x, vy = pR.y - pL.y;
      const ix = pI.x - pL.x, iy = pI.y - pL.y;
      return (ix * vx + iy * vy) / (vx * vx + vy * vy + 1e-9);
    };

    const getV = (mesh, ci, oi, iris, eyeW) => {
      const midY = (mesh[ci].y + mesh[oi].y) * 0.5;
      return (mesh[iris].y - midY) / (eyeW + 1e-9);
    };

    function median(arr) {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    }

    async function init() {
      try {
        setStatus("starting");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        if (cancelled) return;
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
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            if (!cancelled) {
              setStatus("calibrating");
              tick();
            }
          };
        }
      } catch (e) {
        console.error("MediaPipe Gaze Error:", e);
        setStatus("denied");
      }
    }

    function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && landmarker && video.readyState >= 2) {
        const now = performance.now();
        const res = landmarker.detectForVideo(video, now);

        if (res.faceLandmarks?.length > 0) {
          const mesh = res.faceLandmarks[0];

          const wR = dist(mesh[R_OUTER], mesh[R_INNER]);
          const wL = dist(mesh[L_INNER], mesh[L_OUTER]);
          const earR = dist(mesh[R_TOP], mesh[R_BOT]) / (wR + 1e-9);
          const earL = dist(mesh[L_TOP], mesh[L_BOT]) / (wL + 1e-9);
          const ear  = (earR + earL) * 0.5;

          const rawH = (getH(mesh, R_INNER, R_OUTER, R_IRIS) + getH(mesh, L_OUTER, L_INNER, L_IRIS)) * 0.5;
          const rawV = (getV(mesh, R_INNER, R_OUTER, R_IRIS, wR) + getV(mesh, L_OUTER, L_INNER, L_IRIS, wL)) * 0.5;

          if (!calibrated) {
            if (!calStart) calStart = now;
            const elapsed = now - calStart;
            const pct = Math.min(100, Math.round((elapsed / CAL_DURATION_MS) * 100));
            setCalProgress(pct);

            if (ear >= BLINK_THRESH) {
              calSamplesH.push(rawH);
              calSamplesV.push(rawV);
            }

            if (elapsed >= CAL_DURATION_MS) {
              if (calSamplesH.length >= 10) {
                centerH = median(calSamplesH);
                centerV = median(calSamplesV);
                rawFilteredH = centerH;
                rawFilteredV = centerV;
                rawInitialized = true;
                calibrated = true;
                setStatus("active");
                smoothX = window.innerWidth / 2;
                smoothY = window.innerHeight / 2;
              } else {
                calStart = null;
                calSamplesH = [];
                calSamplesV = [];
              }
            }
          } else {
            if (ear < BLINK_THRESH) {
              if (!blinkStart) blinkStart = now;
              else if (now - blinkStart >= LONG_BLINK_MS && now - lastBlink > BLINK_COOL) {
                lastBlink = now;
                blinkStart = null;
                onBlinkRef.current?.(smoothX, smoothY);
              }
            } else {
              blinkStart = null;

              // Stage 1: Pre-filter raw eye ratios to eliminate high-frequency camera noise
              if (!rawInitialized) {
                rawFilteredH = rawH;
                rawFilteredV = rawV;
                rawInitialized = true;
              } else {
                rawFilteredH = 0.28 * rawH + 0.72 * rawFilteredH;
                rawFilteredV = 0.28 * rawV + 0.72 * rawFilteredV;
              }

              // Stage 2: Center-anchored linear projection
              const normX = Math.max(0.02, Math.min(0.98, 0.5 + (rawFilteredH - centerH) * SCALE_H));
              const normY = Math.max(0.02, Math.min(0.98, 0.5 + (rawFilteredV - centerV) * SCALE_V));

              const targetX = normX * window.innerWidth;
              const targetY = normY * window.innerHeight;

              const dx = targetX - smoothX;
              const dy = targetY - smoothY;
              const distMove = Math.hypot(dx, dy);

              // Stage 3: Adaptive low-pass smoothing
              // Fixation (<12px): heavy damping so pointer is steady on card
              // Saccade (>60px): rapid acceleration to avoid sluggish lag
              let alpha;
              if (distMove < 12) {
                alpha = 0.12;
              } else if (distMove < 60) {
                alpha = 0.28;
              } else {
                alpha = 0.62;
              }

              smoothX += alpha * dx;
              smoothY += alpha * dy;

              onGazeRef.current?.(smoothX, smoothY);
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }

    init();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (landmarker) landmarker.close();
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [gazeEnabled, calCount]);

  return { status, calProgress, recalibrate, videoRef };
}

// ─── Center Calibration Overlay ────────────────────────────────────────────
function CenterCalibrationOverlay({ calProgress }) {
  return (
    <div className="ni-cal-overlay">
      <div className="ni-cal-target-wrap">
        <div className="ni-cal-ring" />
        <div className="ni-cal-ring-inner" />
        <div className="ni-cal-dot" />
      </div>

      <div className="ni-cal-card">
        <h2 className="ni-cal-title">Look at the Green Dot</h2>
        <p className="ni-cal-subtitle">
          Keep your gaze relaxed at the center dot to calibrate ({calProgress}%)
        </p>
        <div className="ni-cal-bar-track">
          <div className="ni-cal-bar-fill" style={{ width: `${calProgress}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Target Detection with Hysteresis (Sticky Target Selection) ────────────
const HIT_PAD = 10;
const HYSTERESIS_PAD = 20;

function findElementUnderGaze(x, y, activeId) {
  // If there's an active target, test it first with expanded hysteresis padding
  if (activeId) {
    const activeEl = document.querySelector(`[data-gaze-id="${activeId}"]`);
    if (activeEl && !activeEl.disabled) {
      const r = activeEl.getBoundingClientRect();
      if (
        x >= r.left - HYSTERESIS_PAD && x <= r.right + HYSTERESIS_PAD &&
        y >= r.top - HYSTERESIS_PAD && y <= r.bottom + HYSTERESIS_PAD
      ) {
        return activeId; // Retain active target
      }
    }
  }

  // Prefer exact visible bounds and the smallest target when padded regions
  // overlap. This prevents a large neighboring card from winning over a
  // smaller primary action such as Speak Now.
  const targets = document.querySelectorAll("[data-gaze-id]");
  let exactTarget = null;
  let exactArea = Infinity;
  let paddedTarget = null;
  let paddedDist = Infinity;

  for (const el of targets) {
    if (el.disabled) continue;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    const isExact = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    if (isExact && area < exactArea) {
      exactArea = area;
      exactTarget = el.dataset.gazeId;
    }
    if (x >= r.left - HIT_PAD && x <= r.right + HIT_PAD &&
        y >= r.top - HIT_PAD && y <= r.bottom + HIT_PAD) {
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < paddedDist) {
        paddedDist = d;
        paddedTarget = el.dataset.gazeId;
      }
    }
  }
  return exactTarget || paddedTarget;
}

// ─── Inline Dwell Progress Bar ─────────────────────────────────────────────
function DwellBar({ pct, color = "#4F46E5" }) {
  return (
    <div className="ni-dwell-bar-track" aria-hidden="true">
      <div className="ni-dwell-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Category Tile (Home Screen) ───────────────────────────────────────────
function CategoryTile({ id, item, onClick, gazeEnabled, startDwell, clearDwell, isGazed, progressPct, className = "" }) {
  const gid = `tile-${id}`;
  return (
    <button
      className={`ni-tile tile-${id} ${className} ${isGazed ? "is-gazed" : ""}`}
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
      {isGazed && <DwellBar pct={progressPct} />}
    </button>
  );
}

// ─── Multi-Page Home Dashboard ─────────────────────────────────────────────
// Page 1: Most Needed ⭐, Water 💧, Food 🍽️, Bathroom 🚻, Pain 🌡️, Feeling Unwell 🤒 + Next Page ➡️ (spans 2 cols)
// Page 2: Health & Care 💊, Comfort 🛏️, Talk to People 💬, Help 🆘, Other ⋯ (spans 2 cols) + Previous Page ⬅️ (spans 2 cols)
function HomeScreen({ onSelectDomain, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct, page, setPage }) {
  const nextGid = "home-page-next";
  const prevGid = "home-page-prev";
  const isNextGazed = activeGazeId === nextGid;
  const isPrevGazed = activeGazeId === prevGid;

  const page1Ids = ["most_needed", "water", "food", "bathroom", "pain", "unwell"];
  const page2Ids = ["health", "comfort", "talk", "help"];

  return (
    <div className="ni-home-paged">
      {page === 0 ? (
        <div className="ni-category-grid-paged">
          {page1Ids.map((id) => (
            <CategoryTile
              key={id} id={id} item={tree[id]}
              onClick={() => onSelectDomain(id)}
              gazeEnabled={gazeEnabled}
              startDwell={startDwell} clearDwell={clearDwell}
              isGazed={activeGazeId === `tile-${id}`}
              progressPct={progressPct}
            />
          ))}

          {/* Large "Next Page →" Card directly inside the Page 1 Grid */}
          <button
            className={`ni-tile ni-tile-page-toggle ni-tile-page-next ${isNextGazed ? "is-gazed" : ""}`}
            data-gaze-id={nextGid}
            onClick={() => { setPage(1); clearDwell(); }}
            onMouseEnter={() => gazeEnabled && startDwell(nextGid)}
            onMouseLeave={() => gazeEnabled && clearDwell()}
            aria-label="Navigate to Page 2 of categories"
          >
            <div className="ni-tile-icon-container">
              <span className="text-4xl sm:text-5xl" aria-hidden="true">➡️</span>
            </div>
            <h2 className="ni-tile-title">Next Page →</h2>
            <span className="text-xs sm:text-sm text-indigo-700 font-bold">Health, Comfort, Talk, Help, Other</span>
            {isNextGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
          </button>
        </div>
      ) : (
        <div className="ni-category-grid-paged">
          {page2Ids.map((id) => (
            <CategoryTile
              key={id} id={id} item={tree[id]}
              onClick={() => onSelectDomain(id)}
              gazeEnabled={gazeEnabled}
              startDwell={startDwell} clearDwell={clearDwell}
              isGazed={activeGazeId === `tile-${id}`}
              progressPct={progressPct}
            />
          ))}

          {/* "Other" category tile spanning 2 columns in Row 2 */}
          <CategoryTile
            key="other" id="other" item={tree["other"]}
            onClick={() => onSelectDomain("other")}
            gazeEnabled={gazeEnabled}
            startDwell={startDwell} clearDwell={clearDwell}
            isGazed={activeGazeId === "tile-other"}
            progressPct={progressPct}
          />

          {/* Large "← Previous Page" Card directly inside the Page 2 Grid */}
          <button
            className={`ni-tile ni-tile-page-toggle ni-tile-page-prev ${isPrevGazed ? "is-gazed" : ""}`}
            data-gaze-id={prevGid}
            onClick={() => { setPage(0); clearDwell(); }}
            onMouseEnter={() => gazeEnabled && startDwell(prevGid)}
            onMouseLeave={() => gazeEnabled && clearDwell()}
            aria-label="Return to Page 1 of categories"
          >
            <div className="ni-tile-icon-container">
              <span className="text-4xl sm:text-5xl" aria-hidden="true">⬅️</span>
            </div>
            <h2 className="ni-tile-title">← Previous Page</h2>
            <span className="text-xs sm:text-sm text-indigo-700 font-bold">Most Needed, Water, Food, Bathroom, Pain...</span>
            {isPrevGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
          </button>
        </div>
      )}

      {/* Clean Status Indicator */}
      <div className="ni-home-pager">
        <span className="ni-pager-label">
          {page === 0 ? "Page 1 of 2 · Core Communication Categories" : "Page 2 of 2 · Care & Extended Categories"}
        </span>
      </div>
    </div>
  );
}

// ─── Option Tile (Subpage) ─────────────────────────────────────────────────
function OptionTile({ domainId, item, onClick, gazeEnabled, startDwell, clearDwell, isGazed, progressPct, gazeId }) {
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
        <OptionArt domainId={domainId} title={item.title} emoji={item.icon}
          className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24" />
      </div>
      <strong className="ni-option-title">{item.title}</strong>
      {isGazed && <DwellBar pct={progressPct} />}
    </button>
  );
}

// ─── Consistent Left Navigation Rail ───────────────────────────────────────
function LeftNavRail({ onBack, onHome, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct }) {
  const isBackGazed = activeGazeId === "side-back-btn";
  const isHomeGazed = activeGazeId === "side-home-btn";

  return (
    <aside className="ni-left-nav-rail" aria-label="Quick Navigation">
      <button
        className={`ni-nav-card ni-nav-card-back ${isBackGazed ? "is-gazed" : ""}`}
        data-gaze-id="side-back-btn"
        onClick={onBack}
        onMouseEnter={() => gazeEnabled && startDwell("side-back-btn")}
        onMouseLeave={() => gazeEnabled && clearDwell()}
        aria-label="Go back to previous screen"
      >
        <span className="text-3xl font-black">←</span>
        <span className="text-lg font-bold">Back</span>
        <span className="text-xs text-indigo-700 font-semibold">Previous</span>
        {isBackGazed && <DwellBar pct={progressPct} color="#4338CA" />}
      </button>

      <button
        className={`ni-nav-card ni-nav-card-home ${isHomeGazed ? "is-gazed" : ""}`}
        data-gaze-id="side-home-btn"
        onClick={onHome}
        onMouseEnter={() => gazeEnabled && startDwell("side-home-btn")}
        onMouseLeave={() => gazeEnabled && clearDwell()}
        aria-label="Return to main dashboard"
      >
        <span className="text-3xl font-black">⌂</span>
        <span className="text-lg font-bold">Home</span>
        <span className="text-xs text-slate-500 font-semibold">Dashboard</span>
        {isHomeGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
      </button>
    </aside>
  );
}

// ─── Paginated Category Subpage with Left Navigation Rail ──────────────────
// The first page has five options plus Next. Pages with two navigation cards
// use four options, keeping every page within a predictable six-card grid.
function buildPaginatedItems(items) {
  const pages = [];
  // Six cards fit the standard 2x3 grid without shrinking gaze targets.
  if (items.length <= 6) return [items];

  pages.push(items.slice(0, 5));
  for (let start = 5; start < items.length; start += 4) {
    pages.push(items.slice(start, start + 4));
  }
  return pages;
}

function CategoryScreen({
  domainId, path, onOption, onBack, onHome, gazeEnabled, startDwell, clearDwell,
  activeGazeId, progressPct, isSpeakingPreview, onRepeatPreview, onStopPreview,
}) {
  const [page, setPage] = useState(0);
  const current  = path[path.length - 1];
  const items    = current.children;
  const pages    = buildPaginatedItems(items);
  const total    = pages.length;
  const slice    = pages[Math.min(page, total - 1)] || [];

  useEffect(() => { setPage(0); }, [current.title]);

  const nextGid = "sub-page-next";
  const prevGid = "sub-page-prev";
  const isNextGazed = activeGazeId === nextGid;
  const isPrevGazed = activeGazeId === prevGid;

  return (
    <div className="ni-screen-with-sidebar">
      {/* Consistent Left Navigation Rail */}
      <LeftNavRail
        onBack={onBack}
        onHome={onHome}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
        progressPct={progressPct}
      />

      <div className="ni-screen-main-content">
        <div className="ni-subpage-header">
          <div className="ni-subpage-heading-group">
            <CategoryIllustration id={domainId} className="w-8 h-8 shrink-0" />
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
            <button className="ni-voice-mini-btn" onClick={onRepeatPreview}
              data-gaze-id="voice-repeat-preview"
              onMouseEnter={() => gazeEnabled && startDwell("voice-repeat-preview")}
              onMouseLeave={() => gazeEnabled && clearDwell()}
              title="Repeat spoken options aloud">🔁 Repeat</button>
            {isSpeakingPreview && (
              <button className="ni-voice-mini-btn" onClick={onStopPreview}
                data-gaze-id="voice-stop-preview"
                onMouseEnter={() => gazeEnabled && startDwell("voice-stop-preview")}
                onMouseLeave={() => gazeEnabled && clearDwell()}
                title="Stop speaking">⏹ Stop</button>
            )}
          </div>
        </div>

        {/* Communication options and in-grid pagination cards share one predictable target area. */}
        <div className="ni-subpage-options-grid">
          {slice.map((item, i) => {
            const gid = `opt-${current.title}-${page}-${i}`;
            return (
              <OptionTile key={gid} domainId={domainId} item={item}
                onClick={() => onOption(item)}
                gazeEnabled={gazeEnabled} startDwell={startDwell} clearDwell={clearDwell}
                isGazed={activeGazeId === gid} progressPct={progressPct} gazeId={gid}
              />
            );
          })}
          {total > 1 && page > 0 && (
            <button
              className={`ni-grid-pager-card ni-grid-pager-prev ${isPrevGazed ? "is-gazed" : ""}`}
              data-gaze-id={prevGid}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              onMouseEnter={() => gazeEnabled && startDwell(prevGid)}
              onMouseLeave={() => gazeEnabled && clearDwell()}
              aria-label="Previous options page"
            >
              <span className="ni-grid-pager-arrow">←</span>
              <strong>Previous Page</strong>
              {isPrevGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
            </button>
          )}
          {total > 1 && page < total - 1 && (
            <button
              className={`ni-grid-pager-card ni-grid-pager-next ${isNextGazed ? "is-gazed" : ""}`}
              data-gaze-id={nextGid}
              onClick={() => setPage(p => Math.min(total - 1, p + 1))}
              onMouseEnter={() => gazeEnabled && startDwell(nextGid)}
              onMouseLeave={() => gazeEnabled && clearDwell()}
              aria-label="Next options page"
            >
              <strong>Next Page</strong>
              <span className="ni-grid-pager-arrow">→</span>
              {isNextGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
            </button>
          )}
        </div>

        {/* Page status remains visible, while actions live in the content grid. */}
        {total > 1 && (
          <div className="ni-home-pager">
            <span className="ni-pager-label">{page + 1} / {total}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sensation Icon Map ────────────────────────────────────────────────────
const SENSATION_ICONS = {
  Throbbing: "💓",
  Sharp: "⚡",
  "Sharp pain": "⚡",
  Dull: "☁️",
  Pressure: "🧱",
  Burning: "🔥",
  Pain: "⚠️",
  Tightness: "🗜️",
  Discomfort: "😣",
  Cramping: "🌀",
  Cramps: "🌀",
  Bloating: "🎈",
  Aching: "🩹",
  Stiffness: "🪵",
  Numbness: "❄️",
  Tingling: "✨",
  Weakness: "🔋",
  Swelling: "🫧",
  "Other type": "❓",
};

// ─── Pain Details Screen with Left Navigation Rail ─────────────────────────
function PainDetailsScreen({ painNode, onConfirmSelection, onBack, onHome, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct }) {
  const [selType, setSelType]   = useState(null);
  const [selSev, setSelSev]     = useState(null);
  const [sensPage, setSensPage] = useState(0);

  const canConfirm = selType && selSev;
  const msg = canConfirm
    ? `I have ${selSev.toLowerCase()} ${selType.toLowerCase()} pain in my ${painNode.place.toLowerCase()}.`
    : null;

  const isConfirmGazed = activeGazeId === "pain-confirm-btn";

  // Sensation options use the same six-card grid pagination as categories.
  const allTypes = painNode.types || [];
  const sensationPages = buildPaginatedItems(allTypes);
  const totalSensPages = sensationPages.length;
  const visibleTypes = sensationPages[Math.min(sensPage, totalSensPages - 1)] || [];

  const sevConfigs = [
    { id: "Mild", emoji: "🙂", sub: "Manageable", color: "#10B981" },
    { id: "Moderate", emoji: "😣", sub: "Noticeable", color: "#F59E0B" },
    { id: "Severe", emoji: "😫", sub: "Intense", color: "#E11D48" },
  ];

  return (
    <div className="ni-screen-with-sidebar ni-pain-screen">
      <LeftNavRail
        onBack={onBack}
        onHome={onHome}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
        progressPct={progressPct}
      />

      <div className="ni-screen-main-content">
        <div className="ni-subpage-header">
          <div className="ni-subpage-heading-group">
            <CategoryIllustration id="pain" className="w-8 h-8 shrink-0" />
            <h2 className="ni-subpage-title">{painNode.place} Pain</h2>
          </div>
        </div>

        <div className="ni-pain-workspace">
          {/* Column 1: Sensation Grid */}
          <div className="ni-pain-col ni-pain-sensation-col">
            <div className="ni-pain-col-header">
              <h3 className="ni-pain-section-title">1. Sensation</h3>
              <span className="ni-pain-section-sub">
                {selType ? `Selected: ${selType}` : "Select how it feels"}
              </span>
            </div>

            <div className="ni-pain-sensation-grid">
              {visibleTypes.map((type) => {
                const gid = `pain-type-${type}`;
                const isGazed = activeGazeId === gid;
                const isSelected = selType === type;
                const icon = SENSATION_ICONS[type] || "🩹";

                return (
                  <button
                    key={type}
                    className={`ni-pain-card ${isSelected ? "is-selected" : ""} ${isGazed ? "is-gazed" : ""}`}
                    onClick={() => setSelType(type)}
                    data-gaze-id={gid}
                    onMouseEnter={() => gazeEnabled && startDwell(gid)}
                    onMouseLeave={() => gazeEnabled && clearDwell()}
                    aria-label={`Sensation: ${type}`}
                  >
                    <div className="ni-pain-card-icon-box">
                      <span className="text-3xl sm:text-4xl" aria-hidden="true">{icon}</span>
                    </div>
                    <span className="ni-pain-card-label">{type}</span>
                    {isSelected && (
                      <span className="ni-pain-selected-badge">✓ Selected</span>
                    )}
                    {isGazed && <DwellBar pct={progressPct} color="#E11D48" />}
                  </button>
                );
              })}
              {totalSensPages > 1 && sensPage > 0 && (
                <button
                  className="ni-grid-pager-card ni-grid-pager-prev"
                  data-gaze-id="pain-sens-prev"
                  onClick={() => setSensPage(p => Math.max(0, p - 1))}
                  onMouseEnter={() => gazeEnabled && startDwell("pain-sens-prev")}
                  onMouseLeave={() => gazeEnabled && clearDwell()}
                  aria-label="Previous pain sensations page"
                >
                  <span className="ni-grid-pager-arrow">←</span>
                  <strong>Previous Page</strong>
                  {activeGazeId === "pain-sens-prev" && <DwellBar pct={progressPct} color="#4F46E5" />}
                </button>
              )}
              {totalSensPages > 1 && sensPage < totalSensPages - 1 && (
                <button
                  className="ni-grid-pager-card ni-grid-pager-next"
                  data-gaze-id="pain-sens-next"
                  onClick={() => setSensPage(p => Math.min(totalSensPages - 1, p + 1))}
                  onMouseEnter={() => gazeEnabled && startDwell("pain-sens-next")}
                  onMouseLeave={() => gazeEnabled && clearDwell()}
                  aria-label="Next pain sensations page"
                >
                  <strong>Next Page</strong>
                  <span className="ni-grid-pager-arrow">→</span>
                  {activeGazeId === "pain-sens-next" && <DwellBar pct={progressPct} color="#4F46E5" />}
                </button>
              )}
            </div>

            {totalSensPages > 1 && (
              <div className="ni-pain-sensation-pager">
                <span className="text-xs font-bold text-slate-500">
                  Page {sensPage + 1} of {totalSensPages}
                </span>
              </div>
            )}
          </div>

          {/* Column 2: Severity Trio & Large Speak Pain */}
          <div className="ni-pain-col ni-pain-severity-col">
            <div className="ni-pain-col-header">
              <h3 className="ni-pain-section-title">2. Severity</h3>
              <span className="ni-pain-section-sub">
                {selSev ? `Selected: ${selSev}` : "Select intensity"}
              </span>
            </div>

            <div className="ni-severity-trio-large">
              {sevConfigs.map(({ id: sev, emoji, sub, color }) => {
                const gid = `pain-sev-${sev}`;
                const isGazed = activeGazeId === gid;
                const isSelected = selSev === sev;

                return (
                  <button
                    key={sev}
                    className={`ni-severity-card ni-severity-${sev.toLowerCase()} ${isSelected ? "is-selected" : ""} ${isGazed ? "is-gazed" : ""}`}
                    onClick={() => setSelSev(sev)}
                    data-gaze-id={gid}
                    onMouseEnter={() => gazeEnabled && startDwell(gid)}
                    onMouseLeave={() => gazeEnabled && clearDwell()}
                    aria-label={`Severity: ${sev}`}
                  >
                    <div className="text-4xl sm:text-5xl" aria-hidden="true">{emoji}</div>
                    <span className="ni-severity-title">{sev}</span>
                    <span className="ni-severity-sub">{sub}</span>
                    {isSelected && <span className="ni-severity-selected-badge">✓</span>}
                    {isGazed && <DwellBar pct={progressPct} color={color} />}
                  </button>
                );
              })}
            </div>

            {canConfirm ? (
              <div className="ni-pain-speak-card is-ready">
                <button
                  className={`ni-pain-speak-btn ${isConfirmGazed ? "is-gazed" : ""}`}
                  data-gaze-id="pain-confirm-btn"
                  onClick={() => onConfirmSelection({ title: `${painNode.place} Pain`, icon: painNode.icon, message: msg })}
                  onMouseEnter={() => gazeEnabled && startDwell("pain-confirm-btn")}
                  onMouseLeave={() => gazeEnabled && clearDwell()}
                  aria-label="Speak pain message aloud"
                >
                  <div className="ni-pain-speak-icon-box">
                    <span className="text-3xl sm:text-4xl" aria-hidden="true">🔊</span>
                  </div>
                  <div className="ni-pain-speak-content">
                    <span className="ni-pain-speak-heading">Speak Pain Now</span>
                    <p className="ni-pain-speak-preview">"{msg}"</p>
                  </div>
                  {isConfirmGazed && <DwellBar pct={progressPct} color="#059669" />}
                </button>
              </div>
            ) : (
              <div className="ni-pain-selection-hint" role="status">
                <span className="ni-pain-selection-hint-icon" aria-hidden="true">✓</span>
                <span>
                  {selSev
                    ? "Now choose a sensation."
                    : selType
                      ? "Now choose a severity."
                      : "Choose one sensation and one severity."}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Difficulty Breathing Screen with Left Navigation Rail ─────────────────
function DifficultyBreathingScreen({ onSelectUrgent, onBack, onHome, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct }) {
  return (
    <div className="ni-screen-with-sidebar">
      <LeftNavRail
        onBack={onBack}
        onHome={onHome}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
        progressPct={progressPct}
      />

      <div className="ni-screen-main-content">
        <div className="ni-subpage-header border-red-200 bg-red-50">
          <div className="ni-subpage-heading-group">
            <span className="text-2xl" aria-hidden="true">🌬️</span>
            <h2 className="ni-subpage-title text-red-700">Breathing Difficulty — Urgent</h2>
          </div>
        </div>

        <div className="ni-urgent-breathing-tray">
          {[
            { gid:"urgent-breathing-btn", cls:"ni-action-breathing", icon:"🌬️", label:"I am having difficulty breathing.",
              data:{ title:"Difficulty Breathing", icon:"🌬️", message:"I am having difficulty breathing." } },
            { gid:"urgent-help-now-btn", cls:"ni-action-emergency", icon:"🚨", label:"I need urgent help right now!",
              data:{ title:"Urgent Help Needed", icon:"🚨", message:"I need urgent help right now. Please come immediately." } },
          ].map(({ gid, cls, icon, label, data }) => {
            const isGazed = activeGazeId === gid;
            return (
              <button key={gid}
                className={`ni-big-urgent-action ${cls} ${isGazed?"is-gazed":""}`}
                style={{ position:"relative", overflow:"hidden" }}
                data-gaze-id={gid}
                onMouseEnter={() => gazeEnabled && startDwell(gid)}
                onMouseLeave={() => gazeEnabled && clearDwell()}
                onClick={() => onSelectUrgent(data)}>
                <span className="text-3xl">{icon}</span>
                <span>{label}</span>
                {isGazed && <DwellBar pct={progressPct} color={cls.includes("emergency")?"#fff":"#E11D48"} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Redesigned Confirmation Screen (Feeling Weak / All Messages) ──────────
// Layout:
// Left: Large Back / Home card
// Center: Large Selected Option Card + Speak Now
// Right: Large Change card immediately beside selected option
function MessagePreviewScreen({ selection, onConfirm, onCancel, onHome, isSpeaking, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct }) {
  const isBackGazed   = activeGazeId === "dialog-back-btn";
  const isSpeakGazed  = activeGazeId === "dialog-speak-btn";
  const isChangeGazed = activeGazeId === "dialog-change-btn";

  return (
    <div className="ni-confirm-screen" aria-label="Confirm Communication Option">
      <div className="ni-confirm-container">
        {/* 1. Left Navigation Card: Back / Home */}
        <button
          className={`ni-confirm-card ni-confirm-nav ${isBackGazed ? "is-gazed" : ""}`}
          data-gaze-id="dialog-back-btn"
          onClick={onCancel}
          onMouseEnter={() => gazeEnabled && startDwell("dialog-back-btn")}
          onMouseLeave={() => gazeEnabled && clearDwell()}
          aria-label="Back to previous options"
        >
          <div className="ni-confirm-icon-box">
            <span className="text-4xl sm:text-5xl">←</span>
          </div>
          <h3 className="ni-confirm-card-title">Back</h3>
          <p className="ni-confirm-card-sub">Return to previous screen</p>
          <div className="mt-auto pt-3">
            <span className="ni-confirm-pill-btn">Cancel</span>
          </div>
          {isBackGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
        </button>

        {/* 2. Center Card: Prominent Selected Option + Speak Action */}
        <div className="ni-confirm-card ni-confirm-selected">
          <div className="ni-confirm-icon-box ni-confirm-icon-main">
            <span className="text-5xl sm:text-6xl">{selection.icon || "💬"}</span>
          </div>
          <h2 className="ni-confirm-main-title">{selection.title || selection.label}</h2>
          <p className="ni-confirm-quote">"{selection.message}"</p>

          <button
            className={`ni-confirm-speak-btn ni-primary-speak-target ${isSpeakGazed ? "is-gazed" : ""}`}
            data-gaze-id="dialog-speak-btn"
            data-gaze-priority="primary"
            aria-disabled={isSpeaking}
            onClick={onConfirm}
            onMouseEnter={() => gazeEnabled && startDwell("dialog-speak-btn")}
            onMouseLeave={() => gazeEnabled && clearDwell()}
            aria-label={`Speak ${selection.title || selection.label} aloud`}
          >
            <span className="text-2xl" aria-hidden="true">🔊</span>
            <span>Speak Now</span>
            {isSpeakGazed && <DwellBar pct={progressPct} color="#FFFFFF" />}
          </button>
        </div>

        {/* 3. Right Card: Large Change Card Immediately Beside Option */}
        <button
          className={`ni-confirm-card ni-confirm-change ${isChangeGazed ? "is-gazed" : ""}`}
          data-gaze-id="dialog-change-btn"
          onClick={onCancel}
          onMouseEnter={() => gazeEnabled && startDwell("dialog-change-btn")}
          onMouseLeave={() => gazeEnabled && clearDwell()}
          aria-label="Change option and select a different message"
        >
          <div className="ni-confirm-icon-box ni-confirm-icon-change">
            <span className="text-4xl sm:text-5xl">🔄</span>
          </div>
          <h3 className="ni-confirm-card-title">Change</h3>
          <p className="ni-confirm-card-sub">Choose a different option</p>
          <div className="mt-auto pt-3">
            <span className="ni-confirm-pill-btn ni-pill-change">Select Another</span>
          </div>
          {isChangeGazed && <DwellBar pct={progressPct} color="#D97706" />}
        </button>
      </div>
    </div>
  );
}

// ─── Confirmed Screen (After Message Spoken) ───────────────────────────────
function ConfirmedScreen({ selection, onHome, onRepeat, onNewOption, isSpeaking, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct }) {
  const isHomeGazed   = activeGazeId === "confirmed-home-btn";
  const isRepeatGazed = activeGazeId === "confirmed-repeat-btn";
  const isNewGazed    = activeGazeId === "confirmed-new-btn";

  return (
    <div className="ni-confirm-screen" aria-label="Message Spoken">
      <div className="ni-confirm-container">
        {/* Left: Home */}
        <button
          className={`ni-confirm-card ni-confirm-nav ${isHomeGazed ? "is-gazed" : ""}`}
          data-gaze-id="confirmed-home-btn"
          onClick={onHome}
          onMouseEnter={() => gazeEnabled && startDwell("confirmed-home-btn")}
          onMouseLeave={() => gazeEnabled && clearDwell()}
          aria-label="Return to Dashboard"
        >
          <div className="ni-confirm-icon-box">
            <span className="text-4xl sm:text-5xl">⌂</span>
          </div>
          <h3 className="ni-confirm-card-title">Home</h3>
          <p className="ni-confirm-card-sub">Return to dashboard</p>
          <div className="mt-auto pt-3">
            <span className="ni-confirm-pill-btn">Done</span>
          </div>
          {isHomeGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
        </button>

        {/* Center: Spoken Success + Repeat */}
        <div className="ni-confirm-card ni-confirm-selected border-emerald-300 bg-emerald-50/50">
          <div className="ni-confirm-icon-box bg-emerald-100 text-emerald-600">
            <span className="text-5xl sm:text-6xl">✓</span>
          </div>
          <h2 className="ni-confirm-main-title text-emerald-900">{selection.title || selection.label}</h2>
          <p className={`ni-confirm-quote text-emerald-800 ${isSpeaking ? "ni-speaking-status" : ""}`} role="status">
            {isSpeaking ? "Speaking message…" : "Ready to repeat"}
          </p>

          <button
            className={`ni-confirm-speak-btn bg-emerald-600 hover:bg-emerald-700 ${isRepeatGazed ? "is-gazed" : ""}`}
            data-gaze-id="confirmed-repeat-btn"
            aria-disabled={isSpeaking}
            onClick={onRepeat}
            onMouseEnter={() => gazeEnabled && startDwell("confirmed-repeat-btn")}
            onMouseLeave={() => gazeEnabled && clearDwell()}
            aria-label="Repeat message aloud"
          >
            <span className="text-2xl" aria-hidden="true">🔊</span>
            <span>{isSpeaking ? "Speaking…" : "Repeat Message"}</span>
            {isRepeatGazed && <DwellBar pct={progressPct} color="#FFFFFF" />}
          </button>
        </div>

        {/* Right: New / Change Option */}
        <button
          className={`ni-confirm-card ni-confirm-change ${isNewGazed ? "is-gazed" : ""}`}
          data-gaze-id="confirmed-new-btn"
          onClick={onNewOption}
          onMouseEnter={() => gazeEnabled && startDwell("confirmed-new-btn")}
          onMouseLeave={() => gazeEnabled && clearDwell()}
          aria-label="Choose another message"
        >
          <div className="ni-confirm-icon-box ni-confirm-icon-change">
            <span className="text-4xl sm:text-5xl">💬</span>
          </div>
          <h3 className="ni-confirm-card-title">New Option</h3>
          <p className="ni-confirm-card-sub">Select another message</p>
          <div className="mt-auto pt-3">
            <span className="ni-confirm-pill-btn ni-pill-change">Choose More</span>
          </div>
          {isNewGazed && <DwellBar pct={progressPct} color="#D97706" />}
        </button>
      </div>
    </div>
  );
}

// ─── Settings Screen with Left Navigation Rail ─────────────────────────────
function SettingsScreen({ soundEnabled, setSoundEnabled, dwellMs, setDwellMs, onRecalibrate, onClose, onHome, gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct }) {
  const isRecalGazed = activeGazeId === "settings-recal-btn";

  return (
    <div className="ni-screen-with-sidebar">
      <LeftNavRail
        onBack={onClose}
        onHome={onHome}
        gazeEnabled={gazeEnabled}
        startDwell={startDwell}
        clearDwell={clearDwell}
        activeGazeId={activeGazeId}
        progressPct={progressPct}
      />

      <div className="ni-screen-main-content">
        <div className="ni-subpage-header">
          <h2 className="ni-subpage-title">Settings &amp; Calibration</h2>
        </div>

        <div className="ni-settings-container">
          <div className="ni-settings-row">
            <div>
              <strong className="text-base block text-slate-800">Voice Output</strong>
              <span className="text-xs text-slate-500">Read spoken text aloud</span>
            </div>
            <div className={`ni-switch-track ${soundEnabled?"is-on":""}`}
              role="switch" aria-checked={soundEnabled} tabIndex={0}
              data-gaze-id="settings-toggle-sound"
              onMouseEnter={() => gazeEnabled && startDwell("settings-toggle-sound")}
              onMouseLeave={() => gazeEnabled && clearDwell()}
              onClick={() => setSoundEnabled(v => !v)}
              onKeyDown={e => e.key===" " && setSoundEnabled(v => !v)}>
              <span className="ni-switch-thumb" />
            </div>
          </div>

          <div className="ni-settings-row">
            <div>
              <strong className="text-base block text-slate-800">Dwell Selection Duration</strong>
              <span className="text-xs text-slate-500">{dwellMs} ms to trigger card selection</span>
            </div>
            <input type="range" min={500} max={3000} step={100} value={dwellMs}
              onChange={e => setDwellMs(Number(e.target.value))}
              className="w-32 accent-indigo-600 cursor-pointer"
              aria-label="Dwell duration in milliseconds" />
          </div>

          <div className="ni-settings-row">
            <div>
              <strong className="text-base block text-slate-800">Re-Center Eye Tracking</strong>
              <span className="text-xs text-slate-500">Recalibrate center point if head moved</span>
            </div>
            <button
              className={`ni-secondary-btn ${isRecalGazed ? "is-gazed" : ""}`}
              style={{ position: "relative", overflow: "hidden" }}
              data-gaze-id="settings-recal-btn"
              onMouseEnter={() => gazeEnabled && startDwell("settings-recal-btn")}
              onMouseLeave={() => gazeEnabled && clearDwell()}
              onClick={onRecalibrate}
            >
              🎯 Recalibrate
              {isRecalGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bottom Navigation Bar ─────────────────────────────────────────────────
function BottomNav({
  onSOS, onRecalibrate, gazeEnabled,
  onToggleGaze, gazeStatus, onSettings, activeGazeId, startDwell, clearDwell, progressPct,
}) {
  const isGazeActive = gazeEnabled && gazeStatus === "active";
  const isRecalGazed = activeGazeId === "nav-recal-btn";
  const isSosGazed   = activeGazeId === "nav-sos-btn";
  const isSettingsGazed = activeGazeId === "nav-settings-btn";

  return (
    <footer className="ni-bottom-bar" aria-label="Main navigation and controls">
      {/* Center Group: Gaze Status, Instant Recalibrate, Settings */}
      <div className="flex items-center gap-2">
        <button
          className={`ni-action-icon-btn ${gazeEnabled?"is-active":""}`}
          onClick={onToggleGaze}
          title={gazeEnabled ? "Disable Eye Gaze" : "Enable Eye Gaze"}
          aria-label={gazeEnabled ? "Disable Eye Gaze" : "Enable Eye Gaze"}>
          <span className={`w-2 h-2 rounded-full ${isGazeActive?"bg-emerald-500 animate-pulse":gazeEnabled?"bg-amber-500":"bg-slate-400"}`} />
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" fill={gazeEnabled?"#10B981":"none"} />
          </svg>
          <span className="font-bold text-xs sm:text-sm">
            {isGazeActive ? "Gaze ON" : gazeStatus==="calibrating" ? "Calibrating…" : "Eye Gaze"}
          </span>
        </button>

        {gazeEnabled && (
          <button
            className={`ni-recal-btn ${isRecalGazed ? "is-gazed" : ""}`}
            data-gaze-id="nav-recal-btn"
            onClick={onRecalibrate}
            onMouseEnter={() => gazeEnabled && startDwell("nav-recal-btn")}
            onMouseLeave={() => gazeEnabled && clearDwell()}
            title="Recalibrate Center Gaze"
            aria-label="Recalibrate Center Gaze"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Center</span>
            {isRecalGazed && <DwellBar pct={progressPct} color="#059669" />}
          </button>
        )}

        <button className={`ni-settings-btn ${isSettingsGazed ? "is-gazed" : ""}`}
          data-gaze-id="nav-settings-btn"
          onMouseEnter={() => gazeEnabled && startDwell("nav-settings-btn")}
          onMouseLeave={() => gazeEnabled && clearDwell()}
          onClick={onSettings} title="Settings" aria-label="Settings">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {isSettingsGazed && <DwellBar pct={progressPct} color="#4F46E5" />}
        </button>
      </div>

      {/* SOS Button */}
      <button
        className={`ni-sos-urgent-btn ${isSosGazed ? "is-gazed" : ""}`}
        data-gaze-id="nav-sos-btn"
        onMouseEnter={() => gazeEnabled && startDwell("nav-sos-btn")}
        onMouseLeave={() => gazeEnabled && clearDwell()}
        onClick={onSOS} aria-label="Urgent Assistance SOS">
        <span>🚨</span><span>Urgent Help</span>
        {isSosGazed && <DwellBar pct={progressPct} color="#fff" />}
      </button>
    </footer>
  );
}

// ─── Main Application Component ────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]             = useState("home");
  const [homePage, setHomePage]         = useState(0);
  const [domainId, setDomainId]         = useState(null);
  const [path, setPath]                 = useState([]);
  const [selection, setSelection]       = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dwellMs, setDwellMs]           = useState(1500);
  const [gazeEnabled, setGazeEnabled]   = useState(true);
  const [gazePoint, setGazePoint]       = useState({ x: window.innerWidth/2, y: window.innerHeight/2 });
  const [voicePreviewSpeaking, setVPS]  = useState(false);
  const [messageSpeaking, setMessageSpeaking] = useState(false);
  const [activePainNode, setAPainNode]  = useState(null);
  const lastDomain = useRef(null);
  const messageSpeechRef = useRef({ text: null, active: false });

  const { speak, cancel: cancelSpeech } = useSpeech(soundEnabled);

  // Core navigation handlers
  const navigateHome = useCallback(() => {
    cancelSpeech();
    messageSpeechRef.current = { text: null, active: false };
    setVPS(false);
    setMessageSpeaking(false);
    setScreen("home");
    setHomePage(0);
    setDomainId(null);
    setPath([]);
    setSelection(null);
    setAPainNode(null);
  }, [cancelSpeech]);

  const navigateBack = useCallback(() => {
    cancelSpeech();
    messageSpeechRef.current = { text: null, active: false };
    setVPS(false);
    setMessageSpeaking(false);

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
        setPath(p => p.slice(0, -1));
      } else {
        navigateHome();
      }
      return;
    }
    if (screen === "home" && homePage === 1) {
      setHomePage(0);
      return;
    }
    navigateHome();
  }, [cancelSpeech, screen, domainId, path, homePage, navigateHome]);

  const activateDomain = useCallback((id) => {
    const item = tree[id];
    if (!item) return;
    cancelSpeech();
    messageSpeechRef.current = { text: null, active: false };
    setDomainId(id);
    setPath([item]);
    setScreen("domain");
    if (soundEnabled && item.voicePreview) {
      setVPS(true);
      speak(item.voicePreview, () => setVPS(false));
    } else {
      setVPS(false);
    }
  }, [cancelSpeech, soundEnabled, speak]);

  const handleOptionSelect = useCallback((item) => {
    cancelSpeech();
    messageSpeechRef.current = { text: null, active: false };
    setVPS(false);
    if (item.isDifficultyBreathing) { setScreen("breathing"); return; }
    if (item.isPainLocation)        { setAPainNode(item); setScreen("pain"); return; }
    if (item.children)              { setPath(p => [...p, item]); return; }
    setSelection(item);
    setScreen("preview");
    speak(item.message);
  }, [cancelSpeech, soundEnabled, speak]);

  const handleConfirmAndSpeak = useCallback(() => {
    if (!selection || messageSpeechRef.current.active) return;

    const message = selection.message;
    messageSpeechRef.current = { text: message, active: true };
    setMessageSpeaking(true);
    speak(message, () => {
      if (messageSpeechRef.current.text !== message) return;
      messageSpeechRef.current = { text: message, active: false };
      setMessageSpeaking(false);
    });
    setScreen("confirmed");
  }, [speak, selection]);

  const handlePainConfirm = useCallback((item) => {
    if (messageSpeechRef.current.active) return;

    const message = item.message;
    messageSpeechRef.current = { text: message, active: true };
    setSelection(item);
    setMessageSpeaking(true);
    setScreen("preview");
    speak(message, () => {
      if (messageSpeechRef.current.text !== message) return;
      messageSpeechRef.current = { text: message, active: false };
      setMessageSpeaking(false);
    });
  }, [speak]);

  const handleSOSUrgent = useCallback(() => {
    cancelSpeech();
    messageSpeechRef.current = { text: null, active: false };
    setVPS(false);
    setDomainId("help");
    setPath([tree.help]);
    setScreen("domain");
  }, [cancelSpeech]);

  // Universal Dwell Trigger with target-specific dispatch
  const handleDwellTrigger = useCallback((id) => {
    if (!id) return;
    if (id.startsWith("tile-")) {
      const did = id.replace("tile-", "");
      if (lastDomain.current === did) return;
      lastDomain.current = did;
      activateDomain(did);
    } else if (id === "home-page-next") {
      setHomePage(1);
    } else if (id === "home-page-prev") {
      setHomePage(0);
    } else if (
      id === "nav-back-btn" ||
      id === "side-back-btn" ||
      id === "header-back-btn" ||
      id === "pain-back-btn" ||
      id === "urgent-back-btn" ||
      id === "dialog-back-btn" ||
      id === "dialog-cancel-btn" ||
      id === "dialog-change-btn" ||
      id === "confirmed-new-btn"
    ) {
      navigateBack();
    } else if (id === "nav-home-btn" || id === "side-home-btn" || id === "confirmed-home-btn") {
      navigateHome();
    } else if (id === "nav-sos-btn") {
      handleSOSUrgent();
    } else if (id === "dialog-speak-btn" || id === "confirmed-repeat-btn") {
      handleConfirmAndSpeak();
    } else {
      const el = document.querySelector(`[data-gaze-id="${id}"]`);
      if (el && !el.disabled) el.click();
    }
  }, [activateDomain, navigateBack, navigateHome, handleSOSUrgent, handleConfirmAndSpeak]);

  const { startDwell, clearDwell, activeGazeId, progressPct, resetLock } = useGazeDwell({
    enabled: gazeEnabled,
    dwellMs,
    onDwell: handleDwellTrigger,
  });

  const handleGazeCoordinates = useCallback((x, y) => {
    setGazePoint({ x, y });
    const id = findElementUnderGaze(x, y, activeGazeId);
    if (id) startDwell(id); else clearDwell();
  }, [activeGazeId, startDwell, clearDwell]);

  const handleLongBlink = useCallback((x, y) => {
    const id = findElementUnderGaze(x, y, activeGazeId);
    if (id) { clearDwell(); handleDwellTrigger(id); }
  }, [activeGazeId, clearDwell, handleDwellTrigger]);

  const { status: gazeStatus, calProgress, recalibrate, videoRef } = useMediaPipeGaze({
    gazeEnabled,
    onGazePoint: handleGazeCoordinates,
    onLongBlink: handleLongBlink,
  });

  useEffect(() => {
    lastDomain.current = null;
    resetLock();
    clearDwell();
  }, [screen, resetLock, clearDwell]);

  const gazeProps = { gazeEnabled, startDwell, clearDwell, activeGazeId, progressPct };

  let screenContent;
  if (screen === "home") {
    screenContent = (
      <HomeScreen
        onSelectDomain={activateDomain}
        page={homePage}
        setPage={setHomePage}
        {...gazeProps}
      />
    );
  } else if (screen === "settings") {
    screenContent = (
      <SettingsScreen
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        dwellMs={dwellMs}
        setDwellMs={setDwellMs}
        onRecalibrate={recalibrate}
        onClose={navigateBack}
        onHome={navigateHome}
        {...gazeProps}
      />
    );
  } else if (screen === "preview") {
    screenContent = (
      <MessagePreviewScreen
        selection={selection}
        onConfirm={handleConfirmAndSpeak}
        onCancel={navigateBack}
        onHome={navigateHome}
        isSpeaking={messageSpeaking}
        {...gazeProps}
      />
    );
  } else if (screen === "confirmed") {
    screenContent = (
      <ConfirmedScreen
        selection={selection}
        onHome={navigateHome}
        onRepeat={handleConfirmAndSpeak}
        onNewOption={navigateBack}
        isSpeaking={messageSpeaking}
        {...gazeProps}
      />
    );
  } else if (screen === "pain") {
    screenContent = (
      <PainDetailsScreen
        painNode={activePainNode}
        onConfirmSelection={handlePainConfirm}
        onBack={navigateBack}
        onHome={navigateHome}
        {...gazeProps}
      />
    );
  } else if (screen === "breathing") {
    screenContent = (
      <DifficultyBreathingScreen
        onSelectUrgent={item => {
          setSelection(item);
          setScreen("preview");
          speak(item.message);
        }}
        onBack={navigateBack}
        onHome={navigateHome}
        {...gazeProps}
      />
    );
  } else if (screen === "domain") {
    screenContent = (
      <CategoryScreen
        domainId={domainId}
        path={path}
        onOption={handleOptionSelect}
        onBack={navigateBack}
        onHome={navigateHome}
        isSpeakingPreview={voicePreviewSpeaking}
        onRepeatPreview={() => {
          const it = tree[domainId];
          if (it?.voicePreview) {
            cancelSpeech();
            setVPS(true);
            speak(it.voicePreview, () => setVPS(false));
          }
        }}
        onStopPreview={() => {
          cancelSpeech();
          setVPS(false);
        }}
        {...gazeProps}
      />
    );
  } else {
    screenContent = (
      <HomeScreen
        onSelectDomain={activateDomain}
        page={homePage}
        setPage={setHomePage}
        {...gazeProps}
      />
    );
  }

  return (
    <>
      {/* Unobtrusive Mini Webcam Preview: fixed bottom-right outside content */}
      {gazeEnabled && (
        <video
          ref={videoRef}
          className="ni-webcam-preview"
          autoPlay
          playsInline
          muted
          style={{
            position: "fixed",
            bottom: "54px",
            right: "12px",
            width: "112px",
            height: "84px",
            objectFit: "cover",
            transform: "scaleX(-1)",
            borderRadius: "8px",
            border: "2px solid #10B981",
            zIndex: 9998,
            pointerEvents: "none",
            opacity: 0.80,
          }}
        />
      )}

      {/* Center Calibration Overlay */}
      {gazeEnabled && gazeStatus === "calibrating" && (
        <CenterCalibrationOverlay calProgress={calProgress} />
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
          <main className="ni-workspace">{screenContent}</main>
        </div>

        {/* Dedicated Bottom Navigation Bar */}
        <BottomNav
          onSOS={handleSOSUrgent}
          onRecalibrate={recalibrate}
          gazeEnabled={gazeEnabled}
          onToggleGaze={() => setGazeEnabled(v => !v)}
          gazeStatus={gazeStatus}
          onSettings={() => setScreen("settings")}
          activeGazeId={activeGazeId}
          startDwell={startDwell}
          clearDwell={clearDwell}
          progressPct={progressPct}
        />
      </div>
    </>
  );
}