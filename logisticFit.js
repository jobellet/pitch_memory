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
 *   - lowerBound = largest semitone for which accuracy on all trials BELOW that semitone is <60%
 * 
 * We'll store the result in the global lowSemitoneRange, highSemitoneRange.
 */

/**
 * updateSamplingBounds: sorts trials by absSemitone, checks accuracy above/below candidate thresholds
 * @param {Array} realTrials - array of real (non-test) trial objects 
 *        each having { relativeDiffSemitones, correctness }
 * @param {number} defaultLow
 * @param {number} defaultHigh
 */
function updateSamplingBounds(realTrials, defaultLow = 0.01, defaultHigh = 2.0) {
  if(realTrials.length < 50) {
    // Not enough data => just keep defaults
    window.lowSemitoneRange  = defaultLow;
    window.highSemitoneRange = defaultHigh;
    return;
  }

  // Sort ascending by semitone
  const sorted = [...realTrials].sort((a,b) => 
    a.relativeDiffSemitones - b.relativeDiffSemitones
  );

  // We'll define some helper functions
  function accuracy(trials) {
    if(trials.length === 0) return 1; // or assume 100% if no data, to avoid messing up
    let correctCount = trials.filter(t => t.correctness).length;
    return correctCount / trials.length;
  }

  // We'll look at each possible semitone value as a boundary
  // for the "above" or "below" sets, and find the best candidate.

  // Initialize new bounds to defaults
  let newLow  = defaultLow;
  let newHigh = defaultHigh;

  // For the newHigh => we want the smallest semitone X s.t. accuracy on trials with semitone > X > 90%
  // We'll iterate over unique semitone values from largest to smallest
  // But let's do an ascending pass or a descending pass. Let's do ascending:
  let uniqueSems = [...new Set(sorted.map(t => t.relativeDiffSemitones))];

  // The approach:
  // For each candidate 'c' in ascending order:
  //   let aboveSet = all trials with semitone > c
  //   if accuracy(aboveSet) > 0.9 => newHigh = c; break
  // Because we want the *smallest* c for which aboveSet is >90%.

  for(let c of uniqueSems) {
    let aboveSet = sorted.filter(t => t.relativeDiffSemitones > c);
    if(accuracy(aboveSet) > 0.9) {
      newHigh = c; 
      break;
    }
  }

  // For the newLow => we want the largest semitone X s.t. accuracy on trials with semitone < X < 60%
  // So let's do descending pass over uniqueSems
  for(let i = uniqueSems.length -1; i >= 0; i--) {
    let c = uniqueSems[i];
    let belowSet = sorted.filter(t => t.relativeDiffSemitones < c);
    if(accuracy(belowSet) < 0.6) {
      newLow = c;
      break;
    }
  }

  // Safety clamp to avoid crossing or going below 0.01
  if(newLow < 0.01)   newLow = 0.01;
  if(newHigh < 0.01)  newHigh = 0.01; // just in case
  if(newHigh < newLow) {
    // if we messed up and high < low, swap or fallback
    const tmp = newLow;
    newLow = 0.01;
    newHigh = tmp;
  }

  // Now store these in global
  window.lowSemitoneRange  = newLow;
  window.highSemitoneRange = newHigh;
}