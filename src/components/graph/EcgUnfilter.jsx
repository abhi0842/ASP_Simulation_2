import { useMemo, useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import styles from "./ecgUnfilter.module.css";
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

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);
function resampleForDisplay(data, fsOriginal, fsUser) {
  const step = fsOriginal / fsUser;

  if (step <= 1) return data; // show all if user wants higher rate

  const out = [];
  for (let i = 0; i < data.length; i += step) {
    out.push(data[Math.floor(i)]);
  }
  return out;
}
function inferFs(dataAll) {
  if (dataAll.length < 2) return 500;
  const dt = dataAll[1].x - dataAll[0].x;
  // console.log(1 / dt);
  if (dt > 0) return 1 / dt;

  return 500;
}

export const EcgUnfilter = () => {
  const { time, originalFs, generateECG, rawSamples } =
    useContext(SimulationContext);

  const data = useMemo(() => {
    if (!rawSamples.length || !generateECG) return [];
    const fsOriginal = inferFs(rawSamples);
    console.log("fsOriginal", fsOriginal);
    const displayData = resampleForDisplay(rawSamples, fsOriginal, originalFs);
    return displayData.filter((p) => p.x <= time);
  }, [time, originalFs, generateECG, rawSamples]);


  const chartData = {
    datasets: [
      {
        label: "ECG Signal",
        data,
        borderColor: "#0078d4",

        borderWidth: 1,
        pointRadius: 0,
        tension: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    animation: true,
    parsing: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        type: "linear",
        title: {
          display: true,
          text: "Time (s)",
          font: {
            size: 13, // ← X-axis label font size
            weight: "bold",
          },
        },
        ticks: {
          font: {
            size: 13,
          },
        },
      },
      y: {
        title: {
          display: true,
          text: "Amplitude (mV)",
          font: {
            size: 13,
            weight: "bold",
          },
        },
        ticks: {
          font: {
            size: 12,
          },
        },
      },
    },
  };

  return (
    <div className={styles.signalContainer}>
      <h3>ECG Signal (Unfiltered)</h3>
      <Line data={chartData} options={options} />
    </div>
  );
};
