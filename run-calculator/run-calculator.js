(() => {
  const intervalsEl = document.getElementById("intervals");
  const addButton = document.getElementById("add-interval");
  const runSelect = document.getElementById("run-select");
  const runNameInput = document.getElementById("run-name");
  const renameRunButton = document.getElementById("rename-run");
  const runFields = document.querySelector("[data-run-fields]");
  const addRunButton = document.getElementById("add-run");
  const removeRunButton = document.getElementById("remove-run");
  const shareButton = document.getElementById("share-run");
  const resetButton = document.getElementById("reset-intervals");
  const totalDistanceEl = document.getElementById("total-distance");
  const totalTimeEl = document.getElementById("total-time");
  const shareStatusEl = document.getElementById("share-status");
  const STORAGE_KEY = "run-calculator-intervals";
  const SHARE_PARAM = "run";

  if (
    !intervalsEl ||
    !addButton ||
    !runSelect ||
    !runNameInput ||
    !renameRunButton ||
    !runFields ||
    !addRunButton ||
    !removeRunButton ||
    !shareButton ||
    !resetButton ||
    !totalDistanceEl ||
    !totalTimeEl ||
    !shareStatusEl
  ) {
    return;
  }

  let intervalCount = 0;
  let isRestoring = false;
  let runs = [];
  let activeRunId = null;

  const storage = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return null;
        }
        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    },
    save(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        return;
      }
    },
    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        return;
      }
    },
  };

  const encodeIntervals = (data) => {
    try {
      const json = JSON.stringify(data);
      return btoa(encodeURIComponent(json));
    } catch (error) {
      return "";
    }
  };

  const decodeIntervals = (value) => {
    try {
      const json = decodeURIComponent(atob(value));
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        return { runs: [{ id: crypto.randomUUID(), name: "Run 1", intervals: parsed }], activeRunId: null };
      }
      if (parsed && Array.isArray(parsed.runs)) {
        return parsed;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const formatTime = (totalSeconds) => {
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  };

  const formatDistance = (distance) => `${distance.toFixed(2)} km`;

  const sanitizeNumber = (value, min = 0, max = Infinity) => {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Math.min(max, Math.max(min, parsed));
  };

  const parseTimeInput = (value) => {
    const cleaned = String(value).trim();
    if (!cleaned) {
      return { totalSeconds: 0, normalized: "00:00" };
    }
    const parts = cleaned.split(":");
    const minutes = Math.floor(sanitizeNumber(parts[0] ?? "0", 0));
    const seconds = Math.floor(sanitizeNumber(parts[1] ?? "0", 0, 59));
    const totalSeconds = minutes * 60 + seconds;
    const normalized = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return { totalSeconds, normalized };
  };

  const createRun = (name, intervals = null) => ({
    id: crypto.randomUUID(),
    name,
    intervals: intervals ?? [],
  });

  const defaultIntervals = () => [
    { name: "Interval 1", time: "00:00", speed: 0 },
    { name: "Interval 2", time: "00:00", speed: 0 },
  ];

  const getActiveRun = () => runs.find((run) => run.id === activeRunId) ?? null;

  const persistActiveRun = () => {
    const activeRun = getActiveRun();
    if (!activeRun) {
      return;
    }
    activeRun.intervals = collectIntervals();
  };

  const updateRunSelect = () => {
    runSelect.innerHTML = "";
    runs.forEach((run, index) => {
      const option = document.createElement("option");
      option.value = run.id;
      option.textContent = run.name || `Run ${index + 1}`;
      runSelect.appendChild(option);
    });
    const activeRun = getActiveRun();
    if (activeRun) {
      runSelect.value = activeRun.id;
      runNameInput.value = activeRun.name || "";
    }
    removeRunButton.disabled = runs.length <= 1;
  };

  const renderRunIntervals = (intervals) => {
    intervalsEl.innerHTML = "";
    intervalCount = 0;
    isRestoring = true;
    intervals.forEach((interval) => addInterval(interval));
    isRestoring = false;
    updateRowLabels();
    updateTotals();
  };

  const setActiveRun = (runId) => {
    activeRunId = runId;
    const activeRun = getActiveRun();
    if (!activeRun) {
      return;
    }
    runNameInput.value = activeRun.name || "";
    renderRunIntervals(activeRun.intervals.length ? activeRun.intervals : defaultIntervals());
    updateRunSelect();
  };

  const buildRow = () => {
    intervalCount += 1;
    const row = document.createElement("div");
    row.className = "grid grid-cols-intervals gap-2 items-end p-2 rounded-xl border border-stroke bg-surface animate-rise";
    row.style.animationDelay = `${intervalCount * 70}ms`;
    row.dataset.index = String(intervalCount);
    row.dataset.intervalRow = "true";
    row.innerHTML = `
      <div class="flex flex-row items-center gap-1">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full min-w-10 h-10 p-0 border border-transparent bg-transparent text-muted cursor-grab active-grabbing font-inherit"
          draggable="true"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          data-drag-handle
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="8" cy="6" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="16" cy="6" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="16" cy="12" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="8" cy="18" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="16" cy="18" r="1.6" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs uppercase tracking-wide text-muted" for="name-${intervalCount}">Interval name</label>
        <input
          id="name-${intervalCount}"
          data-field="name"
          class="w-full font-inherit bg-input border border-stroke rounded-lg px-2-5 py-2 text-sm min-h-10 font-semibold focus-ring"
          type="text"
          placeholder="Interval ${intervalCount}"
          value="Interval ${intervalCount}"
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs uppercase tracking-wide text-muted" for="time-${intervalCount}">Time (mm:ss)</label>
        <input
          id="time-${intervalCount}"
          data-field="time"
          class="w-full font-inherit bg-input border border-stroke rounded-lg px-2-5 py-2 text-sm min-h-10 focus-ring"
          type="text"
          inputmode="numeric"
          placeholder="mm:ss"
          value="00:00"
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs uppercase tracking-wide text-muted" for="speed-${intervalCount}">Speed (km/h)</label>
        <input
          id="speed-${intervalCount}"
          data-field="speed"
          class="w-full font-inherit bg-input border border-stroke rounded-lg px-2-5 py-2 text-sm min-h-10 focus-ring"
          type="number"
          min="0"
          step="0.1"
          value="0"
        />
      </div>
      <div class="border border-dashed border-stroke rounded-lg bg-distance min-h-10 px-2-5 py-2 flex flex-col justify-center">
        <span class="text-xs uppercase tracking-wide text-muted">Distance</span>
        <span class="text-lg font-semibold" data-field="distance">0.00 km</span>
      </div>
      <div class="flex flex-row items-center gap-1">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-accent bg-transparent text-accent min-w-10 h-10 p-0 transition hover-raise hover-shadow focus-ring font-inherit"
          data-action="duplicate"
          aria-label="Duplicate interval"
          title="Duplicate interval"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-transparent bg-soft text-muted min-w-10 h-10 p-0 transition hover-raise hover-shadow focus-ring font-inherit"
          data-action="remove"
          aria-label="Remove interval"
          title="Remove interval"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="3 6 21 6" />
            <path d="M8 6V4h8v2" />
            <rect x="6" y="6" width="12" height="14" rx="2" ry="2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    `;
    return row;
  };

  const updateRowLabels = () => {
    const rows = Array.from(intervalsEl.querySelectorAll("[data-interval-row]"));
    rows.forEach((row, index) => {
      const nameInput = row.querySelector('[data-field="name"]');
      const nextLabel = `Interval ${index + 1}`;
      if (nameInput instanceof HTMLInputElement) {
        if (!nameInput.value || /^Interval \d+$/.test(nameInput.value)) {
          nameInput.value = nextLabel;
        }
        nameInput.placeholder = nextLabel;
      }
      row.dataset.index = String(index + 1);
    });
  };

  const collectIntervals = () =>
    Array.from(intervalsEl.querySelectorAll("[data-interval-row]")).map((row) => {
      const nameInput = row.querySelector('[data-field="name"]');
      const timeInput = row.querySelector('[data-field="time"]');
      const speedInput = row.querySelector('[data-field="speed"]');
      return {
        name: nameInput instanceof HTMLInputElement ? nameInput.value : "",
        time: timeInput instanceof HTMLInputElement ? timeInput.value : "00:00",
        speed: sanitizeNumber(
          speedInput instanceof HTMLInputElement ? speedInput.value : "0",
          0
        ),
      };
    });

  const updateTotals = () => {
    const rows = Array.from(intervalsEl.querySelectorAll("[data-interval-row]"));
    let totalSeconds = 0;
    let totalDistance = 0;

    rows.forEach((row) => {
      const timeInput = row.querySelector('[data-field="time"]');
      const speedInput = row.querySelector('[data-field="speed"]');
      const distanceEl = row.querySelector('[data-field="distance"]');

      if (!timeInput || !speedInput || !distanceEl) {
        return;
      }

      const speed = sanitizeNumber(speedInput.value, 0);
      if (Number(speedInput.value) !== speed) {
        speedInput.value = String(speed);
      }

      const timeInfo = parseTimeInput(timeInput.value);
      const intervalSeconds = timeInfo.totalSeconds;
      const intervalDistance = (intervalSeconds / 3600) * speed;

      totalSeconds += intervalSeconds;
      totalDistance += intervalDistance;

      distanceEl.textContent = formatDistance(intervalDistance);
    });

    totalDistanceEl.textContent = formatDistance(totalDistance);
    totalTimeEl.textContent = formatTime(totalSeconds);
    if (!isRestoring) {
      persistActiveRun();
      storage.save({ runs, activeRunId });
    }
  };

  const addInterval = (values = null, insertAfter = null) => {
    const row = buildRow();
    if (insertAfter && insertAfter.parentElement === intervalsEl) {
      insertAfter.insertAdjacentElement("afterend", row);
    } else {
      intervalsEl.appendChild(row);
    }
    if (values) {
      const nameInput = row.querySelector('[data-field="name"]');
      const timeInput = row.querySelector('[data-field="time"]');
      const speedInput = row.querySelector('[data-field="speed"]');

      if (nameInput) {
        nameInput.value = String(values.name ?? nameInput.value);
      }
      if (timeInput) {
        timeInput.value = String(values.time ?? "00:00");
      }
      if (speedInput) {
        speedInput.value = String(values.speed ?? 0);
      }
    }
    updateTotals();
    return row;
  };

  const resetIntervals = () => {
    const activeRun = getActiveRun();
    if (!activeRun) {
      return;
    }
    activeRun.intervals = defaultIntervals();
    renderRunIntervals(activeRun.intervals);
    storage.save({ runs, activeRunId });
  };

  const loadIntervals = () => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get(SHARE_PARAM);
    const decoded = shared ? decodeIntervals(shared) : null;
    const saved = storage.load();
    if (Array.isArray(saved)) {
      const run = createRun("Run 1", saved);
      runs = [run];
      activeRunId = run.id;
    } else if (saved && Array.isArray(saved.runs) && saved.runs.length) {
      runs = saved.runs.map((run, index) => ({
        id: run.id || crypto.randomUUID(),
        name: run.name || `Run ${index + 1}`,
        intervals: Array.isArray(run.intervals) ? run.intervals : [],
      }));
      activeRunId = saved.activeRunId && runs.some((run) => run.id === saved.activeRunId)
        ? saved.activeRunId
        : runs[0].id;
    }

    if (decoded && Array.isArray(decoded.runs) && decoded.runs.length) {
      const sharedRuns = decoded.runs.map((run, index) => ({
        id: run.id || crypto.randomUUID(),
        name: run.name || `Shared run ${index + 1}`,
        intervals: Array.isArray(run.intervals) ? run.intervals : [],
      }));
      const nextRuns = runs.length ? [...runs] : [];
      sharedRuns.forEach((sharedRun) => {
        const existingIndex = nextRuns.findIndex((run) => run.id === sharedRun.id);
        if (existingIndex >= 0) {
          const shouldReplace = window.confirm(
            `A run named "${nextRuns[existingIndex].name}" already exists. Replace it with the shared run?`
          );
          if (shouldReplace) {
            nextRuns[existingIndex] = sharedRun;
            activeRunId = sharedRun.id;
          }
          return;
        }
        nextRuns.push(sharedRun);
        if (!activeRunId) {
          activeRunId = sharedRun.id;
        }
      });
      runs = nextRuns;
      activeRunId = sharedRuns[0]?.id ?? activeRunId;
      const cleanedUrl = new URL(window.location.href);
      cleanedUrl.searchParams.delete(SHARE_PARAM);
      window.history.replaceState({}, "", cleanedUrl);
    }

    if (!runs.length) {
      return false;
    }
    updateRunSelect();
    setActiveRun(activeRunId || runs[0].id);
    storage.save({ runs, activeRunId });
    return true;
  };

  intervalsEl.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement) {
      updateTotals();
    }
  });

  let draggingRow = null;

  const clearDropIndicators = () => {
    intervalsEl
      .querySelectorAll(".shadow-drop-before, .shadow-drop-after")
      .forEach((row) => row.classList.remove("shadow-drop-before", "shadow-drop-after"));
  };

  intervalsEl.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const handle = target.closest("[data-drag-handle]");
    if (!handle) {
      return;
    }
    const row = handle.closest("[data-interval-row]");
    if (!row) {
      return;
    }
    draggingRow = row;
    row.classList.add("opacity-60", "shadow-drag");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "");
    }
  });

  intervalsEl.addEventListener("dragover", (event) => {
    if (!draggingRow) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const target = event.target instanceof Element ? event.target.closest("[data-interval-row]") : null;
    clearDropIndicators();
    if (!target || target === draggingRow) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const shouldInsertBefore = event.clientY < rect.top + rect.height / 2;
    target.classList.add(shouldInsertBefore ? "shadow-drop-before" : "shadow-drop-after");
  });

  intervalsEl.addEventListener("drop", (event) => {
    if (!draggingRow) {
      return;
    }
    event.preventDefault();
    const target = event.target instanceof Element ? event.target.closest("[data-interval-row]") : null;
    if (!target) {
      intervalsEl.appendChild(draggingRow);
    } else if (target !== draggingRow) {
      const rect = target.getBoundingClientRect();
      const shouldInsertBefore = event.clientY < rect.top + rect.height / 2;
      intervalsEl.insertBefore(draggingRow, shouldInsertBefore ? target : target.nextSibling);
    }
    updateRowLabels();
    clearDropIndicators();
    updateTotals();
  });

  intervalsEl.addEventListener("dragend", () => {
    if (draggingRow) {
      draggingRow.classList.remove("opacity-60", "shadow-drag");
    }
    clearDropIndicators();
    draggingRow = null;
  });

  intervalsEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const actionButton = target.closest("[data-action]");
    if (!(actionButton instanceof Element)) {
      return;
    }
    if (actionButton.dataset.action === "remove") {
    const row = actionButton.closest("[data-interval-row]");
      if (row) {
        row.remove();
        updateRowLabels();
        updateTotals();
      }
    }
    if (actionButton.dataset.action === "duplicate") {
      const row = actionButton.closest("[data-interval-row]");
      if (!row) {
        return;
      }
      const nameInput = row.querySelector('[data-field="name"]');
      const timeInput = row.querySelector('[data-field="time"]');
      const speedInput = row.querySelector('[data-field="speed"]');

      const timeInfo = parseTimeInput(timeInput?.value ?? "");
      const speed = sanitizeNumber(speedInput?.value ?? "0", 0);

      addInterval(
        {
          name: nameInput?.value ?? "",
          time: timeInfo.normalized,
          speed,
        },
        row
      );
      updateRowLabels();
    }
  });

  addButton.addEventListener("click", () => {
    addInterval();
    updateRowLabels();
  });
  resetButton.addEventListener("click", resetIntervals);

  addRunButton.addEventListener("click", () => {
    persistActiveRun();
    const nextIndex = runs.length + 1;
    const run = createRun(`Run ${nextIndex}`, defaultIntervals());
    runs.push(run);
    activeRunId = run.id;
    updateRunSelect();
    setActiveRun(activeRunId);
    storage.save({ runs, activeRunId });
  });

  removeRunButton.addEventListener("click", () => {
    if (runs.length <= 1) {
      return;
    }
    const currentIndex = runs.findIndex((run) => run.id === activeRunId);
    runs = runs.filter((run) => run.id !== activeRunId);
    const nextRun = runs[currentIndex] || runs[currentIndex - 1] || runs[0];
    activeRunId = nextRun ? nextRun.id : null;
    updateRunSelect();
    if (activeRunId) {
      setActiveRun(activeRunId);
    }
    storage.save({ runs, activeRunId });
  });

  runSelect.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLSelectElement)) {
      return;
    }
    persistActiveRun();
    activeRunId = event.target.value;
    setActiveRun(activeRunId);
    storage.save({ runs, activeRunId });
  });

  const startRename = () => {
    const activeRun = getActiveRun();
    if (!activeRun) {
      return;
    }
    runNameInput.value = activeRun.name || "";
    runFields.dataset.renaming = "true";
    runNameInput.focus();
    runNameInput.select();
  };

  const finishRename = () => {
    const activeRun = getActiveRun();
    if (!activeRun) {
      return;
    }
    const nextName = runNameInput.value.trim();
    if (nextName) {
      activeRun.name = nextName;
    }
    delete runFields.dataset.renaming;
    updateRunSelect();
    storage.save({ runs, activeRunId });
  };

  renameRunButton.addEventListener("click", startRename);
  runNameInput.addEventListener("blur", finishRename);
  runNameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    finishRename();
  });

  shareButton.addEventListener("click", async () => {
    persistActiveRun();
    const activeRun = getActiveRun();
    if (!activeRun) {
      shareStatusEl.textContent = "Pick a run before sharing.";
      return;
    }
    const encoded = encodeIntervals({ runs: [activeRun], activeRunId: activeRun.id });
    if (!encoded) {
      shareStatusEl.textContent = "Unable to create a shareable link.";
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_PARAM, encoded);
    window.history.replaceState({}, "", url);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url.toString());
        shareStatusEl.textContent = "Share link copied to clipboard.";
      } else {
        shareStatusEl.textContent = "Share link ready in the address bar.";
      }
    } catch (error) {
      shareStatusEl.textContent = "Share link ready in the address bar.";
    }
  });

  if (!loadIntervals()) {
    const run = createRun("Run 1", defaultIntervals());
    runs = [run];
    activeRunId = run.id;
    updateRunSelect();
    setActiveRun(activeRunId);
    storage.save({ runs, activeRunId });
  }
})();
