import { useContext, useState, useEffect, useMemo } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import styles from "./rightPanel.module.css";
import Swal from "sweetalert2";

export const RightPanel = () => {
  const {
    time,
    setTime,
    originalFs,
    // setUserFs,
    setGenerateECG,
    setApplyNoiseTrigger,
    config,
    setConfig,
    setFilteredECG,
    noise,
    setNoise,
    csvFilePath,
    prevPathRef,
    setCsvFilePath,
    generateECG,
    setFilteredSamples,
    rawSamples,
    noisySamples,
    cleanSignal,
    applyNoiseTrigger,
    setSignalType,
    signalType,
    setUploadedSignalData,
    setUploadedSignalName,
    uploadedSignalName,
    metrics,
    arSummary,
  } = useContext(SimulationContext);

  const [filterOrder, setFilterOrder] = useState(config.filterOrder ?? 8);
  const [segmentLength, setSegmentLength] = useState(config.segmentLength ?? 512);
  const [estimatorMode, setEstimatorMode] = useState(config.estimatorMode ?? "biased");
  const [highPass, setHighPass] = useState(config.preprocessing?.highPass ?? false);
  const [smoothing, setSmoothing] = useState(config.preprocessing?.smoothing ?? false);

  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : base + "/";
  const assetPath = (name) => normalizedBase + name;

  const signalOptions = useMemo(
    () => [
      { id: "normal-ecg", label: "Normal ECG", path: assetPath("ecg200.csv") },
      { id: "afib-ecg", label: "AFib ECG", path: assetPath("ecg300.csv") },
      { id: "resting-emg", label: "Resting EMG", path: assetPath("ecg100.csv") },
      { id: "fatigue-emg", label: "Muscle Fatigue EMG", path: assetPath("ecg100.csv") },
      { id: "upload", label: "Upload Your Own", path: "" },
    ],
    []
  );

  const onSignalTypeChange = (type) => {
    setSignalType(type);
    if (type !== "upload") {
      const picked = signalOptions.find((item) => item.id === type);
      if (picked?.path) {
        setCsvFilePath(picked.path);
        setUploadedSignalName("");
        setUploadedSignalData(null);
      }
    }
    setGenerateECG(false);
    setApplyNoiseTrigger(false);
    setFilteredECG(false);
    setFilteredSamples([]);
  };

  const parseUploadedText = (text) => {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length < 2) return null;
    const maybeHeader = rows[0].toLowerCase().includes("time") || rows[0].toLowerCase().includes("ecg");
    const start = maybeHeader ? 1 : 0;
    const points = [];
    const clean = [];
    for (let i = start; i < rows.length; i++) {
      const cols = rows[i].split(/[,\s;]+/).filter(Boolean);
      if (cols.length < 2) continue;
      const t = Number.parseFloat(cols[0]);
      const y = Number.parseFloat(cols[1]);
      const yRef = Number.isFinite(Number.parseFloat(cols[2])) ? Number.parseFloat(cols[2]) : y;
      if (!Number.isFinite(t) || !Number.isFinite(y)) continue;
      points.push({ x: t, y });
      clean.push(yRef);
    }
    if (points.length < 4) return null;
    const dt = points[1].x - points[0].x;
    const fs = dt > 0 ? 1 / dt : 500;
    return { points, clean, fs };
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseUploadedText(text);
    if (!parsed) {
      Swal.fire({ icon: "error", title: "Invalid file", text: "Upload CSV/TXT with at least time and signal columns." });
      return;
    }
    setUploadedSignalName(file.name);
    setUploadedSignalData(parsed);
    setSignalType("upload");
    setGenerateECG(true);
  };

  const noiseTrigger = () => {
    //console.log(noise);
    if (!generateECG) {
      Swal.fire({
        icon: "info",
        title: "Oops...",
        text: "Please generate ECG signal first!",
      });
      return;
    } else if (!noise.baseline && !noise.powerline && !noise.emg) {
      Swal.fire({
        icon: "info",

        title: "Oops...",
        text: "Please select at least one noise type!",
      });
      return;
    } else {
      setApplyNoiseTrigger(true);
    }
  };

  const runAr = () => {
    if (!generateECG) {
      Swal.fire({
        icon: "info",
        title: "Oops...",
        text: "Please generate ECG signal first!",
      });
      return;
    }
    setFilteredECG(true);
  };

  const resetExperiment = () => {
    setGenerateECG(false);
    setApplyNoiseTrigger(false);
    setFilteredECG(false);
    setFilteredSamples([]);
  };

  useEffect(() => {
    if (prevPathRef.current !== csvFilePath) {
      setApplyNoiseTrigger(false);
      setFilteredECG(false);
      setFilteredSamples([]);
      prevPathRef.current = csvFilePath;
    }
  }, [csvFilePath, prevPathRef, setApplyNoiseTrigger, setFilteredECG, setFilteredSamples]); 

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      filterOrder: Number(filterOrder),
      segmentLength: Number(segmentLength),
      estimatorMode,
      preprocessing: { highPass, smoothing },
    }));
  }, [filterOrder, segmentLength, estimatorMode, highPass, smoothing, setConfig]);

  return (
    <div className={styles.rightPanelContainer}>
      <div className={styles.right}>
        <h2>ECG Signal & Filter Controls</h2>

        <div className={styles.box}>
          <h3>Signal Setup</h3>
          <label>Select Signal</label>
          <select value={signalType} onChange={(e) => onSignalTypeChange(e.target.value)}>
            {signalOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          {signalType === "upload" && (
            <div className={styles.uploadSection}>
              <input type="file" accept=".csv,.txt" onChange={handleUpload} />
              {uploadedSignalName && <p className={styles.fileName}>Uploaded: {uploadedSignalName}</p>}
            </div>
          )}

          <label>Duration (seconds)           <p className={styles.rangeValue}>
            : <span id="demo">{time} seconds</span>
          </p> </label>
          <input
            type="range"
            min="1"
            max="50"
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
          />

          <label>
            Sampling Rate : <span id="demo">{originalFs} Hz</span>
          </label>
          {/* <input
            type="range"
            min="1"
            max="1000"
            value={originalFs}
            onChange={(e) => setUserFs(Number(e.target.value))}
          /> */}
          <p className={styles.rangeValue}>
            
          </p>

          <button onClick={() => setGenerateECG(true)}>
            Generate ECG Signal
          </button>
        </div>

        <div className={styles.box}>
          <h3>Add Noise</h3>

          <label>
            <input
              type="checkbox"
              checked={noise.baseline}
              onChange={(e) =>
                setNoise({ ...noise, baseline: e.target.checked })
              }
            />
            Baseline Wander
          </label>

          <label>
            <input
              type="checkbox"
              checked={noise.powerline}
              onChange={(e) =>
                setNoise({ ...noise, powerline: e.target.checked })
              }
            />
            Powerline (50 Hz)
          </label>

          <label>
            <input
              type="checkbox"
              checked={noise.emg}
              onChange={(e) => setNoise({ ...noise, emg: e.target.checked })}
            />
            EMG Noise
          </label>
          <div className={styles.buttonContainer}>
            <button onClick={() => noiseTrigger()}>Add Noise to Signal</button>
          </div>
        </div>
        <div className={styles.box}>
          <h3>Autoregression (AR) Setup</h3>

          <label>AR Order (p)</label>
          <input
            type="range"
            min="2"
            max="20"
            step="1"
            value={filterOrder}
            onChange={(e) => setFilterOrder(Number(e.target.value))}
          />
          <p className={styles.rangeValue}>Current order: {filterOrder}</p>
          <label>Segment Length (samples)</label>
          <input
            type="number"
            min="128"
            max="4096"
            step="64"
            value={segmentLength}
            onChange={(e) => setSegmentLength(Number(e.target.value))}
          />
          <label>Estimator</label>
          <select value={estimatorMode} onChange={(e) => setEstimatorMode(e.target.value)}>
            <option value="biased">Biased</option>
            <option value="unbiased">Unbiased</option>
          </select>
          <label>
            <input type="checkbox" checked={highPass} onChange={(e) => setHighPass(e.target.checked)} />
            High-pass preprocessing
          </label>
          <label>
            <input type="checkbox" checked={smoothing} onChange={(e) => setSmoothing(e.target.checked)} />
            Smoothing preprocessing
          </label>
          <p className={styles.rangeValue}>
            AR output updates instantly when controls change.
          </p>

          <div className={styles.psdContainer}>
            <button onClick={runAr}>Run AR</button>
            <button onClick={resetExperiment}>Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
};
