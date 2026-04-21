import { useMemo, useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import styles from "./ecgAR.module.css";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { computePoles, estimateAR, applyARPredict } from "../../utils/filters";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

function resampleForDisplay(data, fsOriginal, fsUser) {
  const step = fsOriginal / fsUser;
  if (step <= 1) return data;
  const out = [];
  for (let i = 0; i < data.length; i += step) out.push(data[Math.floor(i)]);
  return out;
}

function inferFs(dataAll) {
  if (!dataAll || dataAll.length < 2) return 500;
  const dt = dataAll[1].x - dataAll[0].x;
  if (dt > 0) return 1 / dt;
  return 500;
}

export const EcgAR = () => {
  const { time, originalFs, config, cleanSignal, rawSamples, noisySamples, generateECG, applyNoiseTrigger } = useContext(SimulationContext);

  const analysis = useMemo(() => {
    if (!generateECG) return null;
    const inputSamples = applyNoiseTrigger ? noisySamples : rawSamples;
    if (!inputSamples || inputSamples.length === 0 || !cleanSignal || cleanSignal.length === 0) return null;

    const fsOriginal = inferFs(inputSamples);
    const display = resampleForDisplay(inputSamples, fsOriginal, originalFs);
    const limited = display.filter((p) => p.x <= time);
    const signal = limited.map((p) => p.y);
    const reference = cleanSignal.slice(0, signal.length);

    let modeledSignal = signal.slice();
    if (config.preprocessing?.highPass) {
      const window = Math.max(3, Math.floor(originalFs * 0.2));
      modeledSignal = modeledSignal.map((v, i, arr) => {
        let acc = 0;
        let count = 0;
        for (let k = Math.max(0, i - window); k <= i; k++) {
          acc += arr[k];
          count++;
        }
        return v - acc / count;
      });
    }
    if (config.preprocessing?.smoothing) {
      modeledSignal = modeledSignal.map((v, i, arr) => {
        const a = arr[Math.max(0, i - 1)];
        const c = arr[Math.min(arr.length - 1, i + 1)];
        return (a + v + c) / 3;
      });
    }
    const segLen = Math.max(16, Number(config.segmentLength) || 512);
    const segment = modeledSignal.slice(Math.max(0, modeledSignal.length - segLen));
    const { arCoeffs } = estimateAR(segment, Number(config.filterOrder) || 8, config.estimatorMode || "biased");
    const { prediction, errorSignal: residual } = applyARPredict(modeledSignal, arCoeffs);

    const polesInfo = computePoles(arCoeffs || []);

    // time-series data points for plotting
    const predData = limited.map((p, i) => ({ x: p.x, y: prediction[i] ?? 0 }));
    const resData = limited.map((p, i) => ({ x: p.x, y: residual[i] ?? 0 }));
    const refData = limited.map((p, i) => ({ x: p.x, y: reference[i] ?? 0 }));

    return { predData, resData, refData, poles: polesInfo.poles, stable: polesInfo.stable };
  }, [time, originalFs, config, cleanSignal, rawSamples, noisySamples, generateECG, applyNoiseTrigger]);

  if (!analysis) return null;

  const chartData = {
    datasets: [
      { label: "Reference (clean)", data: analysis.refData, borderColor: "#1e40af", borderWidth: 1.2, pointRadius: 0, tension: 0 },
      { label: "AR One-step Prediction", data: analysis.predData, borderColor: "#ef4444", borderWidth: 1, pointRadius: 0, tension: 0, borderDash: [6, 4] },
      { label: "Residual (prediction error)", data: analysis.resData, borderColor: "#10b981", borderWidth: 1, pointRadius: 0, tension: 0 },
    ],
  };

  const timeOptions = {
    responsive: true,
    animation: false,
    parsing: false,
    plugins: { legend: { display: true } },
    scales: { x: { type: "linear", title: { display: true, text: "Time (s)" } }, y: { title: { display: true, text: "Amplitude (mV)" } } },
  };

  // pole plot: unit circle points and poles scatter
  const circle = new Array(128).fill(0).map((_, i) => {
    const theta = (i / 128) * Math.PI * 2;
    return { x: Math.cos(theta), y: Math.sin(theta) };
  });
  const polePoints = analysis.poles.map((p) => ({ x: p.re, y: p.im }));

  const poleData = {
    datasets: [
      { label: "Unit circle", data: circle, borderColor: "#999", borderWidth: 1, pointRadius: 0, tension: 0 },
      { label: "Poles", data: polePoints, backgroundColor: analysis.stable ? "#10b981" : "#ef4444", type: "scatter", showLine: false, pointRadius: 5 },
    ],
  };

  const poleOptions = {
    responsive: true,
    animation: false,
    parsing: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { type: "linear", min: -1.5, max: 1.5, title: { display: true, text: "Real" } },
      y: { type: "linear", min: -1.5, max: 1.5, title: { display: true, text: "Imag" } },
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.timePlot}>
        <h3>Time-Domain: Reference / AR Prediction / Residual</h3>
        <Line data={chartData} options={timeOptions} />
      </div>
      <div className={styles.sidePlots}>
        <div className={styles.polePlot}>
          <h4>Pole Plot — Stationarity Check</h4>
          <Line data={poleData} options={poleOptions} />
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Status: {analysis.stable ? <b style={{ color: "#10b981" }}>Stable (all poles inside unit circle)</b> : <b style={{ color: "#ef4444" }}>Unstable</b>}
          </div>
        </div>
      </div>
    </div>
  );
};
