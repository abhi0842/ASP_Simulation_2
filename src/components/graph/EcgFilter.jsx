import { useMemo, useContext, useEffect } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import styles from "./ecgFilter.module.css";
import { Line } from "react-chartjs-2";
import { calculateMSE, estimateAR, applyARPredict } from "../../utils/filters";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

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

function computeCorrelation(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 0 ? num / den : 0;
}

export const EcgFilter = () => {
  const {
    time,
    originalFs,
    config,
    cleanSignal,
    rawSamples,
    noisySamples,
    setFilteredSamples,
    setMetrics,
    setArSummary,
  } = useContext(SimulationContext);

  const applyPreprocessing = (samples, fs) => {
    if (!samples.length) return samples;
    const prep = config.preprocessing || {};
    let out = samples.slice();
    if (prep.highPass) {
      const window = Math.max(3, Math.floor(fs * 0.2));
      const hp = new Array(out.length).fill(0);
      for (let i = 0; i < out.length; i++) {
        let acc = 0;
        let count = 0;
        for (let k = Math.max(0, i - window); k <= i; k++) {
          acc += out[k];
          count++;
        }
        hp[i] = out[i] - acc / count;
      }
      out = hp;
    }
    if (prep.smoothing) {
      const sm = new Array(out.length).fill(0);
      for (let i = 0; i < out.length; i++) {
        const a = out[Math.max(0, i - 1)];
        const b = out[i];
        const c = out[Math.min(out.length - 1, i + 1)];
        sm[i] = (a + b + c) / 3;
      }
      out = sm;
    }
    return out;
  };

  const analysis = useMemo(() => {
    const inputSamples = noisySamples.length > 0 ? noisySamples : rawSamples;
    if (!inputSamples.length || !cleanSignal.length) {
      return {
        filteredData: [],
        referenceData: [],
        noisyData: [],
        coeffs: [],
        rms: 0,
        msePredVsRef: 0,
        mseNoisyVsRef: 0,
        corrPredRef: 0,
        corrNoisyRef: 0,
      };
    }

    const fsOriginal = inferFs(inputSamples);
    const display = resampleForDisplay(inputSamples, fsOriginal, originalFs);
    const limited = display.filter((p) => p.x <= time);
    const noisy = limited.map((p) => p.y);
    const reference = cleanSignal.slice(0, noisy.length);

    if (!noisy.length || !reference.length) {
      return {
        filteredData: [],
        referenceData: [],
        noisyData: [],
        coeffs: [],
        rms: 0,
        msePredVsRef: 0,
        mseNoisyVsRef: 0,
        corrPredRef: 0,
        corrNoisyRef: 0,
      };
    }

    const preprocessed = applyPreprocessing(noisy, originalFs);
    const segLen = Math.max(16, Number(config.segmentLength) || 512);
    const segment = preprocessed.slice(Math.max(0, preprocessed.length - segLen));
    const arOrder = Math.max(2, Number(config.filterOrder) || 8);
    const estimatorMode = config.estimatorMode || "biased";
    const { arCoeffs } = estimateAR(segment, arOrder, estimatorMode);
    const { prediction, errorSignal } = applyARPredict(preprocessed, arCoeffs);
    const filteredData = limited.map((p, i) => ({ x: p.x, y: prediction[i] ?? 0 }));
    const referenceData = limited.map((p, i) => ({ x: p.x, y: reference[i] ?? 0 }));
    const noisyData = limited.map((p, i) => ({ x: p.x, y: preprocessed[i] ?? 0 }));
    const rms = errorSignal.length
      ? Math.sqrt(errorSignal.reduce((acc, v) => acc + v * v, 0) / errorSignal.length)
      : 0;

    return {
      filteredData,
      referenceData,
      noisyData,
      coeffs: arCoeffs,
      rms,
      msePredVsRef: calculateMSE(reference, prediction),
      mseNoisyVsRef: calculateMSE(reference, preprocessed),
      corrPredRef: computeCorrelation(reference, prediction),
      corrNoisyRef: computeCorrelation(reference, preprocessed),
    };
  }, [time, originalFs, config, cleanSignal, rawSamples, noisySamples]);

  useEffect(() => {
    setFilteredSamples(analysis.filteredData);
    setMetrics({
      algorithm: "AR",
      order: config.filterOrder,
      mse: analysis.msePredVsRef.toFixed(6),
      rms: analysis.rms.toFixed(6),
    });
    setArSummary({
      coeffs: analysis.coeffs || [],
      rms: analysis.rms || 0,
      mse: analysis.msePredVsRef || 0,
    });
  }, [analysis, setFilteredSamples, setMetrics, config.filterOrder, setArSummary]);

  const chartData = {
    datasets: [
      {
        label: "Reference (clean ECG)",
        data: analysis.referenceData,
        borderColor: "#1e40af",
        borderWidth: 1.2,
        pointRadius: 0,
        tension: 0,
      },
      {
        label: "Input (raw/noisy ECG)",
        data: analysis.noisyData,
        borderColor: "#ef4444",
        borderWidth: 1,
        pointRadius: 0,
        tension: 0,
      },
      {
        label: "AR Output (one-step prediction)",
        data: analysis.filteredData,
        borderColor: "#2ecc71",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    animation: false,
    parsing: false,
    plugins: { legend: { display: true } },
    scales: {
      x: { type: "linear", title: { display: true, text: "Time (s)" } },
      y: { title: { display: true, text: "Amplitude (mV)" } },
    },
  };

  const mseImprovement = analysis.mseNoisyVsRef - analysis.msePredVsRef;
  const improvesMse = mseImprovement > 0;
  const improvedCorr = analysis.corrPredRef > analysis.corrNoisyRef;
  const grade = improvesMse && improvedCorr ? "Good" : improvesMse || improvedCorr ? "Moderate" : "Needs tuning";

  return (
    <div className={styles.signalContainer} style={{ color: "black" }}>
      <h3 style={{ color: "black" }}>
        ECG Signal (AR Output) <span style={{ color: "black" }}>Algorithm: </span>
        <span style={{ color: "black" }}>{`AR(${config.filterOrder}) one-step prediction`}</span>
      </h3>
  
      <div
        style={{
          marginBottom: 10,
          padding: 10,
          border: "1px solid #d1d5db",
          borderRadius: 8,
          background: "#f8fafc",
          color: "black",
        }}
      >
        <strong style={{ color: "black" }}>Learning Guide (Interpret, not just plot)</strong>
  
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
            gap: 8,
            marginTop: 8,
            fontSize: 13,
            color: "black",
          }}
        >
          <div>MSE (Input vs Reference): <b>{analysis.mseNoisyVsRef.toFixed(6)}</b></div>
          <div>MSE (AR Output vs Reference): <b>{analysis.msePredVsRef.toFixed(6)}</b></div>
          <div>Correlation (Input, Reference): <b>{analysis.corrNoisyRef.toFixed(3)}</b></div>
          <div>Correlation (AR Output, Reference): <b>{analysis.corrPredRef.toFixed(3)}</b></div>
          <div>Prediction Error RMS: <b>{analysis.rms.toFixed(6)}</b></div>
          <div>Estimator: <b>{config.estimatorMode}</b> | Segment: <b>{config.segmentLength}</b></div>
        </div>
  
        <div style={{ marginTop: 8, fontSize: 13, color: "black" }}>
          Model quality: <b>{grade}</b> | Interpretation:{" "}
          <b>
            {improvesMse
              ? "AR output is closer to clean reference than input (MSE improved)."
              : "AR output is not improving MSE yet; tune AR order or change noise setup."}
          </b>
        </div>
  
        <ul style={{ margin: "8px 0 0 16px", fontSize: 13, color: "black" }}>
          <li>Try AR order: 4, 8, 16, 24 and note where MSE is minimum.</li>
          <li>If AR output is over-smooth, increase order; if unstable/noisy, reduce order.</li>
          <li>Write one sentence in report: why does order change prediction quality?</li>
        </ul>
        <div style={{ marginTop: 8, fontSize: 12, color: "black" }}>
          Coefficients: {(analysis.coeffs || []).slice(0, 8).map((c, i) => `a${i + 1}=${c.toFixed(4)}`).join(", ")}
        </div>
      </div>
  
      <Line data={chartData} options={options} />
    </div>
  );
};
