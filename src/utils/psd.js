import Fili from "fili";

export function computePSD(signal, fs) {
  //console.log("signalLength", signal.length);
  const N = 1 << Math.ceil(Math.log2(signal.length));
  //console.log("N", N);
  const fft = new Fili.Fft(N);

  const buffer = new Array(N).fill(0);
  for (let i = 0; i < signal.length; i++) buffer[i] = signal[i];


  // Forward FFT → magnitude is AMPLITUDE SPECTRUM
  const fftResult = fft.forward(buffer, 'hanning');
  const magnitude = fft.magnitude(fftResult); // linear amplitude spectrum

  // Convert amplitude to power and normalize to get PSD (single-sided)
  // PSD (linear) ≈ |X(k)|^2 / (N * fs)
  const power = magnitude.map((v) => (v * v) / (N * fs));

  const freqs = power.map((_, i) => (i * fs) / N);
  const half = Math.floor(N / 2);

  return {
    freqs: freqs.slice(0, half),
    psd: power.slice(0, half),
  };
}
