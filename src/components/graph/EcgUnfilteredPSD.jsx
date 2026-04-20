import { useContext, useMemo } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import { computePSD } from "../../utils/psd";
import { Line } from "react-chartjs-2";
import styles from "./ecgUnfilteredPSD.module.css";

export const EcgUnfilteredPSD = () => {
  const { rawSamples, generateECG, originalFs, noisySamples } = useContext(SimulationContext);

  const psdData = useMemo(() => {
    if (!generateECG || rawSamples.length === 0) return null;
    const source =
      noisySamples && noisySamples.length > 0 ? noisySamples : rawSamples;

    if (!source || source.length === 0) return null;
    const signal = source.map((p) => p.y);
    const data = computePSD(signal, originalFs);

    return data;
  }, [rawSamples, generateECG, originalFs, noisySamples]);

  if (!psdData) return null;

  const chartData = {
    datasets: [
      {
        label: "Unfiltered ECG PSD",
        data: psdData.psd.map((p, i) => ({ x: psdData.freqs[i], y: p })),
        borderColor: "#005FA7",
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
        min: 0,
        max: originalFs / 2,
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
        min: 0,
        max: 2,
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
      <h3>Power Spectral Density — Unfiltered ECG</h3>
      <Line data={chartData} options={options} />
    </div>
  );
};
