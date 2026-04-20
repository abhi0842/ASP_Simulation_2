import { useContext, useMemo } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import { computePSD } from "../../utils/psd";
import { Line } from "react-chartjs-2";
import styles from "./ecgFilteredPSD.module.css";

export const EcgFilteredPSD = () => {
  const { filteredSamples, generateECG, originalFs } = useContext(SimulationContext);

  const psdData = useMemo(() => {
    if (!generateECG || filteredSamples.length === 0) return null;
    //console.log("filteredSamples PSD");
    const signal = filteredSamples.map((p) => p.y);
    const data = computePSD(signal, originalFs);
    //console.log("fltered psdData", data);
    return data;
  }, [filteredSamples, generateECG, originalFs]);

  if (!psdData) return null;

  const chartData = {
    datasets: [
      {
        label: "Unfiltered ECG PSD",
        data: psdData.psd.map((p, i) => ({ x: psdData.freqs[i], y: p })),
        borderColor: "blue",
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
        min:0,
        max:originalFs/2,
        title: {
          display: true,
          text: "Frequency (Hz)",
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
        min:0,
        max:2,
        title: {
          display: true,
          text: "PSD(dB/Hz) x 10^3",
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
      <h3>Power Spectral Density — Filtered ECG</h3>
      <Line data={chartData} options={options} />
    </div>
  );
};
