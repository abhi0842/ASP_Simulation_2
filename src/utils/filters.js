function clampNumber(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function calculateMSE(reference, filtered) {
  if (!Array.isArray(reference) || !Array.isArray(filtered)) return 0;
  const n = Math.min(reference.length, filtered.length);
  if (n === 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const e = reference[i] - filtered[i];
    acc += e * e;
  }
  return acc / n;
}

export function autocorrelation(x, lagMax, mode = "biased") {
  if (!Array.isArray(x) || x.length === 0) return [];
  const N = x.length;
  const r = new Array(lagMax + 1).fill(0);
  for (let k = 0; k <= lagMax; k++) {
    let acc = 0;
    for (let n = 0; n < N - k; n++) acc += x[n] * x[n + k];
    const denom = mode === "unbiased" ? Math.max(1, N - k) : N;
    r[k] = acc / denom;
  }
  return r;
}

export function levinsonDurbin(r, order, regularization = 0) {
  const p = Math.max(0, Math.floor(order || 0));
  if (!Array.isArray(r) || r.length === 0) return { arCoeffs: [], reflection: [], error: 0 };
  const refl = new Array(p).fill(0);
  // regularize r[0] to avoid division by zero
  let E = (r[0] || 0) + (Number.isFinite(regularization) ? regularization : 0);
  if (p === 0) return { arCoeffs: [], reflection: [], error: E };

  // a coefficients stored as a[0]=1, a[1..p]
  const a = new Array(p + 1).fill(0);
  a[0] = 1;

  for (let m = 1; m <= p; m++) {
    // compute lambda = (r[m] - sum_{i=1}^{m-1} a[i]*r[m-i]) / E
    let acc = 0;
    for (let i = 1; i <= m - 1; i++) acc += a[i] * (r[m - i] || 0);
    const lambda = E === 0 ? 0 : ((r[m] || 0) - acc) / E;
    refl[m - 1] = lambda;

    // update coefficients: a_new[i] = a[i] - lambda * a[m-i]
    const anew = a.slice();
    anew[m] = lambda;
    for (let i = 1; i <= m - 1; i++) {
      anew[i] = a[i] - lambda * a[m - i];
    }

    // compute new prediction error
    E = E * (1 - lambda * lambda);
    if (!Number.isFinite(E) || E <= 0) E = 1e-12;

    // copy back
    for (let i = 0; i <= m; i++) a[i] = anew[i];
  }

  const ar = new Array(p).fill(0);
  for (let i = 0; i < p; i++) ar[i] = a[i + 1] || 0;
  return { arCoeffs: ar, reflection: refl, error: E };
}

export function estimateAR(signal, order, mode = "biased", regularization = 0) {
  const p = Math.max(0, Math.floor(order || 0));
  if (!Array.isArray(signal) || signal.length === 0 || p === 0) return { arCoeffs: [], reflection: [], error: 0 };
  const r = autocorrelation(signal, p, mode);
  return levinsonDurbin(r, p, regularization);
}

export function applyARPredict(signal, arCoeffs) {
  if (!Array.isArray(signal) || signal.length === 0) return { prediction: [], errorSignal: [] };
  const p = (arCoeffs && arCoeffs.length) || 0;
  const N = signal.length;
  const pred = new Array(N).fill(0);
  const err = new Array(N).fill(0);

  for (let n = 0; n < N; n++) {
    let y = 0;
    for (let k = 1; k <= p; k++) {
      const idx = n - k;
      const xnk = idx >= 0 ? signal[idx] : 0;
      y += (arCoeffs[k - 1] || 0) * xnk;
    }
    pred[n] = y;
    err[n] = signal[n] - y;
  }

  return { prediction: pred, errorSignal: err };
}

export function arPSD(arCoeffs, noiseVariance = 1, nfft = 512, fs = 1) {
  const p = (arCoeffs && arCoeffs.length) || 0;
  const freqs = new Array(nfft).fill(0).map((_, i) => (i * fs) / nfft);
  const psd = new Array(nfft).fill(0);

  for (let i = 0; i < nfft; i++) {
    const f = freqs[i];
    const omega = (-2 * Math.PI * f) / fs;
    let real = 1;
    let imag = 0;
    for (let k = 1; k <= p; k++) {
      const a = arCoeffs[k - 1] || 0;
      const angle = omega * k;
      real -= a * Math.cos(angle);
      imag -= a * Math.sin(angle);
    }
    const denom = real * real + imag * imag;
    psd[i] = denom === 0 ? 0 : noiseVariance / denom;
  }
  return { freqs, psd };
}

export function simulateAR(arCoeffs, noiseStd = 1, length = 1024, seed = null) {
  const p = (arCoeffs && arCoeffs.length) || 0;
  const out = new Array(length).fill(0);
  let rand = Math.random;
  if (typeof seed === "number") {
    let s = seed >>> 0;
    rand = () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  for (let n = 0; n < length; n++) {
    let wn = (rand() * 2 - 1) * noiseStd;
    let val = wn;
    for (let k = 1; k <= p; k++) {
      const idx = n - k;
      const prev = idx >= 0 ? out[idx] : 0;
      val += (arCoeffs[k - 1] || 0) * prev;
    }
    out[n] = val;
  }
  return out;
}

export function demoARExperiment({
  reference = null,
  noisy = null,
  arOrder = 8,
  noiseStd = 0.1,
  estimateFromNoisy = true,
  nfft = 512,
  fs = 1,
  seed = null,
  estimatorMode = "biased",
  regularization = 0,
} = {}) {
  if (!Array.isArray(reference) && !Array.isArray(noisy)) return { error: "Provide `reference` or `noisy` array" };
  const N = Array.isArray(reference) ? reference.length : noisy.length;
  let noisySignal = Array.isArray(noisy) ? noisy.slice(0, N) : null;

  if (!noisySignal && Array.isArray(reference)) {
    let rand = Math.random;
    if (typeof seed === "number") {
      let s = seed >>> 0;
      rand = () => {
        s = (1664525 * s + 1013904223) >>> 0;
        return s / 0xffffffff;
      };
    }
    noisySignal = new Array(N);
    for (let i = 0; i < N; i++) noisySignal[i] = reference[i] + (rand() * 2 - 1) * noiseStd;
  }

  const toEstimate = estimateFromNoisy ? noisySignal : Array.isArray(reference) ? reference : noisySignal;
  const { arCoeffs, reflection, error } = estimateAR(toEstimate, arOrder, estimatorMode, regularization);
  const { prediction, errorSignal } = applyARPredict(noisySignal, arCoeffs);
  const mse = Array.isArray(reference) ? calculateMSE(reference, prediction) : null;

  let noiseVar = 1;
  if (Array.isArray(errorSignal) && errorSignal.length > 0) {
    let acc = 0;
    for (let i = 0; i < errorSignal.length; i++) acc += errorSignal[i] * errorSignal[i];
    noiseVar = acc / errorSignal.length;
  }

  const psd = arPSD(arCoeffs, noiseVar, nfft, fs);
  return {
    arCoeffs,
    reflection,
    modelError: error,
    prediction,
    errorSignal,
    mse,
    psd,
    noisy: noisySignal,
    reference,
  };
}

export function computePolesSimple(arCoeffs) {
  const p = (arCoeffs && arCoeffs.length) || 0;
  if (p === 0) return { poles: [], stable: true };
  if (p === 1) {
    const z = -arCoeffs[0];
    return { poles: [{ re: z, im: 0 }], stable: Math.abs(z) < 1 };
  }
  if (p === 2) {
    const a1 = arCoeffs[0] || 0;
    const a2 = arCoeffs[1] || 0;
    const disc = a1 * a1 - 4 * a2;
    if (disc >= 0) {
      const r1 = (-a1 + Math.sqrt(disc)) / 2;
      const r2 = (-a1 - Math.sqrt(disc)) / 2;
      return { poles: [{ re: r1, im: 0 }, { re: r2, im: 0 }], stable: Math.abs(r1) < 1 && Math.abs(r2) < 1 };
    }
    const re = -a1 / 2;
    const im = Math.sqrt(-disc) / 2;
    const mag = Math.sqrt(re * re + im * im);
    return { poles: [{ re, im }, { re, im: -im }], stable: mag < 1 };
  }
  return { poles: null, stable: null };
}

// Durand-Kerner method (Weierstrass) for polynomial roots
export function computeRoots(coeffs, maxIter = 200, tol = 1e-8) {
  // coeffs: [a0, a1, ..., an] for polynomial a0 + a1 z + ... + an z^n
  const n = coeffs.length - 1;
  if (n <= 0) return [];
  // normalize to monic polynomial: z^n + b_{n-1} z^{n-1} + ... + b0
  const a_n = coeffs[n];
  if (a_n === 0) return [];
  const b = coeffs.map((c) => c / a_n);

  // initial guesses: roots of unity scaled
  const roots = new Array(n);
  const TWO_PI = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    const angle = (TWO_PI * i) / n;
    const radius = 0.5 + 0.5 * (i / n);
    roots[i] = { re: radius * Math.cos(angle), im: radius * Math.sin(angle) };
  }

  const polyVal = (z) => {
    // Horner's method: start with leading coefficient b[n]
    let re = b[n], im = 0;
    for (let k = n - 1; k >= 0; k--) {
      const ck = b[k];
      const tmpRe = re * z.re - im * z.im;
      const tmpIm = re * z.im + im * z.re;
      re = tmpRe + ck;
      im = tmpIm;
    }
    return { re, im };
  };

  const sub = (z1, z2) => ({ re: z1.re - z2.re, im: z1.im - z2.im });
  const abs2 = (z) => z.re * z.re + z.im * z.im;
  const div = (z1, z2) => {
    const denom = z2.re * z2.re + z2.im * z2.im || 1e-16;
    return { re: (z1.re * z2.re + z1.im * z2.im) / denom, im: (z1.im * z2.re - z1.re * z2.im) / denom };
  };

  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;
    for (let i = 0; i < n; i++) {
      const xi = roots[i];
      const pxi = polyVal(xi);
      // compute product (xi - xj)
      let denom = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const diff = sub(xi, roots[j]);
        denom = { re: denom.re * diff.re - denom.im * diff.im, im: denom.re * diff.im + denom.im * diff.re };
      }
      // delta = p(xi)/denom
      const delta = div(pxi, denom);
      roots[i] = { re: xi.re - delta.re, im: xi.im - delta.im };
      const change = Math.sqrt(delta.re * delta.re + delta.im * delta.im);
      if (change > maxChange) maxChange = change;
    }
    if (maxChange < tol) break;
  }

  return roots.map((r) => ({ re: r.re, im: r.im }));
}

export function computePoles(arCoeffs) {
  const p = (arCoeffs && arCoeffs.length) || 0;
  if (p === 0) return { poles: [], stable: true };
  // polynomial A(z) = 1 + a1 z^{-1} + ... + ap z^{-p}
  // multiply by z^p: z^p + a1 z^{p-1} + ... + ap
  // For AR model x[n] = sum_{k=1..p} a_k x[n-k] + e[n]
  // characteristic polynomial in z: z^p - a1 z^{p-1} - a2 z^{p-2} - ... - ap
  // represent polynomial as constant-first array: [-ap, -a_{p-1}, ..., -a1, 1]
  const coeffs = [];
  for (let k = 0; k <= p; k++) {
    if (k === p) coeffs.push(1);
    else coeffs.push(-(arCoeffs[p - 1 - k] || 0));
  }
  // compute roots of polynomial (constant..z^p)
  const roots = computeRoots(coeffs);
  const poles = roots.map((r) => ({ re: r.re, im: r.im }));
  const stable = poles.every((z) => Math.sqrt(z.re * z.re + z.im * z.im) < 1 - 1e-8);
  return { poles, stable };
}
