/* 
  logisticFit.js
  ====================
  Contains the logistic function, the SSE-based gradient descent, 
  and the function for updating the semitone range.
*/

/**
 * logistic: logistic in [0.5..1] 
 * @param {number} x - log10(semitones)
 * @param {number} alpha
 * @param {number} beta
 */
function logistic(x, alpha, beta) {
  return 0.5 + 0.5 / (1 + Math.exp(-(x - alpha) / beta));
}

/**
 * optimizeLogistic: gradient descent to find alpha, beta
 * @param {Array<number>} xs - log10(semitone) data points
 * @param {Array<number>} ys - correctness values [0 or 1]
 * @param {number} initialAlpha 
 * @param {number} initialBeta
 * @param {number} learningRate
 * @param {number} iterations
 * @returns {{ alpha: number, beta: number }}
 */
function optimizeLogistic(xs, ys, initialAlpha = -1, initialBeta = 0.5, learningRate = 0.1, iterations = 1000) {
  let alpha = initialAlpha;
  let beta  = initialBeta;

  for (let iter = 0; iter < iterations; iter++) {
    let gradAlpha = 0;
    let gradBeta  = 0;

    for (let i = 0; i < xs.length; i++) {
      let pred = logistic(xs[i], alpha, beta);
      let error = pred - ys[i];
      // derivative of logistic wrt "Z"
      let dPred_dZ = pred * (1 - pred);

      // Z = -(xs[i] - alpha)/beta
      // partial wrt alpha => (1/beta)
      gradAlpha += error * dPred_dZ * (1 / beta);

      // partial wrt beta => (xs[i] - alpha)/(beta^2)
      gradBeta  += error * dPred_dZ * ((xs[i] - alpha) / (beta**2));
    }

    gradAlpha /= xs.length;
    gradBeta  /= xs.length;

    alpha -= learningRate * gradAlpha;
    beta  -= learningRate * gradBeta;

    if(Math.abs(gradAlpha) < 1e-6 && Math.abs(gradBeta) < 1e-6) {
      break;
    }
  }

  return { alpha, beta };
}

/**
 * updateRangeFromLogistic: find log10(x) in [0.7..0.8] 
 * @param {number} alpha
 * @param {number} beta
 * Updates global lowSemitoneRange, highSemitoneRange
 */
function updateRangeFromLogistic(alpha, beta) {
  let validXs = [];
  for(let logx = -3; logx <= 0.3; logx += 0.01) {
    let p = logistic(logx, alpha, beta);
    if(p >= 0.7 && p <= 0.8) {
      validXs.push(logx);
    }
  }
  if(validXs.length > 0) {
    let minLog = Math.min(...validXs);
    let maxLog = Math.max(...validXs);
    lowSemitoneRange  = Math.max(0.01, Math.pow(10, minLog));
    highSemitoneRange = Math.max(lowSemitoneRange, Math.pow(10, maxLog));
  } else {
    // fallback
    lowSemitoneRange  = 0.01;
    highSemitoneRange = 1.0;
  }
}
