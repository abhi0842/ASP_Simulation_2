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
  const magnitude = fft.magnitude(fftResult);  // Amplitude vs freq
  
 // var magnitudeInDB = magnitude.map((v) => 10 * Math.log10(v )); // magnitude in dB
  var db = fft.magToDb(magnitude); // magnitude in dB

  //Standard linear PSD formula
  const psd = db.map((v) => ((v * v ) / (N * fs))* 1000);

  const freqs = psd.map((_, i) => (i * fs) / N);

  const half = Math.floor(N / 2);
  return {
    freqs: freqs.slice(0, half),
    psd: psd.slice(0, half),
  };
}
