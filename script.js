// DOM references
const eventForm = document.getElementById('event-form');
const eventsList = document.getElementById('events-list');
const settingsIcon = document.querySelector('.settings-icon');
const settingsMenu = document.querySelector('.settings-menu');
const layoutSelect = document.getElementById('layout-select');
const sizeSelect = document.getElementById('size-select');
const notifyBtn = document.getElementById('enable-notifications');

// Retrieve events from localStorage
let events = JSON.parse(localStorage.getItem('countdown-events')) || [];
let alarmPlayed = {}; // Prevent duplicate alarms

// Save events to localStorage
function saveEvents() {
  localStorage.setItem('countdown-events', JSON.stringify(events));
}

// Save layout/size settings
function saveSettings() {
  localStorage.setItem('layout-setting', layoutSelect.value);
  localStorage.setItem('size-setting', sizeSelect.value);
}

// Load saved settings and apply them
function loadSettings() {
  const savedLayout = localStorage.getItem('layout-setting');
  const savedSize = localStorage.getItem('size-setting');
  if (savedLayout) layoutSelect.value = savedLayout;
  if (savedSize) sizeSelect.value = savedSize;
  applySettings();
}

// On page load
window.onload = () => {
  loadSettings();
  renderEvents();

  // Check notification status and update button
  const enabledConfirmationShown = localStorage.getItem('notification-enabled-confirmation-shown');
  if (notifyBtn) {
    if (Notification.permission === "granted" && enabledConfirmationShown === "true") {
      notifyBtn.textContent = "✅ Notifications Enabled";
      notifyBtn.disabled = true;
    } else if (Notification.permission === "denied") {
      notifyBtn.textContent = "❌ Enable Notifications (Denied)";
      notifyBtn.disabled = false;
    }
  }

  // Update all countdowns every second
  setInterval(() => {
    events.forEach((event, index) => {
      updateCountdown(index, new Date(event.date));
    });
  }, 1000);
};

// Handle event form submission
eventForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const date = document.getElementById('date').value;
  const timeValue = document.getElementById('time').value;
  const repeat = document.getElementById('repeat').value;

  if (!date || !timeValue) return alert("Please provide both date and time.");

  const dateTime = new Date(`${date}T${timeValue}`);
  if (isNaN(dateTime.getTime()) || dateTime < new Date()) return alert("Please pick a valid future date and time!");

  events.push({ title, date: dateTime, repeat });
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveEvents();
  renderEvents();
  eventForm.reset();
});

// Render all events in the UI
function renderEvents() {
  eventsList.innerHTML = '';
  const emptyState = document.getElementById('empty-state');
  emptyState.style.display = events.length === 0 ? 'block' : 'none';

  events.forEach((event, index) => {
    const card = document.createElement('div');
    card.className = `event-card ${sizeSelect ? sizeSelect.value : 'medium'}`;
    card.innerHTML = `
      <div class="event-title">${event.title}</div>
      <div class="event-date">${new Date(event.date).toLocaleString()}</div>
      <div class="repeat-info">🔁 ${event.repeat.charAt(0).toUpperCase() + event.repeat.slice(1)}</div>
      <div class="countdown" id="countdown-${index}"></div>
      <div class="actions">
        <button onclick="editEvent(${index})">✏️</button>
        <button onclick="deleteEvent(${index})">🗑️</button>
      </div>
    `;
    eventsList.appendChild(card);
    updateCountdown(index, new Date(event.date));
  });
}

// Edit an event
function editEvent(index) {
  const event = events[index];
  const currentDate = new Date(event.date);
  const newTitle = prompt("Update event title:", event.title);
  const newDate = prompt("Update event date (YYYY-MM-DD):", currentDate.toISOString().split('T')[0]);
  const newTime = prompt("Update event time (HH:MM):", currentDate.toTimeString().substring(0, 5));
  const newRepeat = prompt("Repeat? (none/daily/weekly/monthly/yearly):", event.repeat);

  if (!newTitle || !newDate || !newTime || isNaN(new Date(`${newDate}T${newTime}`))) return alert("Invalid inputs.");

  events[index] = { title: newTitle, date: new Date(`${newDate}T${newTime}`), repeat: newRepeat };
  saveEvents();
  renderEvents();
}

// Delete an event
function deleteEvent(index) {
  if (confirm(`Delete "${events[index].title}"?`)) {
    events.splice(index, 1);
    saveEvents();
    renderEvents();
  }
}

// Update countdown and handle alarms/repeats
function updateCountdown(index, date) {
  const now = new Date();
  const nowTime = now.getTime();
  let event = events[index];
  let eventTime = new Date(event.date).getTime();
  const countdownEl = document.getElementById(`countdown-${index}`);
  if (!countdownEl) return;

  const timeLeft = eventTime - nowTime;

  // Send notification one day before
  const reminderTime = new Date(event.date);
  reminderTime.setDate(reminderTime.getDate() - 1);
  reminderTime.setHours(9, 0, 0, 0);
  const notifiedKey = `notified-${index}`;

  if (
    Notification.permission === "granted" &&
    nowTime >= reminderTime.getTime() &&
    nowTime < eventTime &&
    now.toDateString() === reminderTime.toDateString() &&
    !localStorage.getItem(notifiedKey)
  ) {
    new Notification("⏰ Reminder", { body: `${event.title} is tomorrow!` });
    localStorage.setItem(notifiedKey, "true");
  }

  if (now.toDateString() === new Date(event.date).toDateString()) {
    countdownEl.innerHTML = "🎉 Event is Today!";
    if (timeLeft <= 0 && !alarmPlayed[index]) {
      document.getElementById('alarm-sound').play();
      alarmPlayed[index] = true;

      // Handle repeatable events
      let nextDate = new Date(event.date);
      switch (event.repeat) {
        case "daily": nextDate.setDate(nextDate.getDate() + 1); break;
        case "weekly": nextDate.setDate(nextDate.getDate() + 7); break;
        case "monthly": nextDate.setMonth(nextDate.getMonth() + 1); break;
        case "yearly": nextDate.setFullYear(nextDate.getFullYear() + 1); break;
      }
      if (event.repeat !== "none") {
        event.date = nextDate;
        alarmPlayed[index] = false;
        saveEvents();
        renderEvents();
      }
    }
    return;
  }

  if (timeLeft <= 0) {
    countdownEl.innerHTML = "⏰ Event Passed";
    return;
  }

  // Convert time left to readable format
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  countdownEl.innerHTML = `
    <div><span>${days}</span><small>Days</small></div>
    <div><span>${hours}</span><small>Hours</small></div>
    <div><span>${minutes}</span><small>Minutes</small></div>
    <div><span>${seconds}</span><small>Seconds</small></div>
  `;
}

// Notification button handler
if (notifyBtn) {
  notifyBtn.addEventListener('click', () => {
    if (!("Notification" in window)) return alert("Browser does not support desktop notifications.");
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification("🔔 Notifications enabled!", {
          body: "You'll receive reminders for your events."
        });
        localStorage.setItem('notification-enabled-confirmation-shown', "true");
        notifyBtn.textContent = "✅ Notifications Enabled";
        notifyBtn.disabled = true;
      } else {
        alert("You denied notifications. Enable them in browser settings.");
      }
    });
  });
}

// Toggle settings menu
if (settingsIcon) {
  settingsIcon.addEventListener('click', () => {
    settingsMenu.classList.toggle('hidden');
  });
}

// Update layout/size settings on change
layoutSelect.addEventListener('change', () => {
  applySettings();
  saveSettings();
});
sizeSelect.addEventListener('change', () => {
  applySettings();
  saveSettings();
});

// Apply layout and size settings
function applySettings() {
  const layout = layoutSelect.value;
  const size = sizeSelect.value;
  eventsList.className = 'events-list ' + layout;
  document.querySelectorAll('.event-card').forEach(card => {
    card.classList.remove('small', 'medium', 'large');
    card.classList.add(size);
  });
}
