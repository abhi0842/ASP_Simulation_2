import { useMemo, useContext, useEffect } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import styles from "./ecgFilter.module.css";
import { Line } from "react-chartjs-2";
import { demoARExperiment, calculateMSE } from "../../utils/filters";
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
  } = useContext(SimulationContext);

  const analysis = useMemo(() => {
    const inputSamples = noisySamples.length > 0 ? noisySamples : rawSamples;
    if (!inputSamples.length || !cleanSignal.length) {
      return {
        filteredData: [],
        referenceData: [],
        noisyData: [],
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
        msePredVsRef: 0,
        mseNoisyVsRef: 0,
        corrPredRef: 0,
        corrNoisyRef: 0,
      };
    }

    const arRes = demoARExperiment({
      reference,
      noisy,
      arOrder: Number(config.filterOrder) || 8,
      noiseStd: 0,
      estimateFromNoisy: true,
      fs: originalFs,
    });
    const prediction = arRes.prediction || [];
    const filteredData = limited.map((p, i) => ({ x: p.x, y: prediction[i] ?? 0 }));
    const referenceData = limited.map((p, i) => ({ x: p.x, y: reference[i] ?? 0 }));
    const noisyData = limited.map((p, i) => ({ x: p.x, y: noisy[i] ?? 0 }));

    return {
      filteredData,
      referenceData,
      noisyData,
      msePredVsRef: calculateMSE(reference, prediction),
      mseNoisyVsRef: calculateMSE(reference, noisy),
      corrPredRef: computeCorrelation(reference, prediction),
      corrNoisyRef: computeCorrelation(reference, noisy),
    };
  }, [time, originalFs, config.filterOrder, cleanSignal, rawSamples, noisySamples]);

  useEffect(() => {
    setFilteredSamples(analysis.filteredData);
    setMetrics({
      algorithm: "AR",
      order: config.filterOrder,
      mse: analysis.msePredVsRef.toFixed(6),
    });
  }, [analysis, setFilteredSamples, setMetrics, config.filterOrder]);

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
    <div className={styles.signalContainer}>
      <h3>
        ECG Signal (AR Output) <span>Algorithm: </span>
        <span>{`AR(${config.filterOrder}) one-step prediction`}</span>
      </h3>
      <div
        style={{
          marginBottom: 10,
          padding: 10,
          border: "1px solid #d1d5db",
          borderRadius: 8,
          background: "#f8fafc",
          color: "#000",
        }}
      >
        <strong>Learning Guide (Interpret, not just plot)</strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
            gap: 8,
            marginTop: 8,
            fontSize: 13,
          }}
        >
          <div>MSE (Input vs Reference): <b>{analysis.mseNoisyVsRef.toFixed(6)}</b></div>
          <div>MSE (AR Output vs Reference): <b>{analysis.msePredVsRef.toFixed(6)}</b></div>
          <div>Correlation (Input, Reference): <b>{analysis.corrNoisyRef.toFixed(3)}</b></div>
          <div>Correlation (AR Output, Reference): <b>{analysis.corrPredRef.toFixed(3)}</b></div>
        </div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          Model quality: <b>{grade}</b> | Interpretation:{" "}
          <b>
            {improvesMse
              ? "AR output is closer to clean reference than input (MSE improved)."
              : "AR output is not improving MSE yet; tune AR order or change noise setup."}
          </b>
        </div>
        <ul style={{ margin: "8px 0 0 16px", fontSize: 13 }}>
          <li>Try AR order: 4, 8, 16, 24 and note where MSE is minimum.</li>
          <li>If AR output is over-smooth, increase order; if unstable/noisy, reduce order.</li>
          <li>Write one sentence in report: why does order change prediction quality?</li>
        </ul>
      </div>
      <Line data={chartData} options={options} />
    </div>
  );
};
