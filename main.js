/* 
  main.js
  ======================
  Handles the core experiment logic, UI flow, event listeners,
  file upload, and calls the logistic-fitting methods when needed.
*/

// ===========================
// 0. Global Parameters
// ===========================
let audioContext;
const TONE_DURATION = 0.25;
const MIN_BASE_FREQ = 220;
const MAX_BASE_FREQ = 880;
const MIN_GAP_MS    = 250;
const MAX_GAP_MS    = 2000;

// Test mode
let isTestMode = false;
const NEEDED_TEST_CORRECT = 5;
let testCorrectCount = 0;

// Real mode
let realTrialCount = 0;
let trialNumberInBatch = 0;
let batchNumber = 0;

// Ranges for logistic
// (exported from logisticFit.js but used globally here)
let lowSemitoneRange  = 0.01;
let highSemitoneRange = 1.0;
let alphaFit = -1;
let betaFit  = 0.5;

// Data
let trialData = [];

// Times
let firstSoundStartTime = 0;
let secondSoundStartTime = 0;
// Response gating
let canRespond = false;

let baseFrequency;
let secondFrequency;
let isSecondHigher;

/* ===========================
   1. Setup On Page Load
=========================== */
window.addEventListener('load', () => {
  // Show intro screen
  switchScreen('introScreen');

  // Add click listeners for smartphone/touch input
  document.getElementById('higherArea').addEventListener('click', () => {
    handleResponse(true);
  });
  document.getElementById('lowerArea').addEventListener('click', () => {
    handleResponse(false);
  });

  // Keyboard events
  document.addEventListener('keydown', handleKeyDown);
  
  // Start Test
  document.getElementById('startTestBtn').addEventListener('click', () => {
    trialData = [];
    isTestMode = true;
    testCorrectCount = 0;
    runTestTrial();
  });

  // Test Complete => Start Real
  document.getElementById('startRealBtn').addEventListener('click', () => {
    isTestMode = false;
    realTrialCount = 0;
    trialNumberInBatch = 0;
    batchNumber = 0;
    runRealTrial();
  });

  // Batch End => Continue
  document.getElementById('continueBtn').addEventListener('click', () => {
    trialNumberInBatch = 0;
    runRealTrial();
  });

  // Batch End => Stop
  document.getElementById('stopBtn').addEventListener('click', () => {
    switchScreen('finalScreen');
  });

  // Download
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const dataStr = JSON.stringify(trialData, null, 2);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'experiment_data.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Upload
  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', handleFileUpload);
});

/* ===========================
   2. Test Mode
=========================== */
function runTestTrial() {
  switchScreen('trialScreen');
  hideTrialCounter(true);
  prepareResponseAreas();

  baseFrequency = randomBaseFreq();
  isSecondHigher = Math.random() < 0.5;

  const diffSem = 12;
  let ratio = Math.pow(2, diffSem / 12);
  if(!isSecondHigher) ratio = 1/ratio;
  secondFrequency = clampFreq(baseFrequency * ratio);

  setTimeout(() => {
    firstSoundStartTime = performance.now();
    playTone(baseFrequency, TONE_DURATION);

    const gap = MIN_GAP_MS + Math.random()*(MAX_GAP_MS - MIN_GAP_MS);
    setTimeout(() => {
      secondSoundStartTime = performance.now();
      playTone(secondFrequency, TONE_DURATION);
      enableResponseAreas();
    }, gap);
  }, 300);
}

function handleTestResponse(correct) {
  if(correct) {
    testCorrectCount++;
    alert(`Correct! (${testCorrectCount}/${NEEDED_TEST_CORRECT})`);
  } else {
    alert(`Wrong! Still ${testCorrectCount}/${NEEDED_TEST_CORRECT} correct.`);
  }
  if(testCorrectCount >= NEEDED_TEST_CORRECT) {
    switchScreen('testCompleteScreen');
  } else {
    runTestTrial();
  }
}

/* ===========================
   3. Real Experiment
=========================== */
function runRealTrial() {
  switchScreen('trialScreen');
  hideTrialCounter(false);
  updateTrialCounter(trialNumberInBatch + 1, 10);
  prepareResponseAreas();

  baseFrequency = randomBaseFreq();
  isSecondHigher = (Math.random() < 0.5);

  let absSemitone;
  if(realTrialCount < 50) {
    absSemitone = pickRandomInLogSpace(0.01, 1.0);
  } else {
    absSemitone = pickRandomInLogSpace(lowSemitoneRange, highSemitoneRange);
  }

  let ratio = Math.pow(2, absSemitone / 12);
  if(!isSecondHigher) ratio = 1/ratio;
  secondFrequency = clampFreq(baseFrequency * ratio);

  setTimeout(() => {
    firstSoundStartTime = performance.now();
    playTone(baseFrequency, TONE_DURATION);
    const gap = MIN_GAP_MS + Math.random()*(MAX_GAP_MS - MIN_GAP_MS);
    setTimeout(() => {
      secondSoundStartTime = performance.now();
      playTone(secondFrequency, TONE_DURATION);
      enableResponseAreas();
    }, gap);
  }, 300);
}

/* ===========================
   4. Handle Response
=========================== */
function handleResponse(userSaysHigher) {
  if(!canRespond) return;

  const now = performance.now();
  const correct = (userSaysHigher === isSecondHigher);
  const gapMs = (secondSoundStartTime - firstSoundStartTime).toFixed(2);
  const rtMs  = (now - secondSoundStartTime).toFixed(2);

  const ratioVal = secondFrequency / baseFrequency;
  const usedSem = 12 * (Math.log(ratioVal)/Math.log(2));
  const absSem = Math.max(0.00001, Math.abs(usedSem));

  trialData.push({
    timestamp: new Date().toISOString(),
    isTestMode: isTestMode,
    batchNumber: isTestMode ? 0 : batchNumber,
    trialInBatch: isTestMode ? 0 : (trialNumberInBatch + 1),
    firstPitchHz: baseFrequency,
    secondPitchHz: secondFrequency,
    gapDurationMs: gapMs,
    relativeDiffSemitones: absSem,
    userResponse: userSaysHigher ? "higher" : "lower",
    correctness: correct,
    reactionTimeMs: rtMs
  });

  if(isTestMode) {
    handleTestResponse(correct);
  } else {
    realTrialCount++;
    trialNumberInBatch++;
    if(trialNumberInBatch >= 10) {
      batchNumber++;
      // If we have 50 or more real trials, do logistic fitting
      if(realTrialCount >= 50) {
        fitCustomLogistic();
      }
      switchScreen('batchEndScreen');
    } else {
      runRealTrial();
    }
  }
}

/* ===========================
   5. Logistic Fit
=========================== */
function fitCustomLogistic() {
  // Gather real (non-test) trials
  const realTrials = trialData.filter(t => !t.isTestMode);
  if(realTrials.length < 10) return; // too few for stable fit

  const xs = [];
  const ys = [];
  for(let t of realTrials) {
    const sem = t.relativeDiffSemitones;
    xs.push(Math.log10(sem));
    ys.push(t.correctness ? 1 : 0);
  }

  let { alpha, beta } = optimizeLogistic(xs, ys, alphaFit, betaFit, 0.1, 1000);
  alphaFit = alpha;
  betaFit  = beta;

  updateRangeFromLogistic(alphaFit, betaFit);
}

/* ===========================
   6. File Upload Handler
=========================== */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const loadedData = JSON.parse(evt.target.result);
      if(Array.isArray(loadedData)) {
        // Merge data
        trialData = loadedData.concat(trialData);

        // Count how many real trials are present
        const realCount = trialData.filter(t => !t.isTestMode).length;

        // If we have enough data, do logistic fit, skip test if we want
        if(realCount >= 50) {
          isTestMode = false;
          realTrialCount = realCount;

          // figure out how many batches have passed, how many in current batch
          batchNumber = Math.floor(realTrialCount / 10);
          trialNumberInBatch = realTrialCount % 10;

          // Fit logistic immediately
          fitCustomLogistic();

          // Start real if not yet started
          runRealTrial();
        } else {
          // Not enough data => maybe do test or partial real
          startTestTrials();
        }
      } else {
        alert("Invalid JSON format.");
      }
    } catch(err) {
      alert("Error parsing JSON: " + err);
    }
  };
  reader.readAsText(file);
}

function startTestTrials() {
  // If user must do test anyway
  isTestMode = true;
  testCorrectCount = 0;
  runTestTrial();
}

/* ===========================
   7. UI Helpers & Utility
=========================== */
function switchScreen(screenId) {
  const screens = [
    "introScreen","trialScreen","testCompleteScreen",
    "batchEndScreen","finalScreen"
  ];
  screens.forEach(s => {
    document.getElementById(s).style.display = (s===screenId) ? 'block' : 'none';
  });
}
function hideTrialCounter(shouldHide) {
  document.getElementById('trialCounter').style.display = shouldHide ? "none" : "block";
}
function updateTrialCounter(current, total) {
  document.getElementById('trialCounter').textContent = `Trial ${current} / ${total}`;
}
function prepareResponseAreas() {
  canRespond = false;
  document.getElementById('higherArea').style.backgroundColor = 'gray';
  document.getElementById('lowerArea').style.backgroundColor = 'gray';
}
function enableResponseAreas() {
  canRespond = true;
  document.getElementById('higherArea').style.backgroundColor = '#eef';
  document.getElementById('lowerArea').style.backgroundColor = '#fee';
}
function randomBaseFreq() {
  return Math.random()*(MAX_BASE_FREQ - MIN_BASE_FREQ) + MIN_BASE_FREQ;
}
function clampFreq(freq) {
  return Math.max(MIN_BASE_FREQ, Math.min(MAX_BASE_FREQ, freq));
}
function pickRandomInLogSpace(minVal, maxVal) {
  const logMin = Math.log10(minVal);
  const logMax = Math.log10(maxVal);
  if(logMax <= logMin) return (minVal + maxVal) / 2;
  const r = Math.random();
  const chosenLog = logMin + r*(logMax - logMin);
  return Math.pow(10, chosenLog);
}
function playTone(freq, durationSec) {
  if(!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioContext.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0, audioContext.currentTime);
  gain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);
  gain.gain.setValueAtTime(1, audioContext.currentTime + durationSec - 0.01);
  gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + durationSec);

  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + durationSec);
}

/* ===========================
   8. Keyboard Events
=========================== */
function handleKeyDown(e) {
  const trialVisible = (document.getElementById('trialScreen').style.display === 'block');
  const batchEndVisible = (document.getElementById('batchEndScreen').style.display === 'block');
  const testCompleteVisible = (document.getElementById('testCompleteScreen').style.display === 'block');

  if(trialVisible) {
    if(e.key === 'ArrowUp') {
      e.preventDefault();
      handleResponse(true);
    } else if(e.key === 'ArrowDown') {
      e.preventDefault();
      handleResponse(false);
    }
  } else if(batchEndVisible) {
    if(e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('continueBtn').click();
    } else if(e.key === 'Escape') {
      e.preventDefault();
      document.getElementById('stopBtn').click();
    }
  } else if(testCompleteVisible) {
    if(e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('startRealBtn').click();
    }
  }
}