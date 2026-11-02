
const USERS_KEY = "dayflow_accounts";
const SESSION_KEY = "dayflow_session";

let currentUser = null;
let tasks = [];
let currentFilter = "all";
let alarmInterval = null;
let audioContext = null;
let toastTimer = null;

// Utility functions
const $ = id => document.getElementById(id);

function readJSON(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function getUsers() {
  return readJSON(USERS_KEY, []);
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function taskStorageKey() {
  return "dayflow_tasks_" + currentUser.email;
}

function saveTasks() {
  localStorage.setItem(taskStorageKey(), JSON.stringify(tasks));
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function setMessage(element, message, type = "error") {
  element.textContent = message;
  element.className = "message " + type;
}

function clearAuthMessages() {
  setMessage($("loginMessage"), "");
  setMessage($("registerMessage"), "");
}

// Authentication screen navigation
function showLogin() {
  $("authScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");

  $("loginForm").classList.remove("hidden");
  $("registerForm").classList.add("hidden");

  clearAuthMessages();
}

function showRegister() {
  $("loginForm").classList.add("hidden");
  $("registerForm").classList.remove("hidden");

  clearAuthMessages();
}

// Validation
function isValidUsername(value) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPassword(value) {
  return value.length >= 8 && /\d/.test(value);
}

// SHA-256 password hashing
async function hashPassword(password) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "Password hashing is unavailable. Open the app using Live Server or HTTPS."
    );
  }

  const bytes = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Registration
$("registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessages();

  const username = $("regUsername").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const password = $("regPassword").value;

  if (!username || !email || !password) {
    return setMessage(
      $("registerMessage"),
      "Please fill in all fields."
    );
  }

  if (!isValidUsername(username)) {
    return setMessage(
      $("registerMessage"),
      "Username must be 3–20 characters using letters, numbers or underscores."
    );
  }

  if (!isValidEmail(email)) {
    return setMessage(
      $("registerMessage"),
      "Please enter a valid email address."
    );
  }

  if (!isValidPassword(password)) {
    return setMessage(
      $("registerMessage"),
      "Password needs 8 characters and at least one number."
    );
  }

  const users = getUsers();

  const duplicate = users.some(user =>
    user.username.toLowerCase() === username.toLowerCase() ||
    user.email === email
  );

  if (duplicate) {
    return setMessage(
      $("registerMessage"),
      "This username or email is already registered."
    );
  }

  try {
    const passwordHash = await hashPassword(password);

    users.push({
      username,
      email,
      passwordHash
    });

    saveUsers(users);

    $("registerForm").reset();

    setMessage(
      $("registerMessage"),
      "Account created successfully! Please log in.",
      "success"
    );

    setTimeout(() => {
      $("loginForm").reset();
      $("loginId").value = email;

      $("registerForm").classList.add("hidden");
      $("loginForm").classList.remove("hidden");

      clearAuthMessages();
    }, 1000);

  } catch (error) {
    setMessage($("registerMessage"), error.message);
  }
});

// Login
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessages();

  const identifier = $("loginId").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  if (!identifier || !password) {
    return setMessage(
      $("loginMessage"),
      "Please enter your username/email and password."
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const users = getUsers();

    const user = users.find(account =>
      account.email === identifier ||
      account.username.toLowerCase() === identifier
    );

    if (!user || user.passwordHash !== passwordHash) {
      return setMessage(
        $("loginMessage"),
        "Invalid username/email or password."
      );
    }

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        username: user.username,
        email: user.email
      })
    );

    $("loginForm").reset();
    openDashboard(user);

  } catch (error) {
    setMessage($("loginMessage"), error.message);
  }
});

// Logout
function logout() {
  stopAlarm();

  sessionStorage.removeItem(SESSION_KEY);

  currentUser = null;
  tasks = [];

  showLogin();
  showToast("You have signed out successfully.");
}

$("logoutBtn").addEventListener("click", logout);

// Dashboard session protection
function checkSession() {
  let session = null;

  try {
    session = JSON.parse(
      sessionStorage.getItem(SESSION_KEY)
    );
  } catch {
    session = null;
  }

  if (!session?.email || !session?.username) {
    showLogin();
    return;
  }

  const user = getUsers().find(account =>
    account.email === session.email &&
    account.username === session.username
  );

  if (!user) {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
    return;
  }

  openDashboard(user);
}

function openDashboard(user) {
  currentUser = user;
  tasks = readJSON(taskStorageKey(), []);

  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  $("userName").textContent = user.username;
  $("userEmail").textContent = user.email;
  $("userAvatar").textContent =
    user.username.charAt(0).toUpperCase();

  $("welcomeTitle").textContent =
    "Welcome back, " + user.username + "!";

  $("todayDate").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  renderTasks();
  updateNotificationButton();
}

// Task creation and editing
$("taskForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!currentUser) return;

  const title = $("taskTitle").value.trim();
  const description = $("taskDescription").value.trim();
  const priority = $("taskPriority").value;
  const dueDate = $("taskDate").value;
  const dueTime = $("taskTime").value;
  const reminder = $("taskReminder").checked;
  const editId = $("editId").value;

  if (!title) {
    showToast("Please enter a task title.");
    return;
  }

  if (dueTime && !dueDate) {
    showToast("Please select a due date for your time.");
    return;
  }

  if (reminder && (!dueDate || !dueTime)) {
    showToast("Select both due date and due time for the reminder.");
    return;
  }

  if (
    reminder &&
    new Date(`${dueDate}T${dueTime}`).getTime() <= Date.now()
  ) {
    showToast("Please choose a future date and time.");
    return;
  }

  if (
    reminder &&
    "Notification" in window &&
    Notification.permission === "denied"
  ) {
    showToast("Notifications are blocked. Allow them in browser settings.");
    return;
  }

  if (
    reminder &&
    "Notification" in window &&
    Notification.permission === "default"
  ) {
    Notification.requestPermission().then(permission => {
      updateNotificationButton();

      if (permission !== "granted") {
        showToast("Allow notifications to use task reminders.");
      }
    });
  }

  if (editId) {
    const task = tasks.find(item => item.id === editId);
    if (!task) return;

    Object.assign(task, {
      title,
      description,
      priority,
      dueDate,
      dueTime,
      reminder,
      notified: false
    });

    showToast("Task updated successfully.");

  } else {
    tasks.unshift({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()),

      title,
      description,
      priority,
      dueDate,
      dueTime,
      reminder,
      notified: false,
      completed: false,
      createdAt: Date.now()
    });

    showToast("Task added successfully.");
  }

  saveTasks();
  resetTaskForm();
  renderTasks();
});

function resetTaskForm() {
  $("taskForm").reset();
  $("editId").value = "";

  $("saveTaskBtn").textContent = "+ Add task";
  $("cancelEditBtn").classList.add("hidden");
}

$("cancelEditBtn").addEventListener(
  "click",
  resetTaskForm
);

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  $("editId").value = task.id;
  $("taskTitle").value = task.title;
  $("taskDescription").value = task.description || "";
  $("taskPriority").value = task.priority;
  $("taskDate").value = task.dueDate || "";
  $("taskTime").value = task.dueTime || "";
  $("taskReminder").checked = !!task.reminder;

  $("saveTaskBtn").textContent = "Save changes";
  $("cancelEditBtn").classList.remove("hidden");

  $("taskTitle").focus();
}

function deleteTask(id) {
  if (!confirm("Are you sure you want to delete this task?")) {
    return;
  }

  tasks = tasks.filter(item => item.id !== id);

  saveTasks();
  renderTasks();
  showToast("Task deleted.");
}

function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  task.completed = !task.completed;

  saveTasks();
  renderTasks();

  showToast(
    task.completed
      ? "Great work! Task completed."
      : "Task marked active."
  );
}

// Safe HTML display
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Task filtering and sorting
function getVisibleTasks() {
  let visible = tasks.filter(task => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  const sort = $("sortSelect").value;

  if (sort === "newest") {
    visible.sort((a, b) => b.createdAt - a.createdAt);
  }

  if (sort === "oldest") {
    visible.sort((a, b) => a.createdAt - b.createdAt);
  }

  if (sort === "priority") {
    const rank = { High: 3, Medium: 2, Low: 1 };
    visible.sort(
      (a, b) => rank[b.priority] - rank[a.priority]
    );
  }

  if (sort === "due") {
    visible.sort((a, b) => {
      const first = a.dueDate
        ? `${a.dueDate}T${a.dueTime || "23:59"}`
        : "9999";

      const second = b.dueDate
        ? `${b.dueDate}T${b.dueTime || "23:59"}`
        : "9999";

      return first.localeCompare(second);
    });
  }

  return visible;
}

// Render tasks and statistics
function renderTasks() {
  if (!currentUser) return;

  const list = $("taskList");
  const visible = getVisibleTasks();

  const completed = tasks.filter(task => task.completed).length;
  const active = tasks.length - completed;

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  $("totalCount").textContent = tasks.length;
  $("activeCount").textContent = active;
  $("completedCount").textContent = completed;
  $("progressValue").textContent = progress + "%";

  $("progressBar").style.width = progress + "%";
  $("sideCompleted").textContent = completed;
  $("sideProgress").style.width = progress + "%";

  $("sideSummary").textContent =
    `${completed} of ${tasks.length} tasks completed`;

  list.innerHTML = visible.map(task => {
    const dateText = task.dueDate
      ? new Date(
          `${task.dueDate}T${task.dueTime || "12:00"}`
        ).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          ...(task.dueTime
            ? { hour: "numeric", minute: "2-digit" }
            : {})
        })
      : "No due date";

    const priorityClass = task.priority.toLowerCase();

    return `
      <article class="task-card ${task.completed ? "done" : ""}">
        <div class="task-card-top">
          <input
            class="task-check"
            type="checkbox"
            aria-label="Complete ${escapeHTML(task.title)}"
            ${task.completed ? "checked" : ""}
            onchange="toggleTask('${task.id}')"
          >

          <div class="task-info">
            <div class="task-title">${escapeHTML(task.title)}</div>
            ${
              task.description
                ? `<p class="task-description">${escapeHTML(task.description)}</p>`
                : ""
            }
          </div>
        </div>

        <div class="task-meta">
          <span class="tag ${priorityClass}">
            ${escapeHTML(task.priority)} priority
          </span>

          <span class="tag">◷ ${escapeHTML(dateText)}</span>

          ${task.reminder ? '<span class="tag">🔔 Reminder</span>' : ""}

          <span class="tag">
            ${task.completed ? "Completed" : "Active"}
          </span>
        </div>

        <div class="task-actions">
          <button onclick="editTask('${task.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteTask('${task.id}')">
            Delete
          </button>
        </div>
      </article>
    `;
  }).join("");

  $("emptyState").classList.toggle(
    "hidden",
    visible.length !== 0
  );
}

// Filter controls
function setFilter(filter) {
  currentFilter = filter;

  document.querySelectorAll(".filter-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === filter
    );
  });

  $("allNav").classList.toggle("active", filter === "all");
  $("activeNav").classList.toggle("active", filter === "active");
  $("completedNav").classList.toggle("active", filter === "completed");

  renderTasks();
}

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    setFilter(button.dataset.filter);
  });
});

$("allNav").addEventListener("click", () => setFilter("all"));
$("activeNav").addEventListener("click", () => setFilter("active"));
$("completedNav").addEventListener("click", () => setFilter("completed"));

$("sortSelect").addEventListener("change", renderTasks);

// Notification permission
function updateNotificationButton() {
  const button = $("notificationBtn");

  if (!("Notification" in window)) {
    button.textContent = "Notifications unsupported";
    button.disabled = true;
  } else if (Notification.permission === "granted") {
    button.textContent = "✓ Notifications enabled";
    button.disabled = false;
  } else if (Notification.permission === "denied") {
    button.textContent = "Notifications blocked";
    button.disabled = false;
  } else {
    button.textContent = "Enable notifications";
    button.disabled = false;
  }
}

$("notificationBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("Your browser does not support notifications.");
    return;
  }

  if (Notification.permission === "denied") {
    showToast(
      "Click the site settings icon near the address bar and allow notifications."
    );
    return;
  }

  const permission = await Notification.requestPermission();

  updateNotificationButton();

  showToast(
    permission === "granted"
      ? "Notifications enabled!"
      : "Notification permission was not granted."
  );
});

// Alarm audio
function playAlarm() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    audioContext = audioContext || new AudioContextClass();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.12;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.35);

  } catch (error) {
    console.warn("Audio alarm unavailable:", error);
  }
}

function startAlarm(task) {
  $("alarmTaskName").textContent = task.title;
  $("alarmModal").classList.remove("hidden");

  playAlarm();

  clearInterval(alarmInterval);

  alarmInterval = setInterval(playAlarm, 1200);
}

function stopAlarm() {
  clearInterval(alarmInterval);
  alarmInterval = null;

  $("alarmModal").classList.add("hidden");
}

$("stopAlarmBtn").addEventListener("click", stopAlarm);

// Check reminders
function checkReminders() {
  if (!currentUser || document.hidden) return;

  const now = Date.now();
  let changed = false;

  for (const task of tasks) {
    if (
      !task.reminder ||
      task.completed ||
      task.notified ||
      !task.dueDate ||
      !task.dueTime
    ) {
      continue;
    }

    const due = new Date(
      `${task.dueDate}T${task.dueTime}`
    ).getTime();

    if (Number.isFinite(due) && due <= now) {
      task.notified = true;
      changed = true;

      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("DayFlow reminder", {
            body: `It's time for: ${task.title}`
          });
        } catch (error) {
          console.warn("Notification unavailable:", error);
        }
      }

      startAlarm(task);
      break;
    }
  }

  if (changed) {
    saveTasks();
    renderTasks();
  }
}

document.addEventListener("visibilitychange", checkReminders);

setInterval(checkReminders, 10000);

// Password show/hide
document.querySelectorAll(".show-password").forEach(button => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    const visible = input.type === "password";

    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Hide" : "Show";
  });
});

// IMPORTANT: Authentication navigation
$("goRegister").addEventListener("click", showRegister);
$("goLogin").addEventListener("click", showLogin);

// Start application
checkSession();
