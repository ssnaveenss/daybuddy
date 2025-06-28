let timer;
let isRunning = false;
let minutes = 25;
let seconds = 0;
let isBreak = false;
let rounds = 4;
let completedRounds = 0;

const bell = document.getElementById("bell");
const minEl = document.getElementById("minutes");
const secEl = document.getElementById("seconds");

function updateDisplay() {
  minEl.textContent = String(minutes).padStart(2, "0");
  secEl.textContent = String(seconds).padStart(2, "0");
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;

  timer = setInterval(() => {
    if (seconds === 0) {
      if (minutes === 0) {
        bell.play();
        clearInterval(timer);
        isRunning = false;

        if (!isBreak) {
          completedRounds++;

          // Log Pomodoro completion
          fetch("/log-pomodoro", {
            method: "POST"
          });

          if (completedRounds >= rounds) {
            alert("🎉 You've completed all Pomodoro rounds!");
            completedRounds = 0;
          }
        }

        isBreak = !isBreak;
        minutes = isBreak ? parseInt(breakInput.value) : parseInt(workInput.value);
        seconds = 0;
        updateDisplay();
        startTimer();
        return;
      } else {
        minutes--;
        seconds = 59;
      }
    } else {
      seconds--;
    }
    updateDisplay();
  }, 1000);
}

function pauseTimer() {
  clearInterval(timer);
  isRunning = false;
}

function resetTimer() {
  pauseTimer();
  minutes = parseInt(workInput.value);
  seconds = 0;
  isBreak = false;
  completedRounds = 0;
  updateDisplay();
}

document.getElementById("start").addEventListener("click", startTimer);
document.getElementById("pause").addEventListener("click", pauseTimer);
document.getElementById("reset").addEventListener("click", resetTimer);

// Load input values on change
document.getElementById("workInput").addEventListener("change", resetTimer);
document.getElementById("breakInput").addEventListener("change", resetTimer);
document.getElementById("roundInput").addEventListener("change", () => {
  rounds = parseInt(roundInput.value);
});
