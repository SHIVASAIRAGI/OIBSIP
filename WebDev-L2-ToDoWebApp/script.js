
// ======================================
// DAYFLOW 2.0 - TASK MANAGER
// ======================================

const STORAGE_KEY = "dayflow_tasks_v2";

let tasks = loadTasks();
let currentFilter = "all";
let editingTaskId = null;
let toastTimer;
let alarmTimer = null;
let alarmAudioContext = null;
let alarmOscillators = [];
let activeAlarmTaskId = null;

const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskDescription = document.getElementById("taskDescription");
const taskPriority = document.getElementById("taskPriority");
const taskDate = document.getElementById("taskDate");
const taskTime = document.getElementById("taskTime");
const taskReminder = document.getElementById("taskReminder");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");
const alarmOverlay = document.getElementById("alarmOverlay");

// ======================================
// STORAGE
// ======================================

function loadTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const parsed = JSON.parse(stored);

        return Array.isArray(parsed)
            ? parsed.filter(task =>
                task &&
                task.id !== undefined &&
                typeof task.title === "string"
            ).map(task => ({
                ...task,
                dueTime: task.dueTime || "",
                reminder: task.reminder !== false,
                notified: task.notified === true,
                completed: task.completed === true
            }))
            : [];
    } catch (error) {
        console.error("Could not load tasks:", error);
        return [];
    }
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.error("Storage error:", error);
        showToast("Unable to save tasks in this browser.");
    }
}

// ======================================
// DATE AND TIME HELPERS
// ======================================

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) return "No due date";

    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function getDueTimestamp(task) {
    if (!task.dueDate || !task.dueTime) return null;

    const timestamp = new Date(
        `${task.dueDate}T${task.dueTime}:00`
    ).getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
}

function formatTime(time) {
    if (!time) return "";

    const [hours, minutes] = time.split(":").map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return time;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });

// ======================================
// TOAST
// ======================================

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

// ======================================
// NOTIFICATIONS
// ======================================

async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        showToast("This browser does not support notifications.");
        return false;
    }

    if (Notification.permission === "granted") {
        updateNotificationStatus();
        return true;
    }

    if (Notification.permission === "denied") {
        showToast("Allow notifications in your browser settings.");
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        updateNotificationStatus();
        return permission === "granted";
    } catch (error) {
        console.error("Notification permission error:", error);
        showToast("Unable to request notification permission.");
        return false;
    }
}

function updateNotificationStatus() {
    const status = document.getElementById("notificationStatus");
    const button = document.getElementById("enableNotifications");

    if (!("Notification" in window)) {
        status.textContent = "Notifications are not supported by this browser.";
        button.disabled = true;
        button.textContent = "Not Supported";
        return;
    }

    if (Notification.permission === "granted") {
        status.textContent = "Notifications are enabled. Your reminders are ready.";
        button.textContent = "Enabled ✓";
        button.disabled = true;
    } else if (Notification.permission === "denied") {
        status.textContent = "Notifications are blocked. Enable them in browser site settings.";
        button.textContent = "Blocked";
        button.disabled = true;
    } else {
        status.textContent = "Enable browser notifications to receive task alerts.";
        button.textContent = "Enable Notifications";
        button.disabled = false;
    }
}

document.getElementById("enableNotifications")
    .addEventListener("click", async () => {
        const granted = await requestNotificationPermission();

        if (granted) {
            showToast("Notifications enabled!");
        }
    });

// ======================================
// AUDIO AND ALARM
// ======================================

async function unlockAudio() {
    try {
        const AudioClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioClass) return;

        alarmAudioContext = alarmAudioContext || new AudioClass();

        if (alarmAudioContext.state === "suspended") {
            await alarmAudioContext.resume();
        }
    } catch (error) {
        console.warn("Audio unavailable:", error);
    }
}

// Browser audio requires a user gesture before playback.
document.addEventListener("click", () => {
    unlockAudio();
}, { once: true });

function playAlarmTone() {
    if (!alarmAudioContext ||
        alarmAudioContext.state !== "running") {
        return;
    }

    const oscillator = alarmAudioContext.createOscillator();
    const gain = alarmAudioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, alarmAudioContext.currentTime);
    oscillator.frequency.setValueAtTime(660, alarmAudioContext.currentTime + 0.25);

    gain.gain.setValueAtTime(0.001, alarmAudioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, alarmAudioContext.currentTime + 0.04);
    gain.gain.setValueAtTime(0.15, alarmAudioContext.currentTime + 0.35);
    gain.gain.linearRampToValueAtTime(0.001, alarmAudioContext.currentTime + 0.5);

    oscillator.connect(gain);
    gain.connect(alarmAudioContext.destination);

    oscillator.start();
    oscillator.stop(alarmAudioContext.currentTime + 0.52);

    alarmOscillators.push(oscillator);

    oscillator.onended = () => {
        alarmOscillators = alarmOscillators.filter(item => item !== oscillator);
        oscillator.disconnect();
        gain.disconnect();
    };
}

function stopAlarmTone() {
    if (alarmTimer) {
        clearInterval(alarmTimer);
        alarmTimer = null;
    }

    alarmOscillators.forEach(oscillator => {
        try {
            oscillator.stop();
        } catch (error) {
            // Oscillator may already have stopped.
        }
    });

    alarmOscillators = [];
}

function triggerAlarm(task) {
    activeAlarmTaskId = task.id;

    document.getElementById("alarmTaskName").textContent =
        task.title;

    alarmOverlay.classList.add("active");

    playAlarmTone();

    if (alarmTimer) clearInterval(alarmTimer);

    alarmTimer = setInterval(playAlarmTone, 1200);

    if ("Notification" in window &&
        Notification.permission === "granted") {

        try {
            const notification = new Notification("DayFlow Reminder ⏰", {
                body: `It's time for: ${task.title}`,
                tag: `dayflow-${task.id}`,
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (error) {
            console.warn("Notification failed:", error);
        }
    }

    showToast(`Reminder: ${task.title}`);
}

function stopAlarm() {
    stopAlarmTone();
    alarmOverlay.classList.remove("active");

    if (activeAlarmTaskId !== null) {
        const task = tasks.find(item => item.id === activeAlarmTaskId);

        if (task) {
            task.notified = true;
            saveTasks();
        }
    }

    activeAlarmTaskId = null;
}

document.getElementById("stopAlarm")
    .addEventListener("click", stopAlarm);

// ======================================
// FORM
// ======================================

function openForm(task = null) {
    editingTaskId = task ? task.id : null;

    document.getElementById("formTitle").textContent =
        task ? "Edit your task" : "Create a new task";

    document.getElementById("saveTask").textContent =
        task ? "Update Task" : "Save Task";

    taskTitle.value = task ? task.title : "";
    taskDescription.value = task ? task.description : "";
    taskPriority.value = task ? task.priority : "medium";
    taskDate.value = task ? task.dueDate : "";
    taskTime.value = task ? task.dueTime : "";
    taskReminder.checked = task ? task.reminder !== false : true;

    taskForm.hidden = false;
    taskTitle.focus();

    taskForm.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function closeForm() {
    taskForm.hidden = true;
    taskForm.reset();
    editingTaskId = null;
}

document.getElementById("openTaskForm")
    .addEventListener("click", () => openForm());

document.getElementById("emptyAddButton")
    .addEventListener("click", () => openForm());

document.getElementById("closeTaskForm")
    .addEventListener("click", closeForm);

document.getElementById("cancelTask")
    .addEventListener("click", closeForm);

// ======================================
// CREATE AND UPDATE TASKS
// ======================================

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = taskTitle.value.trim();
    const dueDate = taskDate.value;
    const dueTime = taskTime.value;

    if (!title) {
        showToast("Please enter a task name.");
        taskTitle.focus();
        return;
    }

    if (dueTime && !dueDate) {
        showToast("Select a due date before adding a time.");
        taskDate.focus();
        return;
    }

    if (taskReminder.checked && dueDate && dueTime) {
        const timestamp = new Date(
            `${dueDate}T${dueTime}:00`
        ).getTime();

        if (timestamp <= Date.now()) {
            showToast("Choose a future date and time for the reminder.");
            return;
        }

        const permission = await requestNotificationPermission();

        if (!permission) {
            taskReminder.checked = false;
            showToast("Reminder disabled because notification permission is unavailable.");
        }
    }

    if (editingTaskId !== null) {
        const existingTask = tasks.find(
            task => task.id === editingTaskId
        );

        if (!existingTask) return;

        const scheduleChanged =
            existingTask.dueDate !== dueDate ||
            existingTask.dueTime !== dueTime;

        existingTask.title = title;
        existingTask.description = taskDescription.value.trim();
        existingTask.priority = taskPriority.value;
        existingTask.dueDate = dueDate;
        existingTask.dueTime = dueTime;
        existingTask.reminder = taskReminder.checked;

        if (scheduleChanged || !taskReminder.checked) {
            existingTask.notified = false;
        }

        showToast("Task updated successfully!");
    } else {
        tasks.unshift({
            id: Date.now() + Math.random(),
            title,
            description: taskDescription.value.trim(),
            priority: taskPriority.value,
            dueDate,
            dueTime,
            reminder: taskReminder.checked,
            notified: false,
            completed: false,
            createdAt: Date.now()
        });

        showToast("New task added!");
    }

    saveTasks();
    closeForm();
    render();
});

// ======================================
// FILTERS
// ======================================

function setFilter(filter) {
    currentFilter = filter;

    document.querySelectorAll("[data-filter]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.filter === filter
        );
    });

    render();
}

document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        setFilter(button.dataset.filter);
    });
});

// ======================================
// SORTING
// ======================================

document.getElementById("sortTasks")
    .addEventListener("change", render);

function getSortedTasks(items) {
    const sort = document.getElementById("sortTasks").value;
    const sorted = [...items];

    if (sort === "newest") {
        sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sort === "oldest") {
        sorted.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sort === "priority") {
        const rank = { high: 3, medium: 2, low: 1 };
        sorted.sort((a, b) =>
            rank[b.priority] - rank[a.priority]
        );
    } else if (sort === "date") {
        sorted.sort((a, b) => {
            const first = a.dueDate || "9999-12-31";
            const second = b.dueDate || "9999-12-31";
            return first.localeCompare(second);
        });
    }

    return sorted;
}

// ======================================
// SAFE HTML
// ======================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}

// ======================================
// TASK CARD
// ======================================

function createTaskCard(task) {
    const item = document.createElement("article");

    item.className =
        `task-item ${task.completed ? "completed" : ""}`;

    const dueTimestamp = getDueTimestamp(task);
    const isOverdue =
        dueTimestamp !== null &&
        dueTimestamp < Date.now() &&
        !task.completed;

    const reminderEnabled =
        task.reminder !== false &&
        dueTimestamp !== null;

    const scheduleText = task.dueDate
        ? `${formatDate(task.dueDate)}${task.dueTime ? " · " + formatTime(task.dueTime) : ""}`
        : "No due date";

    item.innerHTML = `
        <input
            type="checkbox"
            class="task-check"
            aria-label="Mark task complete"
            ${task.completed ? "checked" : ""}>

        <div class="task-details">
            <h3>${escapeHTML(task.title)}</h3>

            ${task.description
                ? `<p>${escapeHTML(task.description)}</p>`
                : ""}

            <div class="task-meta">
                <span class="priority ${escapeHTML(task.priority)}">
                    ${escapeHTML(task.priority.toUpperCase())} PRIORITY
                </span>

                <span class="due-date ${isOverdue ? "overdue" : ""}">
                    ${isOverdue ? "Overdue · " : "📅 "}
                    ${escapeHTML(scheduleText)}
                </span>

                <span class="reminder-status ${reminderEnabled ? "enabled" : "disabled"}">
                    ${reminderEnabled ? "🔔 Reminder ON" : "🔕 Reminder OFF"}
                </span>
            </div>
        </div>

        <div class="task-actions">
            <button class="action-button edit" aria-label="Edit task">✎</button>
            <button class="action-button delete" aria-label="Delete task">×</button>
        </div>
    `;

    item.querySelector(".task-check").addEventListener("change", () => {
        task.completed = !task.completed;

        if (task.completed) {
            task.notified = true;
        }

        if (activeAlarmTaskId === task.id) {
            stopAlarm();
        }

        saveTasks();
        render();

        showToast(
            task.completed
                ? "Task completed! Great work."
                : "Task reopened."
        );
    });

    item.querySelector(".edit").addEventListener("click", () => {
        openForm(task);
    });

    item.querySelector(".delete").addEventListener("click", () => {
        if (!confirm(`Delete "${task.title}"?`)) return;

        if (activeAlarmTaskId === task.id) {
            stopAlarm();
        }

        tasks = tasks.filter(item => item.id !== task.id);

        saveTasks();
        render();
        showToast("Task deleted.");
    });

    return item;
}

// ======================================
// DASHBOARD
// ======================================

function updateDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = total - completed;

    document.getElementById("totalTasks").textContent = total;
    document.getElementById("pendingTasks").textContent = active;
    document.getElementById("doneTasks").textContent = completed;

    document.getElementById("allCount").textContent = total;
    document.getElementById("activeCount").textContent = active;
    document.getElementById("completedCount").textContent = completed;

    const percentage = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    document.getElementById("progressPercent").textContent =
        percentage + "%";

    document.getElementById("progressFill").style.width =
        percentage + "%";

    document.getElementById("progressCaption").textContent =
        total === 0
            ? "Let's get started!"
            : completed === total
                ? "Amazing! All your tasks are completed."
                : `${completed} of ${total} tasks completed. Keep going!`;

    document.getElementById("headingCount").textContent = total;

    document.getElementById("taskSummary").textContent =
        `${total} ${total === 1 ? "task" : "tasks"} · ${completed} completed`;
}

// ======================================
// RENDER
// ======================================

function render() {
    updateDashboard();

    let visibleTasks = tasks;

    if (currentFilter === "active") {
        visibleTasks = tasks.filter(task => !task.completed);
    } else if (currentFilter === "completed") {
        visibleTasks = tasks.filter(task => task.completed);
    }

    visibleTasks = getSortedTasks(visibleTasks);

    taskList.innerHTML = "";

    visibleTasks.forEach(task => {
        taskList.appendChild(createTaskCard(task));
    });

    const isEmpty = visibleTasks.length === 0;

    emptyState.classList.toggle("visible", isEmpty);
    taskList.style.display = isEmpty ? "none" : "flex";

    const emptyTitle = document.getElementById("emptyTitle");
    const emptyMessage = document.getElementById("emptyMessage");
    const emptyButton = document.getElementById("emptyAddButton");

    if (currentFilter === "completed") {
        emptyTitle.textContent = "Nothing completed yet";
        emptyMessage.textContent = "Complete a task and it will appear here.";
        emptyButton.style.display = "none";
    } else if (currentFilter === "active") {
        emptyTitle.textContent = "All caught up!";
        emptyMessage.textContent = "You have no pending tasks.";
        emptyButton.style.display = "none";
    } else {
        emptyTitle.textContent = "Your workspace is clear!";
        emptyMessage.textContent = "Add your first task and make today productive.";
        emptyButton.style.display = "inline-block";
    }

    document.getElementById("clearCompleted").style.visibility =
        tasks.some(task => task.completed) ? "visible" : "hidden";
}

// ======================================
// CLEAR COMPLETED
// ======================================

document.getElementById("clearCompleted")
    .addEventListener("click", () => {
        const completedCount = tasks.filter(
            task => task.completed
        ).length;

        if (!completedCount) return;

        if (!confirm(`Remove ${completedCount} completed task(s)?`)) {
            return;
        }

        tasks = tasks.filter(task => !task.completed);

        saveTasks();
        render();
        showToast("Completed tasks cleared.");
    });

// ======================================
// REMINDER ENGINE
// ======================================

function checkReminders() {
    const now = Date.now();
    let changed = false;

    tasks.forEach(task => {
        if (
            task.completed ||
            task.reminder === false ||
            task.notified === true
        ) {
            return;
        }

        const dueTimestamp = getDueTimestamp(task);

        if (dueTimestamp === null || dueTimestamp > now) {
            return;
        }

        task.notified = true;
        changed = true;

        triggerAlarm(task);
    });

    if (changed) {
        saveTasks();
        render();
    }
}

// Check every 10 seconds while the page is open.
checkReminders();
setInterval(checkReminders, 10000);

// Recheck when the user returns to the page.
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        checkReminders();
    }
});

window.addEventListener("focus", checkReminders);

// ======================================
// INITIALISE
// ======================================

updateNotificationStatus();
render();
