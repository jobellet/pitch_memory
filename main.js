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
const TONE_DURATION = 0.25; // Duration of each tone
const MIN_BASE_FREQ = 220;  // Minimum frequency for the tone
const MAX_BASE_FREQ = 880;  // Maximum frequency for the tone
const MIN_GAP_MS    = 250;  // Minimum gap in milliseconds
const MAX_GAP_MS    = 2000; // Maximum gap in milliseconds

// Sampling ranges
window.lowSemitoneRange  = 0.01;
window.highSemitoneRange = 2.0;

// Test mode parameters
let isTestMode = false;
const NEEDED_TEST_CORRECT = 5;
let testCorrectCount = 0;

// Real trial parameters
let realTrialCount = 0;
let trialNumberInBatch = 0;
let batchNumber = 0;

let trialData = [];

/* ===========================
   1. Setup On Page Load
=========================== */
window.addEventListener('load', () => {
    switchScreen('introScreen');
    addEventListeners();
});

function addEventListeners() {
    document.getElementById('startTestBtn').addEventListener('click', () => {
        trialData = [];
        isTestMode = true;
        testCorrectCount = 0;
        runTestTrial();
    });

    document.getElementById('startRealBtn').addEventListener('click', startRealExperiment);
    document.getElementById('continueBtn').addEventListener('click', continueExperiment);
    document.getElementById('stopBtn').addEventListener('click', () => switchScreen('finalScreen'));
    document.getElementById('downloadBtn').addEventListener('click', downloadData);
    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
}

/* ===========================
   2. Audio Tone Functions
=========================== */
function playTone(baseFreq, secondFreq, firstDuration, gap, secondDuration) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const totalDuration = firstDuration + gap + secondDuration;
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * totalDuration, audioContext.sampleRate);
    const channelData = buffer.getChannelData(0);
    
    fillSineWave(channelData, baseFreq, audioContext.sampleRate, 0, firstDuration);
    fillSineWave(channelData, secondFreq, audioContext.sampleRate, firstDuration + gap, secondDuration + firstDuration + gap);
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
}

function fillSineWave(data, frequency, sampleRate, startSecond, endSecond) {
    const startSample = Math.floor(startSecond * sampleRate);
    const endSample = Math.floor(endSecond * sampleRate);
    for (let i = startSample; i < endSample; i++) {
        data[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate));
    }
}

/* ===========================
   3. Trial Management
=========================== */
function runTestTrial() {
    switchScreen('trialScreen');
    hideTrialCounter(true);

    const firstDuration = TONE_DURATION;
    const gap = getRandomDuration(MIN_GAP_MS, MAX_GAP_MS);
    const secondDuration = TONE_DURATION;
    
    const baseFreq = randomBaseFreq();
    const secondFreq = baseFreq * (Math.random() > 0.5 ? 1.1 : 0.9); // Slight variation
    
    playTone(baseFreq, secondFreq, firstDuration, gap, secondDuration);
}

function startRealExperiment() {
    isTestMode = false;
    realTrialCount = 0;
    trialNumberInBatch = 0;
    batchNumber = 0;
    runRealTrial();
}

function runRealTrial() {
    switchScreen('trialScreen');
    hideTrialCounter(false);

    const firstDuration = TONE_DURATION;
    const gap = getRandomDuration(MIN_GAP_MS, MAX_GAP_MS);
    const secondDuration = TONE_DURATION;
    
    const baseFreq = randomBaseFreq();
    const secondFreq = baseFreq * (Math.random() > 0.5 ? 1.1 : 0.9); // Slight variation
    
    playTone(baseFreq, secondFreq, firstDuration, gap, secondDuration);
}

function continueExperiment() {
    trialNumberInBatch = 0;
    runRealTrial();
}

/* ===========================
   4. Utility Functions
=========================== */
function getRandomDuration(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBaseFreq() {
    return Math.random() * (MAX_BASE_FREQ - MIN_BASE_FREQ) + MIN_BASE_FREQ;
}

function switchScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.style.display = 'none';
    });
    document.getElementById(screenId).style.display = 'flex';
}

function hideTrialCounter(shouldHide) {
    const trialCounter = document.getElementById('trialCounter');
    trialCounter.style.display = shouldHide ? 'none' : 'block';
}

function downloadData() {
    const dataStr = JSON.stringify(trialData, null, 2);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'experiment_data.json';
    a.click();
    URL.revokeObjectURL(url);
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const loadedData = JSON.parse(evt.target.result);
            trialData = loadedData.concat(trialData);
            startRealExperiment();
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };
    reader.readAsText(file);
}
