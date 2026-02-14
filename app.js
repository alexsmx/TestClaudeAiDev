// ===== WORKOUT PRESETS =====
const WORKOUTS = [
  {
    id: 'hiit',
    name: 'HIIT',
    icon: '\u{1F525}',
    desc: 'High intensity intervals with short rest',
    color: 'red',
    defaults: { work: 30, rest: 15, rounds: 10, prep: 10 }
  },
  {
    id: 'bodyweight',
    name: 'Bodyweight',
    icon: '\u{1F3C3}',
    desc: 'Circuit of bodyweight exercises',
    color: 'yellow',
    defaults: { work: 20, rest: 10, sets: 2, prep: 10 },
    exercises: ['Jumping Jacks', 'High Knees', 'Sit-ups', 'Push-ups', 'Burpees', 'Rowers', 'Bicycles', 'Mountain Climbers']
  },
  {
    id: 'tabata',
    name: 'Tabata',
    icon: '\u26A1',
    desc: 'Classic 20s work, 10s rest, 8 rounds',
    color: 'yellow',
    defaults: { work: 20, rest: 10, rounds: 8, prep: 10 }
  },
  {
    id: 'stretch',
    name: 'Stretching',
    icon: '\u{1F9D8}',
    desc: 'Long holds with transition breaks',
    color: 'green',
    defaults: { work: 45, rest: 15, rounds: 8, prep: 10 }
  },
  {
    id: 'strength',
    name: 'Strength',
    icon: '\u{1F4AA}',
    desc: 'Timed sets with longer recovery',
    color: 'blue',
    defaults: { work: 40, rest: 30, rounds: 6, prep: 10 }
  },
  {
    id: 'emom',
    name: 'EMOM',
    icon: '\u23F1',
    desc: 'Every minute on the minute',
    color: 'red',
    defaults: { work: 40, rest: 20, rounds: 10, prep: 10 }
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '\u2699',
    desc: 'Build your own interval workout',
    color: 'blue',
    defaults: { work: 30, rest: 15, rounds: 8, prep: 10 }
  }
];

// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const screens = {
  select: $('#screen-select'),
  config: $('#screen-config'),
  timer: $('#screen-timer'),
  complete: $('#screen-complete')
};

// Config refs
const cfgWork = $('#cfg-work');
const cfgRest = $('#cfg-rest');
const cfgRounds = $('#cfg-rounds');
const cfgPrep = $('#cfg-prep');
const configTitle = $('#config-title');
const configSummary = $('#config-summary');

// Timer refs
const phaseLabel = $('#phase-label');
const countdownTime = $('#countdown-time');
const ringProgress = $('#ring-progress');
const roundIndicator = $('#round-indicator');
const nextUp = $('#next-up');
const btnPause = $('#btn-pause');
const iconPause = $('#icon-pause');
const iconPlay = $('#icon-play');
const progressBar = $('#progress-bar');
const completeStats = $('#complete-stats');
const cfgSets = $('#cfg-sets');
const fieldSets = $('#field-sets');
const fieldRounds = $('#field-rounds');
const exerciseListEl = $('#exercise-list');
const exerciseNameEl = $('#exercise-name');

// ===== STATE =====
let currentWorkout = null;
let timerState = {
  phase: 'prep',    // 'prep' | 'work' | 'rest'
  round: 1,
  timeLeft: 0,
  totalPhaseTime: 0,
  running: false,
  paused: false,
  intervalId: null,
  config: { work: 30, rest: 15, rounds: 8, prep: 10 },
  startTime: null
};
let wakeLock = null;

// ===== AUDIO (Web Audio API) =====
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playBeep(frequency, duration, count) {
  const ctx = getAudioCtx();
  let delay = 0;
  for (let i = 0; i < count; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
    delay += duration + 0.1;
  }
}

function beepCountdown() { playBeep(880, 0.15, 1); }
function beepWork() { playBeep(1200, 0.2, 2); }
function beepRest() { playBeep(600, 0.3, 1); }
function beepComplete() { playBeep(1000, 0.15, 3); }

// ===== SCREEN NAVIGATION =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ===== RENDER WORKOUT CARDS =====
function renderWorkoutGrid() {
  const grid = $('#workout-grid');
  grid.innerHTML = WORKOUTS.map(w => `
    <div class="workout-card" data-id="${w.id}" data-color="${w.color}">
      <span class="card-icon">${w.icon}</span>
      <span class="card-name">${w.name}</span>
      <span class="card-desc">${w.desc}</span>
    </div>
  `).join('');

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.workout-card');
    if (!card) return;
    // Ensure audio context is created on user gesture
    getAudioCtx();
    const workout = WORKOUTS.find(w => w.id === card.dataset.id);
    if (workout) openConfig(workout);
  });
}

// ===== CONFIG SCREEN =====
function openConfig(workout) {
  currentWorkout = workout;
  configTitle.textContent = workout.name;
  cfgWork.value = workout.defaults.work;
  cfgRest.value = workout.defaults.rest;
  cfgPrep.value = workout.defaults.prep;

  if (workout.exercises) {
    fieldRounds.style.display = 'none';
    fieldSets.style.display = '';
    cfgSets.value = workout.defaults.sets || 2;
    cfgRounds.value = workout.exercises.length * (parseInt(cfgSets.value) || 2);
    renderExerciseList(workout.exercises);
    exerciseListEl.style.display = '';
  } else {
    fieldRounds.style.display = '';
    fieldSets.style.display = 'none';
    cfgRounds.value = workout.defaults.rounds;
    exerciseListEl.style.display = 'none';
    exerciseListEl.innerHTML = '';
  }

  updateConfigSummary();
  showScreen('config');
}

function renderExerciseList(exercises) {
  exerciseListEl.innerHTML = '<div class="exercise-list-title">Exercises</div>' +
    exercises.map((ex, i) =>
      `<div class="exercise-list-item"><span class="exercise-num">${i + 1}</span>${ex}</div>`
    ).join('');
}

function updateConfigSummary() {
  const work = parseInt(cfgWork.value) || 0;
  const rest = parseInt(cfgRest.value) || 0;
  const prep = parseInt(cfgPrep.value) || 0;
  let rounds;

  if (currentWorkout && currentWorkout.exercises) {
    const sets = parseInt(cfgSets.value) || 1;
    rounds = currentWorkout.exercises.length * sets;
    cfgRounds.value = rounds;
  } else {
    rounds = parseInt(cfgRounds.value) || 0;
  }

  const total = prep + (work + rest) * rounds - rest;
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  if (currentWorkout && currentWorkout.exercises) {
    const sets = parseInt(cfgSets.value) || 1;
    configSummary.textContent = `Total: ${mins}m ${secs.toString().padStart(2, '0')}s \u2022 ${currentWorkout.exercises.length} exercises \u00D7 ${sets} set${sets > 1 ? 's' : ''}`;
  } else {
    configSummary.textContent = `Total time: ${mins}m ${secs.toString().padStart(2, '0')}s \u2022 ${rounds} rounds`;
  }
}

// Stepper buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.stepper-btn');
  if (!btn) return;
  const input = document.getElementById(btn.dataset.target);
  const delta = parseInt(btn.dataset.delta);
  const newVal = Math.max(parseInt(input.min), Math.min(parseInt(input.max), (parseInt(input.value) || 0) + delta));
  input.value = newVal;
  updateConfigSummary();
});

// Input change
[cfgWork, cfgRest, cfgRounds, cfgPrep, cfgSets].forEach(input => {
  input.addEventListener('change', updateConfigSummary);
});

// ===== TIMER ENGINE =====
const RING_CIRCUMFERENCE = 2 * Math.PI * 90; // r=90

function startWorkout() {
  const exercises = currentWorkout?.exercises || null;
  const sets = exercises ? (parseInt(cfgSets.value) || 2) : null;
  const rounds = exercises ? exercises.length * sets : (parseInt(cfgRounds.value) || 8);

  const config = {
    work: parseInt(cfgWork.value) || 30,
    rest: parseInt(cfgRest.value) || 10,
    rounds: rounds,
    prep: parseInt(cfgPrep.value) || 10,
    exercises: exercises,
    sets: sets
  };

  timerState = {
    phase: 'prep',
    round: 1,
    timeLeft: config.prep,
    totalPhaseTime: config.prep,
    running: true,
    paused: false,
    intervalId: null,
    config,
    startTime: Date.now()
  };

  showScreen('timer');
  updateTimerDisplay();
  requestWakeLock();
  timerState.intervalId = setInterval(timerTick, 1000);
}

function timerTick() {
  if (timerState.paused || !timerState.running) return;

  timerState.timeLeft--;

  // Countdown beeps at 3, 2, 1
  if (timerState.timeLeft <= 3 && timerState.timeLeft > 0) {
    beepCountdown();
  }

  if (timerState.timeLeft <= 0) {
    advancePhase();
  }

  updateTimerDisplay();
}

function advancePhase() {
  const { phase, round, config } = timerState;

  if (phase === 'prep') {
    timerState.phase = 'work';
    timerState.timeLeft = config.work;
    timerState.totalPhaseTime = config.work;
    beepWork();
  } else if (phase === 'work') {
    if (round >= config.rounds) {
      finishWorkout();
      return;
    }
    if (config.rest > 0) {
      timerState.phase = 'rest';
      timerState.timeLeft = config.rest;
      timerState.totalPhaseTime = config.rest;
      beepRest();
    } else {
      timerState.round++;
      timerState.phase = 'work';
      timerState.timeLeft = config.work;
      timerState.totalPhaseTime = config.work;
      beepWork();
    }
  } else if (phase === 'rest') {
    timerState.round++;
    timerState.phase = 'work';
    timerState.timeLeft = config.work;
    timerState.totalPhaseTime = config.work;
    beepWork();
  }
}

function updateTimerDisplay() {
  const { phase, round, timeLeft, totalPhaseTime, config } = timerState;

  // Phase label
  const labels = { prep: 'GET READY', work: 'WORK', rest: 'REST' };
  phaseLabel.textContent = labels[phase];
  phaseLabel.className = 'phase-label phase-' + phase;

  // Countdown number
  countdownTime.textContent = timeLeft;

  // Ring progress
  const fraction = 1 - (timeLeft / totalPhaseTime);
  const offset = RING_CIRCUMFERENCE * fraction;
  ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;
  ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE - offset;
  ringProgress.className = 'ring-progress phase-' + phase;

  if (config.exercises) {
    const exIdx = (round - 1) % config.exercises.length;
    const nextExIdx = round % config.exercises.length;
    const setNum = Math.floor((round - 1) / config.exercises.length) + 1;

    // Exercise name
    if (phase === 'prep') {
      exerciseNameEl.textContent = config.exercises[0];
    } else if (phase === 'work') {
      exerciseNameEl.textContent = config.exercises[exIdx];
    } else if (phase === 'rest') {
      exerciseNameEl.textContent = 'Next: ' + config.exercises[nextExIdx];
    }
    exerciseNameEl.className = 'exercise-name phase-' + phase;
    exerciseNameEl.style.display = '';

    // Round indicator
    roundIndicator.textContent = `Set ${setNum}/${config.sets} \u2022 Ex ${exIdx + 1}/${config.exercises.length}`;

    // Next up
    if (phase === 'prep') {
      nextUp.textContent = `${config.exercises.length} exercises \u00D7 ${config.sets} sets`;
    } else if (phase === 'work') {
      if (round >= config.rounds) {
        nextUp.textContent = 'Last exercise!';
      } else {
        nextUp.textContent = `Next: ${config.exercises[nextExIdx]}`;
      }
    } else if (phase === 'rest') {
      nextUp.textContent = 'Get ready!';
    }
  } else {
    exerciseNameEl.style.display = 'none';

    // Round indicator
    roundIndicator.textContent = `Round ${round}/${config.rounds}`;

    // Next up
    if (phase === 'prep') {
      nextUp.textContent = 'Next: Work';
    } else if (phase === 'work') {
      if (round >= config.rounds) {
        nextUp.textContent = 'Last round!';
      } else if (config.rest > 0) {
        nextUp.textContent = 'Next: Rest';
      } else {
        nextUp.textContent = `Next: Round ${round + 1}`;
      }
    } else if (phase === 'rest') {
      nextUp.textContent = `Next: Round ${round + 1}`;
    }
  }

  // Overall progress bar
  const totalWork = config.prep + (config.work + config.rest) * config.rounds - config.rest;
  let elapsed = config.prep - (phase === 'prep' ? timeLeft : 0);
  if (phase !== 'prep') {
    elapsed = config.prep;
    for (let r = 1; r < round; r++) {
      elapsed += config.work + config.rest;
    }
    if (phase === 'work') {
      elapsed += config.work - timeLeft;
    } else if (phase === 'rest') {
      elapsed += config.work + (config.rest - timeLeft);
    }
  }
  const pct = Math.min(100, (elapsed / totalWork) * 100);
  progressBar.style.width = pct + '%';
}

function togglePause() {
  timerState.paused = !timerState.paused;
  if (timerState.paused) {
    iconPause.classList.add('hidden');
    iconPlay.classList.remove('hidden');
  } else {
    iconPause.classList.remove('hidden');
    iconPlay.classList.add('hidden');
  }
}

function stopWorkout() {
  timerState.running = false;
  if (timerState.intervalId) clearInterval(timerState.intervalId);
  releaseWakeLock();
  showScreen('select');
}

function finishWorkout() {
  timerState.running = false;
  if (timerState.intervalId) clearInterval(timerState.intervalId);
  beepComplete();
  releaseWakeLock();

  const elapsed = Math.round((Date.now() - timerState.startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const { config } = timerState;

  completeStats.innerHTML = config.exercises
    ? `${config.exercises.length} exercises \u00D7 ${config.sets} sets completed<br>${config.work}s work / ${config.rest}s rest<br>Total time: ${mins}m ${secs.toString().padStart(2, '0')}s`
    : `${config.rounds} rounds completed<br>${config.work}s work / ${config.rest}s rest<br>Total time: ${mins}m ${secs.toString().padStart(2, '0')}s`;

  showScreen('complete');
}

// ===== WAKE LOCK (keep screen on) =====
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {
    // Wake lock not supported or denied
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Re-acquire wake lock when page becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timerState.running && !timerState.paused) {
    requestWakeLock();
  }
});

// ===== EVENT LISTENERS =====
$('#btn-start').addEventListener('click', startWorkout);
$('#btn-back-config').addEventListener('click', () => showScreen('select'));
$('#btn-back-timer').addEventListener('click', stopWorkout);
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-stop').addEventListener('click', stopWorkout);
$('#btn-restart').addEventListener('click', () => {
  showScreen('config');
});
$('#btn-home').addEventListener('click', () => showScreen('select'));

// Prevent double-tap zoom on timer buttons
document.querySelectorAll('.timer-btn').forEach(btn => {
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    btn.click();
  });
});

// ===== INIT =====
renderWorkoutGrid();
