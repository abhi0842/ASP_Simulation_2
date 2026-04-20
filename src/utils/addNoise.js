export function addBaselineWander(signal, fs, amplitude = 0.2, freq = 0.33) {
  return signal.map((v, i) =>
    v + amplitude * Math.sin(2 * Math.PI * freq * (i / fs))
  );
}

export function addPowerlineNoise(signal, fs, amplitude = 0.05, freq = 50) {
  return signal.map((v, i) =>
    v + amplitude * Math.sin(2 * Math.PI * freq * (i / fs))
  );
}

export function addMuscleNoise(signal, amplitude = 0.02) {
  return signal.map(v => v + amplitude * (Math.random() * 2 - 1));
}
