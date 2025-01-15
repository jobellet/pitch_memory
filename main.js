/* 
  main.js
  ======================
  Core experiment logic, UI flow, event listeners, file upload,
  and calls to updateSamplingBounds() from adaptiveBounds.js
*/

// ===========================
// 0. Global Parameters
// ===========================
let audioContext;
const TONE_DURATION = 0.05;
const MIN_BASE_FREQ = 440;
const MAX_BASE_FREQ = 880;
const MIN_GAP_MS    = 1;
const MAX_GAP_MS    = 1000;

// Default sampling range before 50 real trials
// Also re-applied if not enough data
window.lowSemitoneRange  = 0.01;
window.highSemitoneRange = 2.0;

// Test mode
let isTestMode = false;
const NEEDED_TEST_CORRECT = 5;
let testCorrectCount = 0;

// Real mode
let realTrialCount = 0;
let trialNumberInBatch = 0;
let batchNumber = 0;

let trialData = [];

let firstSoundStartTime = 0;
let secondSoundStartTime = 0;
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

  // Add click listeners for smartphone/touch
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
  isSecondHigher = (Math.random() < 0.5);

  const diffSem = 12;
  let ratio = Math.pow(2, diffSem / 12);
  if (!isSecondHigher) ratio = 1 / ratio;
  secondFrequency = clampFreq(baseFrequency * ratio);

  // Pick a random gap
  const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);

  setTimeout(() => {
    // Mark the time the first tone *starts* playing
    firstSoundStartTime = performance.now();

    // We know exactly when the second tone will start:
    // It's firstToneDuration + gap (in ms) after firstSoundStartTime
    secondSoundStartTime = firstSoundStartTime + (TONE_DURATION * 1000) + gap;

    // Play a single buffer containing (tone1 + gap + tone2)
    playDoubleTone(baseFrequency, secondFrequency, TONE_DURATION, gap)
      .then(() => {
        // Once playback ends, enable response
        enableResponseAreas();
      });
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

  // If fewer than 50 real trials => sample from [0.01..2]
  // If >= 50, sample from [lowSemitoneRange..highSemitoneRange]
  const minVal = (realTrialCount < 50) ? 0.01 : window.lowSemitoneRange;
  const maxVal = (realTrialCount < 50) ? 2.0   : window.highSemitoneRange;
  let absSemitone = pickRandomInLogSpace(minVal, maxVal);

  let ratio = Math.pow(2, absSemitone / 12);
  if (!isSecondHigher) ratio = 1 / ratio;
  secondFrequency = clampFreq(baseFrequency * ratio);

  const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);

  setTimeout(() => {
    firstSoundStartTime = performance.now();
    secondSoundStartTime = firstSoundStartTime + (TONE_DURATION * 1000) + gap;

    playDoubleTone(baseFrequency, secondFrequency, TONE_DURATION, gap)
      .then(() => {
        enableResponseAreas();
      });
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
    isTestMode,
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

    // If we finish a 10-trial batch
    if(trialNumberInBatch >= 10) {
      batchNumber++;
      // If realTrialCount >= 50 => update bounds
      if(realTrialCount >= 50) {
        const realTrials = trialData.filter(t => !t.isTestMode);
        updateSamplingBounds(realTrials, 0.01, 2.0);
      }
      switchScreen('batchEndScreen');
    } else {
      runRealTrial();
    }
  }
}

/* ===========================
   5. File Upload Handler
=========================== */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const loadedData = JSON.parse(evt.target.result);
      if(Array.isArray(loadedData)) {
        trialData = loadedData.concat(trialData);
        // count how many real trials
        const realCount = trialData.filter(t => !t.isTestMode).length;
        if(realCount >= 50) {
          isTestMode = false;
          realTrialCount = realCount;
          batchNumber = Math.floor(realTrialCount / 10);
          trialNumberInBatch = realTrialCount % 10;
          // update sampling bounds from existing data
          const realTrials = trialData.filter(t => !t.isTestMode);
          updateSamplingBounds(realTrials, 0.01, 2.0);
          runRealTrial();
        } else {
          // not enough => do test or partial real
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
  isTestMode = true;
  testCorrectCount = 0;
  runTestTrial();
}

/* ===========================
   6. UI Helpers & Utility
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

function playDoubleTone(freq1, freq2, toneDurationSec, gapMs) {
  return new Promise((resolve) => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const sampleRate = audioContext.sampleRate;
    const fadeTime = 0.01; // 10ms fade-in/out
    const fadeSamples = Math.floor(sampleRate * fadeTime);

    const toneSamples = Math.floor(sampleRate * toneDurationSec);
    const gapSamples  = Math.floor(sampleRate * (gapMs / 1000));
    const totalSamples = toneSamples + gapSamples + toneSamples;

    // Create a 1-channel (mono) buffer
    const audioBuffer = audioContext.createBuffer(1, totalSamples, sampleRate);
    const data = audioBuffer.getChannelData(0);

    // ============ 1) First Tone ============
    for (let i = 0; i < toneSamples; i++) {
      // Simple linear fade-in/out
      let envelope = 1.0;
      if (i < fadeSamples) {
        // fade-in
        envelope = i / fadeSamples;
      } else if (i > toneSamples - fadeSamples) {
        // fade-out
        envelope = (toneSamples - i) / fadeSamples;
      }
      data[i] = envelope * Math.sin(2 * Math.PI * freq1 * (i / sampleRate));
    }

    // ============ 2) Silence Gap ============
    for (let i = toneSamples; i < toneSamples + gapSamples; i++) {
      data[i] = 0;
    }

    // ============ 3) Second Tone ============
    const secondToneStart = toneSamples + gapSamples;
    for (let i = 0; i < toneSamples; i++) {
      let envelope = 1.0;
      if (i < fadeSamples) {
        envelope = i / fadeSamples;
      } else if (i > toneSamples - fadeSamples) {
        envelope = (toneSamples - i) / fadeSamples;
      }
      data[secondToneStart + i] = envelope * Math.sin(2 * Math.PI * freq2 * (i / sampleRate));
    }

    // Create a buffer source and play once
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    source.onended = () => {
      resolve(); // Let caller know playback is done
    };

    source.start();
  });
}

/* ===========================
   7. Keyboard Events
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
