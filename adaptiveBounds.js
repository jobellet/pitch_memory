/* 
  adaptiveBounds.js
  =================
  Defines how we update lowSemitoneRange & highSemitoneRange
  based on the user’s performance data, removing logistic regression.
*/

/** 
 * Externally we have:
 *   let lowSemitoneRange  = 0.01;
 *   let highSemitoneRange = 2.0;
 * from main.js 
 * 
 * Our job: after 50 real trials, find new bounds:
 *   - upperBound = smallest semitone for which accuracy on all trials ABOVE that semitone is >90%
 *   - lowerBound = smallest semitone for which accuracy on all trials BETWEEN it and newHigh is >60%
 * 
 * We'll store the result in the global lowSemitoneRange, highSemitoneRange.
 */

/**
 * updateSamplingBounds: sorts trials by absSemitone, checks accuracy between candidate thresholds
 * @param {Array} realTrials - array of real (non-test) trial objects 
 *        each having { relativeDiffSemitones, correctness }
 * @param {number} defaultLow
 * @param {number} defaultHigh
 */
function updateSamplingBounds(realTrials, defaultLow = 0.01, defaultHigh = 2.0) {
  if (realTrials.length < 50) {
    // Not enough data => just keep defaults
    window.lowSemitoneRange = defaultLow;
    window.highSemitoneRange = defaultHigh;
    return;
  }

  // Sort ascending by semitone
  const sorted = [...realTrials].sort((a, b) => 
    a.relativeDiffSemitones - b.relativeDiffSemitones
  );

  // Helper function: Compute accuracy for a subset of trials
  function accuracy(trials) {
    if (trials.length === 0) return 1; // Assume perfect accuracy if no data (prevents division errors)
    let correctCount = trials.filter(t => t.correctness).length;
    return correctCount / trials.length;
  }

  // Initialize new bounds to defaults
  let newLow = defaultLow;
  let newHigh = defaultHigh;

  // Extract unique semitone values (ascending order)
  let uniqueSems = [...new Set(sorted.map(t => t.relativeDiffSemitones))];

  /** 
   * Compute new HIGH bound:
   * Find the smallest semitone X such that accuracy of all trials ABOVE X is >90%
   */
  for (let c of uniqueSems) {
    let aboveSet = sorted.filter(t => t.relativeDiffSemitones > c);
    if (accuracy(aboveSet) > 0.9) {
      newHigh = c;
      break;
    }
  }

  /**
   * Compute new LOW bound:
   * Find the **smallest** semitone X such that accuracy on trials **between X and newHigh** is >60%
   */
  for (let c of uniqueSems) {
    let rangeSet = sorted.filter(t => t.relativeDiffSemitones >= c && t.relativeDiffSemitones <= newHigh);
    if (accuracy(rangeSet) > 0.6) {
      newLow = c;
      break;
    }
  }

  // Safety clamp to avoid extreme cases
  if (newLow < 0.01) newLow = 0.01;
  if (newHigh < 0.01) newHigh = 0.01; // Just in case
  if (newHigh < newLow) {
    // If we messed up and high < low, swap or fallback to defaults
    newLow = defaultLow;
    newHigh = defaultHigh;
  }

  // Store these in global scope
  window.lowSemitoneRange = newLow;
  window.highSemitoneRange = newHigh;
}