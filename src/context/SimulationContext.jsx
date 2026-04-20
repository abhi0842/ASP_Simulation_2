/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useRef, useState } from "react";

export const SimulationContext = createContext();

export const SimulationProvider = ({ children }) => {
  // Time window shown in graphs (seconds)
  const [time, setTime] = useState(5);
  // Estimated sampling frequency (Hz)
  const [originalFs, setOriginalFs] = useState(500);

  // ECG signals
  const [rawSamples, setRawSamples] = useState([]); // array of { x: seconds, y: raw ECG }
  const [noisySamples, setNoisySamples] = useState([]); // array of { x: seconds, y: noisy ECG }
  const [cleanSignal, setCleanSignal] = useState([]); // numeric array reference ECG
  const [filteredSamples, setFilteredSamples] = useState([]); // array of { x, y } adaptive-filter output
 
  // Adaptive filter params
  const [config, setConfig] = useState({
    filterType: "NLMS", // "NLMS" or "RLS"
    filterOrder: 32, // M
    stepSize: 0.1, // mu
    forgettingFactor: 0.99, // lambda
    regularization: 0.01, // delta
  });

  const [metrics, setMetrics] = useState({
    algorithm: "NLMS",
    order: 32,
    mse: "0.000000",
  });

  // UI triggers (expected by components)
  const [generateECG, setGenerateECG] = useState(false);
  const [applyNoiseTrigger, setApplyNoiseTrigger] = useState(false);
  const [filteredECG, setFilteredECG] = useState(false);
  const [applypsdTrigger, setApplypsdTrigger] = useState(false);

  // Noise toggles (expected by EcgNoisy)
  const [noise, setNoise] = useState({
    baseline: false,
    powerline: false,
    emg: false,
  });

  // ECG dataset selection (use Vite base URL so hosted base path works)
  const [csvFilePath, setCsvFilePath] = useState(() => {
    const base = import.meta.env.BASE_URL || "/";
    const normalizedBase = base.endsWith("/") ? base : base + "/";
    return normalizedBase + "ecg200.csv";
  });
  const prevPathRef = useRef(csvFilePath);

  // Instruction panel state / button ref used in Home.jsx
  const [showInstruction, setShowInstruction] = useState(false);
  const buttonRef = useRef(null);

  const parseCsvECG = useCallback((text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return null;

    const header = lines[0].split(",").map((h) => h.trim());
    const timeIdx = header.findIndex((h) => h === "time_sec" || h.startsWith("time_sec"));
    const rawIdx = header.findIndex((h) => h === "ECG_I" || h.includes("ECG_I"));
    const cleanIdx = header.findIndex(
      (h) => h === "ECG_I_filtered" || h.includes("ECG_I_filtered")
    );

    // Fallback to "first 3 columns" if headers don't match expected names
    const resolvedTimeIdx = timeIdx >= 0 ? timeIdx : 0;
    const resolvedRawIdx = rawIdx >= 0 ? rawIdx : 1;
    const resolvedCleanIdx = cleanIdx >= 0 ? cleanIdx : 2;

    const points = [];
    const clean = [];
    const times = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const t = Number.parseFloat(cols[resolvedTimeIdx]);
      const raw = Number.parseFloat(cols[resolvedRawIdx]);
      const ref = Number.parseFloat(cols[resolvedCleanIdx]);
      if (!Number.isFinite(t) || !Number.isFinite(raw) || !Number.isFinite(ref)) continue;
      points.push({ x: t, y: raw });
      clean.push(ref);
      times.push(t);
    }

    if (points.length < 2) return null;

    // Estimate sampling rate from x spacing (seconds)
    let dtSum = 0;
    let dtCount = 0;
    for (let i = 1; i < Math.min(times.length, 200); i++) {
      const dt = times[i] - times[i - 1];
      if (dt > 0 && Number.isFinite(dt)) {
        dtSum += dt;
        dtCount++;
      }
    }
    const fs = dtCount > 0 ? 1 / (dtSum / dtCount) : 500;

    return { points, clean, fs };
  }, []);

  const loadECGFromCsv = useCallback(async () => {
    try {
      setRawSamples([]);
      setNoisySamples([]);
      setFilteredSamples([]);
      setCleanSignal([]);

      const res = await fetch(csvFilePath);
      if (!res.ok) throw new Error(`Failed to load ECG CSV: ${res.status}`);
      const text = await res.text();
      const parsed = parseCsvECG(text);
      if (!parsed) throw new Error("CSV parse failed (no usable rows).");

      setRawSamples(parsed.points);
      setCleanSignal(parsed.clean);
      setOriginalFs(parsed.fs);

      // Reset triggers for a fresh run
      setApplyNoiseTrigger(false);
      setFilteredECG(false);
      setApplypsdTrigger(false);
      setMetrics({ algorithm: config.filterType, order: config.filterOrder, mse: "0.000000" });
    } catch (e) {
      console.error(e);
    }
  }, [csvFilePath, parseCsvECG, config.filterType, config.filterOrder]);

  useEffect(() => {
    if (!generateECG) return;
    loadECGFromCsv();
  }, [generateECG, loadECGFromCsv]);

  return (
    <SimulationContext.Provider
      value={{
        // graph time controls
        time,
        setTime,
        originalFs,
        setOriginalFs,

        // signals
        rawSamples,
        setRawSamples,
        noisySamples,
        setNoisySamples,
        cleanSignal,
        setCleanSignal,
        filteredSamples,
        setFilteredSamples,

        // triggers
        generateECG,
        setGenerateECG,
        applyNoiseTrigger,
        setApplyNoiseTrigger,
        filteredECG,
        setFilteredECG,
        applypsdTrigger,
        setApplypsdTrigger,

        // noise toggles
        noise,
        setNoise,

        // dataset selection
        csvFilePath,
        setCsvFilePath,
        prevPathRef,

        // adaptive config
        config,
        setConfig,

        // metrics
        metrics,
        setMetrics,

        // instruction UI controls
        showInstruction,
        setShowInstruction,
        buttonRef,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};
