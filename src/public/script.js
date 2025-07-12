// Global variables
let tasks = [];
let selectedTaskId = null;
let searchTerm = "";
let sortOption = "date-asc";
let globalAnalysisResult = null; // New: Save global analysis results
let svg, g, simulation;
let width, height; // << New: Define width and height as global variables
let isGraphInitialized = false; // << New: Tracking whether the chart has been initialized
let zoom; // << Added: Save the zoom behavior object

// New: i18n global variable
let currentLang = "en"; // Preset language
let translations = {}; // Store loaded translations

// Dom Elements
const taskListElement = document.getElementById("task-list");
const taskDetailsContent = document.getElementById("task-details-content");
const statusFilter = document.getElementById("status-filter");
const currentTimeElement = document.getElementById("current-time");
const progressIndicator = document.getElementById("progress-indicator");
const progressCompleted = document.getElementById("progress-completed");
const progressInProgress = document.getElementById("progress-in-progress");
const progressPending = document.getElementById("progress-pending");
const progressLabels = document.getElementById("progress-labels");
const dependencyGraphElement = document.getElementById("dependency-graph");
const globalAnalysisResultElement = document.getElementById(
  "global-analysis-result"
); // Assume that there is this element in HTML
const langSwitcher = document.getElementById("lang-switcher"); // << Added: Get the switcher element
const resetViewBtn = document.getElementById("reset-view-btn"); // << New: Get reset button element

// initialization
document.addEventListener("DOMContentLoaded", () => {
  // fetchTasks(); //Will be triggered by initI18n()
  initI18n(); // << Added: Initialize i18n
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
  updateDimensions(); // << New: Updated size during initialization

  // Event Listener
  // statusFilter.addEventListener("change", renderTasks); //Will be triggered by changeLanguage or after applyTranslations
  if (statusFilter) {
    statusFilter.addEventListener("change", renderTasks);
  }

  // New: Reset view button event listening
  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", resetView);
  }

  // New: Search and sort event listening
  const searchInput = document.getElementById("search-input");
  const sortOptions = document.getElementById("sort-options");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value.toLowerCase();
      renderTasks();
    });
  }

  if (sortOptions) {
    sortOptions.addEventListener("change", (e) => {
      sortOption = e.target.value;
      renderTasks();
    });
  }

  // New: Set up SSE connection
  setupSSE();

  // New: Language switch event monitoring
  if (langSwitcher) {
    langSwitcher.addEventListener("change", (e) =>
      changeLanguage(e.target.value)
    );
  }

  // New: Updated size when the window size changes
  window.addEventListener("resize", () => {
    updateDimensions();
    if (svg && simulation) {
      svg.attr("viewBox", [0, 0, width, height]);
      simulation.force("center", d3.forceCenter(width / 2, height / 2));
      simulation.alpha(0.3).restart();
    }
  });
});

// New: i18n core function
// 1. Language Detection (URL Parameters > navigator.language > 'en')
function detectLanguage() {
  // 1. Preferential reading from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get("lang");
  if (urlLang && ["en", "zh-TW"].includes(urlLang)) {
    return urlLang;
  }

  // 2. Check the browser language (remove localStorage check)
  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang) {
    if (browserLang.toLowerCase().startsWith("zh-tw")) return "zh-TW";
    if (browserLang.toLowerCase().startsWith("zh")) return "zh-TW"; // Simplified Chinese fallback to Traditional Chinese
    if (browserLang.toLowerCase().startsWith("en")) return "en";
  }

  // 3. Preset value
  return "en";
}

// 2. Load the translation file asynchronously
async function loadTranslations(lang) {
  try {
    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok) {
      throw new Error(
        `Failed to load ${lang}.json, status: ${response.status}`
      );
    }
    translations = await response.json();
    console.log(`Translations loaded for ${lang}`);
  } catch (error) {
    console.error("Error loading translations:", error);
    if (lang !== "en") {
      console.warn(`Falling back to English translations.`);
      await loadTranslations("en"); // Fallback to English
    } else {
      translations = {}; // Clear translations if even English fails
      // Maybe display a more persistent error message?
      alert("Critical error: Could not load language files.");
    }
  }
}

// 3. Translation functions
function translate(key, replacements = {}) {
  let translated = translations[key] || key; // Fallback to key itself
  // Simple placeholder replacement (e.g. {message})
  for (const placeholder in replacements) {
    translated = translated.replace(
      `{${placeholder}}`,
      replacements[placeholder]
    );
  }
  return translated;
}

// 4. Application translation to DOM (process textContent, placeholder, title)
function applyTranslations() {
  console.log("Applying translations for:", currentLang);
  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.dataset.i18nKey;
    const translatedText = translate(key);

    // Prioritize specific attributes
    if (el.hasAttribute("placeholder")) {
      el.placeholder = translatedText;
    } else if (el.hasAttribute("title")) {
      el.title = translatedText;
    } else if (el.tagName === "OPTION") {
      el.textContent = translatedText;
      // Translate value if needed, but usually not
    } else {
      // For most elements, set textContent
      el.textContent = translatedText;
    }
  });
  // Manually update elements without data-key (if any)
  // For example, if the footer time format needs to be localized, it can be handled here
  // updateCurrentTime(); //Make sure the time format may also be updated (if required)
}

// 5. Initialize i18n
async function initI18n() {
  currentLang = detectLanguage();
  console.log(`Initializing i18n with language: ${currentLang}`);
  // << Added: Set the initial value of the switch >>
  if (langSwitcher) {
    langSwitcher.value = currentLang;
  }
  await loadTranslations(currentLang);
  applyTranslations();
  await fetchTasks();
}

// New: Language Switching Function
function changeLanguage(lang) {
  if (!lang || !["en", "zh-TW"].includes(lang)) {
    console.warn(`Invalid language selected: ${lang}. Defaulting to English.`);
    lang = "en";
  }
  currentLang = lang;
  console.log(`Changing language to: ${currentLang}`);
  loadTranslations(currentLang)
    .then(() => {
      console.log("Translations reloaded, applying...");
      applyTranslations();
      console.log("Re-rendering components...");
      // Re-render the components that need translation
      renderTasks();
      if (selectedTaskId) {
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task) {
          selectTask(selectedTaskId); // Make sure to pass the ID and let selectTask re-find and render
        } else {
          // If the selected task does not exist, clear details
          taskDetailsContent.innerHTML = `<p class="placeholder">${translate(
            "task_details_placeholder"
          )}</p>`;
          selectedTaskId = null;
          highlightNode(null);
        }
      } else {
        // If no task is selected, make sure the details panel displays placeholder
        taskDetailsContent.innerHTML = `<p class="placeholder">${translate(
          "task_details_placeholder"
        )}</p>`;
      }
      renderDependencyGraph(); // Rerender the chart (may contain placeholder)
      updateProgressIndicator(); // Re-render the progress bar (including labels)
      renderGlobalAnalysisResult(); // Re-render the global analysis (title)
      // Make sure the drop-down menu values are consistent with the current language
      if (langSwitcher) langSwitcher.value = currentLang;
      console.log("Language change complete.");
    })
    .catch((error) => {
      console.error("Error changing language:", error);
      // You can add user feedback, such as displaying error messages
      showTemporaryError("Failed to change language. Please try again."); // Need translation key
    });
}
// ---i18n core function ends ---

// Get task data
async function fetchTasks() {
  try {
    // Show loading during initial loading (now using translation)
    if (tasks.length === 0) {
      taskListElement.innerHTML = `<div class="loading">${translate(
        "task_list_loading"
      )}</div>`;
    }

    const response = await fetch("/api/tasks");

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const newTasks = data.tasks || [];

    // Extract global analysis results (find the first non-empty one)
    let foundAnalysisResult = null;
    for (const task of newTasks) {
      if (task.analysisResult) {
        foundAnalysisResult = task.analysisResult;
        break; // Finding one is enough
      }
    }
    // Update only if the result found is different from the current storage
    if (foundAnalysisResult !== globalAnalysisResult) {
      globalAnalysisResult = foundAnalysisResult;
      renderGlobalAnalysisResult(); // Update display
    }

    // ---Smart update logic (preliminary -still need to be improved to avoid flickering) ---
    // Simply compare task counts or identifiers to decide whether to re-render
    // Ideally, the content of each task should be compared and DOM updates
    const tasksChanged = didTasksChange(tasks, newTasks);

    if (tasksChanged) {
      tasks = newTasks; // Update the global task list
      console.log("Tasks updated via fetch, re-rendering...");
      renderTasks();
      updateProgressIndicator();
      renderDependencyGraph(); // Update the chart
    } else {
      console.log(
        "No significant task changes detected, skipping full re-render."
      );
      // If you don't need to re-render the list, you may just need to update the progress bar
      updateProgressIndicator();
      // Consider whether the chart needs to be updated (if the state may change)
      // renderDependencyGraph(); //Comment out temporarily unless the state changes are critical
    }

    // *** Remove setTimeout Polling ***
    // setTimeout(fetchTasks, 30000);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    // Avoid overwriting existing lists unless the initial load fails
    if (tasks.length === 0) {
      taskListElement.innerHTML = `<div class="error">${translate(
        "error_loading_tasks",
        { message: error.message }
      )}</div>`;
      if (progressIndicator) progressIndicator.style.display = "none";
      if (dependencyGraphElement)
        dependencyGraphElement.innerHTML = `<div class="error">${translate(
          "error_loading_graph"
        )}</div>`;
    } else {
      showTemporaryError(
        translate("error_updating_tasks", { message: error.message })
      );
    }
  }
}

// New: Set up Server-Sent Events connection
function setupSSE() {
  console.log("Setting up SSE connection to /api/tasks/stream");
  const evtSource = new EventSource("/api/tasks/stream");

  evtSource.onmessage = function (event) {
    console.log("SSE message received:", event.data);
    // You can make more complex judgments based on the event.data content, and update them as long as you receive a message.
  };

  evtSource.addEventListener("update", function (event) {
    console.log("SSE 'update' event received:", event.data);
    // Receive update event, re-get task list
    fetchTasks();
  });

  evtSource.onerror = function (err) {
    console.error("EventSource failed:", err);
    // Reconnect logic can be realized
    evtSource.close(); // Close the wrong connection
    // Try to reconnect after a delay of a while
    setTimeout(setupSSE, 5000); // Try again in 5 seconds
  };

  evtSource.onopen = function () {
    console.log("SSE connection opened.");
  };
}

// New: Helper function that compares whether there is any change in the task list (most comprehensive version)
function didTasksChange(oldTasks, newTasks) {
  if (!oldTasks || !newTasks) return true; // Handle initial load or error states

  if (oldTasks.length !== newTasks.length) {
    console.log("Task length changed.");
    return true; // Length change definitely needs update
  }

  const oldTaskMap = new Map(oldTasks.map((task) => [task.id, task]));
  const newTaskIds = new Set(newTasks.map((task) => task.id)); // For checking removed tasks

  // Check for removed tasks first
  for (const oldTask of oldTasks) {
    if (!newTaskIds.has(oldTask.id)) {
      console.log(`Task removed: ${oldTask.id}`);
      return true;
    }
  }

  // Check for new or modified tasks
  for (const newTask of newTasks) {
    const oldTask = oldTaskMap.get(newTask.id);
    if (!oldTask) {
      console.log(`New task found: ${newTask.id}`);
      return true; // New task ID found
    }

    // Compare relevant fields
    const fieldsToCompare = [
      "name",
      "description",
      "status",
      "notes",
      "implementationGuide",
      "verificationCriteria",
      "summary",
    ];

    for (const field of fieldsToCompare) {
      if (oldTask[field] !== newTask[field]) {
        // Handle null/undefined comparisons carefully if needed
        // e.g., !(oldTask[field] == null && newTask[field] == null) checks if one is null/undefined and the other isn't
        if (
          !(oldTask[field] === null && newTask[field] === null) &&
          !(oldTask[field] === undefined && newTask[field] === undefined)
        ) {
          console.log(`Task ${newTask.id} changed field: ${field}`);
          return true;
        }
      }
    }

    // Compare dependencies (array of strings or objects)
    if (!compareDependencies(oldTask.dependencies, newTask.dependencies)) {
      console.log(`Task ${newTask.id} changed field: dependencies`);
      return true;
    }

    // Compare relatedFiles (array of objects) -simple length check first
    if (!compareRelatedFiles(oldTask.relatedFiles, newTask.relatedFiles)) {
      console.log(`Task ${newTask.id} changed field: relatedFiles`);
      return true;
    }

    // Optional: Compare updatedAt as a final check if other fields seem identical
    if (oldTask.updatedAt?.toString() !== newTask.updatedAt?.toString()) {
      console.log(`Task ${newTask.id} changed field: updatedAt (fallback)`);
      return true;
    }
  }

  return false; // No significant changes detected
}

// Helper function to compare dependency arrays
function compareDependencies(deps1, deps2) {
  const arr1 = deps1 || [];
  const arr2 = deps2 || [];

  if (arr1.length !== arr2.length) return false;

  // Extract IDs whether they are strings or objects {taskId: string}
  const ids1 = new Set(
    arr1.map((dep) =>
      typeof dep === "object" && dep !== null ? dep.taskId : dep
    )
  );
  const ids2 = new Set(
    arr2.map((dep) =>
      typeof dep === "object" && dep !== null ? dep.taskId : dep
    )
  );

  if (ids1.size !== ids2.size) return false; // Different number of unique deps
  for (const id of ids1) {
    if (!ids2.has(id)) return false;
  }
  return true;
}

// Helper function to compare relatedFiles arrays (can be simple or complex)
function compareRelatedFiles(files1, files2) {
  const arr1 = files1 || [];
  const arr2 = files2 || [];

  if (arr1.length !== arr2.length) return false;

  // Simple comparison: check if paths and types are the same in the same order
  // For a more robust check, convert to Sets of strings like `path|type` or do deep object comparison
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i].path !== arr2[i].path || arr1[i].type !== arr2[i].type) {
      return false;
    }
    // Add more field comparisons if needed (description, lines, etc.)
    // if (arr1[i].description !== arr2[i].description) return false;
  }
  return true;
}

// New: Function that displays temporary error message
function showTemporaryError(message) {
  const errorElement = document.createElement("div");
  errorElement.className = "temporary-error";
  errorElement.textContent = message; // Keep the message itself
  document.body.appendChild(errorElement);
  setTimeout(() => {
    errorElement.remove();
  }, 3000); // Displayed for 3 seconds
}

// Rendering task list -***Further optimization is required to achieve smart updates ***
function renderTasks() {
  console.log("Rendering tasks..."); // Add log
  const filterValue = statusFilter.value;

  let filteredTasks = tasks;
  if (filterValue !== "all") {
    filteredTasks = filteredTasks.filter((task) => task.status === filterValue);
  }

  if (searchTerm) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    filteredTasks = filteredTasks.filter(
      (task) =>
        (task.name && task.name.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (task.description &&
          task.description.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }

  // Stores a collection of filtered task IDs for graphics rendering
  const filteredTaskIds = new Set(filteredTasks.map(task => task.id));

  filteredTasks.sort((a, b) => {
    switch (sortOption) {
      case "name-asc":
        return (a.name || "").localeCompare(b.name || "");
      case "name-desc":
        return (b.name || "").localeCompare(a.name || "");
      case "status":
        const statusOrder = { pending: 1, in_progress: 2, completed: 3 };
        return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
      case "date-asc":
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      case "date-desc":
      default:
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
  });

  // Update the display status of the graphics
  updateGraphVisibility(filteredTaskIds);

  // ---Simple and rough replacement (which will cause flicker) ---
  // TODO: Implement DOM Diffing or smarter update strategies
  if (filteredTasks.length === 0) {
    taskListElement.innerHTML = `<div class="placeholder">${translate(
      "task_list_empty"
    )}</div>`;
  } else {
    taskListElement.innerHTML = filteredTasks
      .map(
        (task) => `
            <div class="task-item status-${task.status.replace(
              "_",
              "-"
            )}" data-id="${task.id}" onclick="selectTask('${task.id}')">
            <h3>${task.name}</h3>
            <div class="task-meta">
                <span class="task-status status-${task.status.replace(
                  "_",
                  "-"
                )}">${getStatusText(task.status)}</span>
            </div>
            </div>
        `
      )
      .join("");
  }
  // ---End a simple and crude replacement ---

  // Reapply the selected status
  if (selectedTaskId) {
    const taskExists = tasks.some((t) => t.id === selectedTaskId);
    if (taskExists) {
      const selectedElement = document.querySelector(
        `.task-item[data-id="${selectedTaskId}"]`
      );
      if (selectedElement) {
        selectedElement.classList.add("selected");
      }
    } else {
      // If the selected task does not exist in the new list, clear the selection
      console.log(
        `Selected task ${selectedTaskId} no longer exists, clearing selection.`
      );
      selectedTaskId = null;
      taskDetailsContent.innerHTML = `<p class="placeholder">${translate(
        "task_details_placeholder"
      )}</p>`;
      highlightNode(null); // Clear chart highlighting
    }
  }
}

// New: Functions that update graph visibility
function updateGraphVisibility(filteredTaskIds) {
  if (!g) return;

  // Update the style of the node
  g.select(".nodes")
    .selectAll("g.node-item")
    .style("opacity", d => filteredTaskIds.has(d.id) ? 1 : 0.2)
    .style("filter", d => filteredTaskIds.has(d.id) ? "none" : "grayscale(80%)");

  // Update the style of the connection
  g.select(".links")
    .selectAll("line.link")
    .style("opacity", d => {
      const sourceVisible = filteredTaskIds.has(d.source.id || d.source);
      const targetVisible = filteredTaskIds.has(d.target.id || d.target);
      return (sourceVisible && targetVisible) ? 0.6 : 0.1;
    })
    .style("stroke", d => {
      const sourceVisible = filteredTaskIds.has(d.source.id || d.source);
      const targetVisible = filteredTaskIds.has(d.target.id || d.target);
      return (sourceVisible && targetVisible) ? "#999" : "#ccc";
    });

  // Update nodes and connection styles in thumbnails
  const minimapContent = svg.select(".minimap-content");
  
  minimapContent.selectAll(".minimap-node")
    .style("opacity", d => filteredTaskIds.has(d.id) ? 1 : 0.2)
    .style("filter", d => filteredTaskIds.has(d.id) ? "none" : "grayscale(80%)");

  minimapContent.selectAll(".minimap-link")
    .style("opacity", d => {
      const sourceVisible = filteredTaskIds.has(d.source.id || d.source);
      const targetVisible = filteredTaskIds.has(d.target.id || d.target);
      return (sourceVisible && targetVisible) ? 0.6 : 0.1;
    })
    .style("stroke", d => {
      const sourceVisible = filteredTaskIds.has(d.source.id || d.source);
      const targetVisible = filteredTaskIds.has(d.target.id || d.target);
      return (sourceVisible && targetVisible) ? "#999" : "#ccc";
    });
}

// New: Function that moves nodes to view center
function centerNode(nodeId) {
  if (!svg || !g || !simulation) return;

  const node = simulation.nodes().find(n => n.id === nodeId);
  if (!node) return;

  // Get the transform status of the current view
  const transform = d3.zoomTransform(svg.node());
  
  // Compute the required transformation to center the node
  const scale = transform.k; // Maintain the current zoom level
  const x = width / 2 - node.x * scale;
  const y = height / 2 - node.y * scale;

  // Use transition animation to move smoothly to a new position
  svg.transition()
    .duration(750) // 750ms transition time
    .call(zoom.transform, d3.zoomIdentity
      .translate(x, y)
      .scale(scale)
    );
}

// Modify the function that selects a task
function selectTask(taskId) {
  // Clear old selected status and highlight
  if (selectedTaskId) {
    const previousElement = document.querySelector(
      `.task-item[data-id="${selectedTaskId}"]`
    );
    if (previousElement) {
      previousElement.classList.remove("selected");
    }
  }

  // If you click on the same task again, uncheck
  if (selectedTaskId === taskId) {
    selectedTaskId = null;
    taskDetailsContent.innerHTML = `<p class="placeholder">${translate(
      "task_details_placeholder"
    )}</p>`;
    highlightNode(null); // Cancel highlight
    return;
  }

  selectedTaskId = taskId;

  // Add a new selected status
  const selectedElement = document.querySelector(
    `.task-item[data-id="${taskId}"]`
  );
  if (selectedElement) {
    selectedElement.classList.add("selected");
  }

  // Get and display task details
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    taskDetailsContent.innerHTML = `<div class="placeholder">${translate(
      "error_task_not_found"
    )}</div>`;
    return;
  }

  // ---Fill in task details safely ---
  // 1. Create the basic skeleton (using innerHTML, but replacing dynamic content with empty elements with ID)
  taskDetailsContent.innerHTML = `
    <div class="task-details-header">
      <h3 id="detail-name"></h3>
      <div class="task-meta">
        <span>${translate(
          "task_detail_status_label"
        )} <span id="detail-status" class="task-status"></span></span>
      </div>
    </div>
    
    <!-- 新增：條件顯示 Summary -->
    <div class="task-details-section" id="detail-summary-section" style="display: none;">
      <h4>${translate("task_detail_summary_title")}</h4>
      <p id="detail-summary"></p>
    </div>
    
    <div class="task-details-section">
      <h4>${translate("task_detail_description_title")}</h4>
      <p id="detail-description"></p>
    </div>
    
    <div class="task-details-section">
      <h4>${translate("task_detail_implementation_guide_title")}</h4>
      <pre id="detail-implementation-guide"></pre>
    </div>
    
    <div class="task-details-section">
      <h4>${translate("task_detail_verification_criteria_title")}</h4>
      <p id="detail-verification-criteria"></p>
    </div>
    
    <div class="task-details-section">
      <h4>${translate("task_detail_dependencies_title")}</h4>
      <div class="dependencies" id="detail-dependencies">
        <!-- Dependencies will be populated by JS -->
      </div>
    </div>
    
    <div class="task-details-section">
      <h4>${translate("task_detail_related_files_title")}</h4>
      <div class="related-files" id="detail-related-files">
        <!-- Related files will be populated by JS -->
      </div>
    </div>

    <div class="task-details-section">
      <h4>${translate("task_detail_notes_title")}</h4>
      <p id="detail-notes"></p>
    </div>
  `;

  // 2. Get the corresponding element and use textContent to fill content safely
  const detailName = document.getElementById("detail-name");
  const detailStatus = document.getElementById("detail-status");
  const detailDescription = document.getElementById("detail-description");
  const detailImplementationGuide = document.getElementById(
    "detail-implementation-guide"
  );
  const detailVerificationCriteria = document.getElementById(
    "detail-verification-criteria"
  );
  // Added: Get Summary-related elements
  const detailSummarySection = document.getElementById(
    "detail-summary-section"
  );
  const detailSummary = document.getElementById("detail-summary");
  const detailNotes = document.getElementById("detail-notes");
  const detailDependencies = document.getElementById("detail-dependencies");
  const detailRelatedFiles = document.getElementById("detail-related-files");

  if (detailName) detailName.textContent = task.name;
  if (detailStatus) {
    detailStatus.textContent = getStatusText(task.status);
    detailStatus.className = `task-status status-${task.status.replace(
      "_",
      "-"
    )}`;
  }
  if (detailDescription)
    detailDescription.textContent =
      task.description || translate("task_detail_no_description");
  if (detailImplementationGuide)
    detailImplementationGuide.textContent =
      task.implementationGuide ||
      translate("task_detail_no_implementation_guide");
  if (detailVerificationCriteria)
    detailVerificationCriteria.textContent =
      task.verificationCriteria ||
      translate("task_detail_no_verification_criteria");

  // Added: Fill in Summary (if present and completed)
  if (task.summary && detailSummarySection && detailSummary) {
    detailSummary.textContent = task.summary;
    detailSummarySection.style.display = "block"; // Display blocks
  } else if (detailSummarySection) {
    detailSummarySection.style.display = "none"; // Hide blocks
  }

  if (detailNotes)
    detailNotes.textContent = task.notes || translate("task_detail_no_notes");

  // 3. Dynamically generate dependencies and related files (these can contain secure HTML structures such as spans)
  if (detailDependencies) {
    const dependenciesHtml =
      task.dependencies && task.dependencies.length
        ? task.dependencies
            .map((dep) => {
              const depId =
                typeof dep === "object" && dep !== null && dep.taskId
                  ? dep.taskId
                  : dep;
              const depTask = tasks.find((t) => t.id === depId);
              // Translate the fallback text for unknown dependency
              const depName = depTask
                ? depTask.name
                : `${translate("task_detail_unknown_dependency")}(${depId})`;
              const span = document.createElement("span");
              span.className = "dependency-tag";
              span.dataset.id = depId;
              span.textContent = depName;
              span.onclick = () => highlightNode(depId);
              return span.outerHTML;
            })
            .join("")
        : `<span class="placeholder">${translate(
            "task_detail_no_dependencies"
          )}</span>`; // Translate placeholder
    detailDependencies.innerHTML = dependenciesHtml;
  }

  if (detailRelatedFiles) {
    const relatedFilesHtml =
      task.relatedFiles && task.relatedFiles.length
        ? task.relatedFiles
            .map((file) => {
              const span = document.createElement("span");
              span.className = "file-tag";
              span.title = file.description || "";
              const pathText = document.createTextNode(`${file.path} `);
              const small = document.createElement("small");
              small.textContent = `(${file.type})`; // Type is likely technical, maybe no translation needed?
              span.appendChild(pathText);
              span.appendChild(small);
              return span.outerHTML;
            })
            .join("")
        : `<span class="placeholder">${translate(
            "task_detail_no_related_files"
          )}</span>`; // Translate placeholder
    detailRelatedFiles.innerHTML = relatedFilesHtml;
  }

  // ---The original innerHTML assignment has been removed ---

  // Highlight the node and move it to the center
  highlightNode(taskId);
  centerNode(taskId);
}

// New: Reset view function
function resetView() {
  if (!svg || !simulation) return;

  // Add reset animation effect
  resetViewBtn.classList.add("resetting");

  // Computing View Center
  const centerX = width / 2;
  const centerY = height / 2;

  // Reset zoom and pan (using transform)
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity);

  // Reset all node locations near the center
  simulation.nodes().forEach(node => {
    node.x = centerX + (Math.random() - 0.5) * 50; // Random distribution near the center point
    node.y = centerY + (Math.random() - 0.5) * 50;
    node.fx = null; // Clear fixed position
    node.fy = null;
  });

  // Reset force-oriented simulation
  simulation
    .force("center", d3.forceCenter(centerX, centerY))
    .alpha(1) // Completely restart the simulation
    .restart();

  // Remove animation class after 750ms
  setTimeout(() => {
    resetViewBtn.classList.remove("resetting");
  }, 750);
}

// New: Initialize scaling behavior
function initZoom() {
  zoom = d3.zoom()
    .scaleExtent([0.1, 4]) // Set the zoom range
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
      updateMinimap(); // Update thumbnails when zooming
    });
  
  if (svg) {
    svg.call(zoom);
  }
}

// Render dependency graph -Modify to global view and enter/update/exit mode
function renderDependencyGraph() {
  if (!dependencyGraphElement || !window.d3) {
    console.warn("D3 or dependency graph element not found.");
    if (dependencyGraphElement) {
      if (!dependencyGraphElement.querySelector("svg")) {
        dependencyGraphElement.innerHTML = `<p class="placeholder">${translate("error_loading_graph_d3")}</p>`;
      }
    }
    return;
  }

  updateDimensions();

  // If there is no task, clear the chart and display the prompt
  if (tasks.length === 0) {
    dependencyGraphElement.innerHTML = `<p class="placeholder">${translate("dependency_graph_placeholder_empty")}</p>`;
    svg = null;
    g = null;
    simulation = null;
    return;
  }

  // 1. Prepare nodes and links
  const nodes = tasks.map((task) => ({
    id: task.id,
    name: task.name,
    status: task.status,
    x: simulation?.nodes().find((n) => n.id === task.id)?.x,
    y: simulation?.nodes().find((n) => n.id === task.id)?.y,
    fx: simulation?.nodes().find((n) => n.id === task.id)?.fx,
    fy: simulation?.nodes().find((n) => n.id === task.id)?.fy,
  }));

  const links = [];
  tasks.forEach((task) => {
    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies.forEach((dep) => {
        const sourceId = typeof dep === "object" ? dep.taskId : dep;
        const targetId = task.id;
        if (nodes.some((n) => n.id === sourceId) && nodes.some((n) => n.id === targetId)) {
          links.push({ source: sourceId, target: targetId });
        } else {
          console.warn(`Dependency link ignored: Task ${sourceId} or ${targetId} not found in task list.`);
        }
      });
    }
  });

  if (!svg) {
    // ---First rendering ---
    console.log("First render of dependency graph");
    dependencyGraphElement.innerHTML = "";

    svg = d3.select(dependencyGraphElement)
      .append("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet");

    // Add thumbnail background
    const minimapSize = Math.min(width, height) * 0.2; // Thumbnail size is 20% of the main view
    const minimapMargin = 40;
    
    // Create thumbnail container
    const minimap = svg.append("g")
      .attr("class", "minimap")
      .attr("transform", `translate(${width - minimapSize - minimapMargin}, ${height - minimapSize - minimapMargin*(height/width)})`);

    // Add thumbnail background
    minimap.append("rect")
      .attr("width", minimapSize)
      .attr("height", minimapSize)
      .attr("fill", "rgba(0, 0, 0, 0.2)")
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("rx", 4)
      .attr("ry", 4);

    // Create thumbnail content group
    minimap.append("g")
      .attr("class", "minimap-content");

    // Add a viewport indicator
    minimap.append("rect")
      .attr("class", "minimap-viewport");

    g = svg.append("g");

    // Initialize and add scaling behavior
    initZoom();

    // Add arrow definition
    g.append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");

    // Initialization force-oriented simulation
    simulation = d3.forceSimulation()
      .force("link", d3.forceLink().id((d) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30))
      // New: Horizontal distribution force is used to optimize the distribution of nodes in the horizontal direction, and determine the horizontal position of the node based on the inlet and outgoing degree of the node. The node with inlet is 0 (starting node) is on the left, the node with outgoing degree is 0 (terminal node) is on the right, and other nodes are distributed in the middle position.
      .force("x", d3.forceX().x(d => {
        // Calculate the incoming and outgoing degrees of nodes
        const inDegree = links.filter(l => (l.target.id || l.target) === d.id).length;
        const outDegree = links.filter(l => (l.source.id || l.source) === d.id).length;
        
        if (inDegree === 0) {
          // The node with an entry degree of 0 (start node) depends on the left
          return width * 0.2;
        } else if (outDegree === 0) {
          // Node with an outgoing degree of 0 (termination node) is right
          return width * 0.8;
        } else {
          // Other nodes are in the middle
          return width * 0.5;
        }
      }).strength(0.2))
      // New: Vertical distributed force based on node degree
      .force("y", d3.forceY().y(height / 2).strength(d => {
        // Calculate the total number of nodes (input + output)
        const inDegree = links.filter(l => (l.target.id || l.target) === d.id).length;
        const outDegree = links.filter(l => (l.source.id || l.source) === d.id).length;
        const totalDegree = inDegree + outDegree;
        
        // The greater the degree, the greater the force (basic force is 0.05, each connection increases by 0.03, maximum 0.3)
        return Math.min(0.05 + totalDegree * 0.03, 0.3);
      }))
      .on("tick", ticked);

    // Add a group for storing links and nodes
    g.append("g").attr("class", "links");
    g.append("g").attr("class", "nodes");
  } else {
    // ---Update chart rendering ---
    console.log("Updating dependency graph");
    svg.attr("viewBox", [0, 0, width, height]);
    simulation.force("center", d3.forceCenter(width / 2, height / 2));
  }

  // ---Pre-computing stable node locations ---
  // Replicate nodes and links for stabilization calculations
  const stableNodes = [...nodes];
  const stableLinks = [...links];
  
  // Temporarily create an emulator to calculate stable locations
  const stableSim = d3
    .forceSimulation(stableNodes)
    .force("link", d3.forceLink(stableLinks).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(30));
  
  // Preheating simulation to obtain stable position
  for (let i = 0; i < 10; i++) {
    stableSim.tick();
  }
  
  // Copy the stable location back to the original node
  stableNodes.forEach((stableNode) => {
    const originalNode = nodes.find(n => n.id === stableNode.id);
    if (originalNode) {
      originalNode.x = stableNode.x;
      originalNode.y = stableNode.y;
    }
  });
  
  // Stop the temporary emulator
  stableSim.stop();
  // ---Pre-operation ends ---

  // 3. Update link (no animation)
  const linkSelection = g
    .select(".links") // Select the g element to place the link
    .selectAll("line.link")
    .data(
      links,
      (d) => `${d.source.id || d.source}-${d.target.id || d.target}`
    ); // Key function is based on source/target ID

  // Exit -Remove old links directly
  linkSelection.exit().remove();

  // Enter -Add new link (no animation)
  const linkEnter = linkSelection
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke", "#999")
    .attr("marker-end", "url(#arrowhead)")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 1.5);

  // Set the link position immediately
  linkEnter
    .attr("x1", d => d.source.x || 0)
    .attr("y1", d => d.source.y || 0)
    .attr("x2", d => d.target.x || 0)
    .attr("y2", d => d.target.y || 0);

  // 4. Update node (no animation)
  const nodeSelection = g
    .select(".nodes") // Select the g element to place the node
    .selectAll("g.node-item")
    .data(nodes, (d) => d.id); // Use ID as key

  // Exit -Remove old nodes directly
  nodeSelection.exit().remove();

  // Enter -Add new node group (no animation, created directly at the final location)
  const nodeEnter = nodeSelection
    .enter()
    .append("g")
    .attr("class", (d) => `node-item status-${getStatusClass(d.status)}`) // Setting class using helper functions
    .attr("data-id", (d) => d.id)
    // Use pre-computed positions directly without scaling or transparency transitions
    .attr("transform", (d) => `translate(${d.x || 0}, ${d.y || 0})`)
    .call(drag(simulation)); // Add drag and drop

  // Add a circle to Enter selection set
  nodeEnter
    .append("circle")
    .attr("r", 10)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("fill", getNodeColor); // Set the color directly

  // Add text to Enter selection set
  nodeEnter
    .append("text")
    .attr("x", 15)
    .attr("y", 3)
    .text((d) => d.name)
    .attr("font-size", "10px")
    .attr("fill", "#ccc");

  // Add a title (tooltip) to Enter Selection Set
  nodeEnter
    .append("title")
    .text((d) => `${d.name} (${getStatusText(d.status)})`);

  // Add click event to Enter selection set
  nodeEnter.on("click", (event, d) => {
    selectTask(d.id);
    event.stopPropagation();
  });

  // Update -Update existing nodes immediately (no animation)
  nodeSelection
    .attr("transform", (d) => `translate(${d.x || 0}, ${d.y || 0})`)
    .attr("class", (d) => `node-item status-${getStatusClass(d.status)}`);

  nodeSelection
    .select("circle")
    .attr("fill", getNodeColor);

  // << New: Redefine drag function >>
  function drag(simulation) {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      // Unfixed position so that nodes can continue to be affected by force guidance (if required)
      // d.fx = null;
      // d.fy = null;
      // Or leave the fixed position until drag again
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
  // << end of drag function definition >>

  // 5. Update force-oriented simulation, but not start
  simulation.nodes(nodes); // Update the simulation node
  simulation.force("link").links(links); // Update simulation link
  
  // Update the target position of horizontal distribution force
  simulation.force("x").x(d => {
    const inDegree = links.filter(l => (l.target.id || l.target) === d.id).length;
    const outDegree = links.filter(l => (l.source.id || l.source) === d.id).length;
    
    if (inDegree === 0) {
      return width * 0.2;
    } else if (outDegree === 0) {
      return width * 0.8;
    } else {
      return width * 0.5;
    }
  });
  // Note: Remove the restart() call to prevent animations from jumping during refresh
}

// Tick function: Update node and link location
function ticked() {
  if (!g) return;

  // Update link location
  g.select(".links")
    .selectAll("line.link")
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);

  // Update node group location
  g.select(".nodes")
    .selectAll("g.node-item")
    // << Modify: Add coordinate backup value >>
    .attr("transform", (d) => `translate(${d.x || 0}, ${d.y || 0})`);

  // Update thumbnails
  updateMinimap();
}

// Function: Return color based on node data (example)
function getNodeColor(nodeData) {
  switch (nodeData.status) {
    case "已完成":
    case "completed":
      return "var(--secondary-color)";
    case "進行中":
    case "in_progress":
      return "var(--primary-color)";
    case "待處理":
    case "pending":
      return "#f1c40f"; // Consistent with progress bar and status tags
    default:
      return "#7f8c8d"; // Unknown status
  }
}

// Helper functions
function getStatusText(status) {
  switch (status) {
    case "pending":
      return translate("status_pending");
    case "in_progress":
      return translate("status_in_progress");
    case "completed":
      return translate("status_completed");
    default:
      return status;
  }
}

function updateCurrentTime() {
  const now = new Date();
  // Keep the original format, if localization time is required, you can use translate or other libraries here
  const timeString = now.toLocaleString(); // Consider whether the currentLang format needs to be based on currentLang
  if (currentTimeElement) {
    // Separate static text and dynamic time
    const footerTextElement = currentTimeElement.parentNode.childNodes[0];
    if (footerTextElement && footerTextElement.nodeType === Node.TEXT_NODE) {
      footerTextElement.nodeValue = translate("footer_copyright");
    }
    currentTimeElement.textContent = timeString;
  }
}
// Update project progress indicator
function updateProgressIndicator() {
  const totalTasks = tasks.length;
  if (totalTasks === 0) {
    progressIndicator.style.display = "none"; // Hide when there is no task
    return;
  }

  progressIndicator.style.display = "block"; // Make sure to display

  const completedTasks = tasks.filter(
    (task) => task.status === "completed" || task.status === "已完成"
  ).length;
  const inProgressTasks = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "進行中"
  ).length;
  const pendingTasks = tasks.filter(
    (task) => task.status === "pending" || task.status === "待處理"
  ).length;

  const completedPercent =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const inProgressPercent =
    totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0;
  const pendingPercent = totalTasks > 0 ? (pendingTasks / totalTasks) * 100 : 0;

  progressCompleted.style.width = `${completedPercent}%`;
  progressInProgress.style.width = `${inProgressPercent}%`;
  progressPending.style.width = `${pendingPercent}%`;

  // Update tags (using translate)
  progressLabels.innerHTML = `
    <span class="label-completed">${translate(
      "progress_completed"
    )}: ${completedTasks} (${completedPercent.toFixed(1)}%)</span>
    <span class="label-in-progress">${translate(
      "progress_in_progress"
    )}: ${inProgressTasks} (${inProgressPercent.toFixed(1)}%)</span>
    <span class="label-pending">${translate(
      "progress_pending"
    )}: ${pendingTasks} (${pendingPercent.toFixed(1)}%)</span>
    <span class="label-total">${translate(
      "progress_total"
    )}: ${totalTasks}</span>
  `;
}

// New: Rendering global analysis results
function renderGlobalAnalysisResult() {
  let targetElement = document.getElementById("global-analysis-result");

  // If the element does not exist, try to create and add it to the appropriate location (for example, before header or main content)
  if (!targetElement) {
    targetElement = document.createElement("div");
    targetElement.id = "global-analysis-result";
    targetElement.className = "global-analysis-section"; // Add style class
    // Try inserting after or before main
    const header = document.querySelector("header");
    const mainContent = document.querySelector("main");
    if (header && header.parentNode) {
      header.parentNode.insertBefore(targetElement, header.nextSibling);
    } else if (mainContent && mainContent.parentNode) {
      mainContent.parentNode.insertBefore(targetElement, mainContent);
    } else {
      // As a last resort, add to the beginning of the body
      document.body.insertBefore(targetElement, document.body.firstChild);
    }
  }

  if (globalAnalysisResult) {
    targetElement.innerHTML = `
            <h4 data-i18n-key="global_analysis_title">${translate(
              "global_analysis_title"
            )}</h4> 
            <pre>${globalAnalysisResult}</pre> 
        `;
    targetElement.style.display = "block";
  } else {
    targetElement.style.display = "none"; // Hide if there is no result
    targetElement.innerHTML = ""; // Clear content
  }
}

// New: Highlight nodes in dependency graph
function highlightNode(taskId, status = null) {
  if (!g || !window.d3) return;

  // Clear all nodes highlighting
  g.select(".nodes") // Start with g
    .selectAll("g.node-item")
    .classed("highlighted", false);

  if (!taskId) return;

  // Highlight selected nodes
  const selectedNode = g
    .select(".nodes") // Start with g
    .select(`g.node-item[data-id="${taskId}"]`);
  if (!selectedNode.empty()) {
    selectedNode.classed("highlighted", true);
    // Selected nodes can be optionally brought to the front
    // selectedNode.raise();
  }
}

// New: Helper function gets the status class (should be placed after the ticked function, before or after getNodeColor)
function getStatusClass(status) {
  return status ? status.replace(/_/g, "-") : "unknown"; // Replace all underscores
}

// New: Updated width and height function
function updateDimensions() {
  if (dependencyGraphElement) {
    width = dependencyGraphElement.clientWidth;
    height = dependencyGraphElement.clientHeight || 400;
  }
}

// Add thumbnail update function
function updateMinimap() {
  if (!svg || !simulation) return;

  const minimapSize = Math.min(width, height) * 0.2;
  const nodes = simulation.nodes();
  const links = simulation.force("link").links();

  // Calculate the boundary of the current graph (add padding)
  const padding = 20; // Add inner margin
  const xExtent = d3.extent(nodes, d => d.x);
  const yExtent = d3.extent(nodes, d => d.y);
  const graphWidth = (xExtent[1] - xExtent[0]) || width;
  const graphHeight = (yExtent[1] - yExtent[0]) || height;

  // Calculate the scaling and make sure padding is considered
  const scale = Math.min(
    minimapSize / (graphWidth + padding * 2),
    minimapSize / (graphHeight + padding * 2)
  ) * 0.9; // 0.9 as safety factor

  // Create a scaling function and add padding
  const minimapX = d3.scaleLinear()
    .domain([xExtent[0] - padding, xExtent[1] + padding])
    .range([0, minimapSize]);
  const minimapY = d3.scaleLinear()
    .domain([yExtent[0] - padding, yExtent[1] + padding])
    .range([0, minimapSize]);

  // Update connections in thumbnails
  const minimapContent = svg.select(".minimap-content");
  const minimapLinks = minimapContent.selectAll(".minimap-link")
    .data(links);

  minimapLinks.enter()
    .append("line")
    .attr("class", "minimap-link")
    .merge(minimapLinks)
    .attr("x1", d => minimapX(d.source.x))
    .attr("y1", d => minimapY(d.source.y))
    .attr("x2", d => minimapX(d.target.x))
    .attr("y2", d => minimapY(d.target.y))
    .attr("stroke", "#999")
    .attr("stroke-width", 0.5)
    .attr("stroke-opacity", 0.6);

  minimapLinks.exit().remove();

  // Update nodes in thumbnails
  const minimapNodes = minimapContent.selectAll(".minimap-node")
    .data(nodes);

  minimapNodes.enter()
    .append("circle")
    .attr("class", "minimap-node")
    .attr("r", 2)
    .merge(minimapNodes)
    .attr("cx", d => minimapX(d.x))
    .attr("cy", d => minimapY(d.y))
    .attr("fill", getNodeColor);

  minimapNodes.exit().remove();

  // Update viewport indicator
  const transform = d3.zoomTransform(svg.node());
  const viewportWidth = width / transform.k;
  const viewportHeight = height / transform.k;
  const viewportX = -transform.x / transform.k;
  const viewportY = -transform.y / transform.k;

  svg.select(".minimap-viewport")
    .attr("x", minimapX(viewportX))
    .attr("y", minimapY(viewportY))
    .attr("width", minimapX(viewportX + viewportWidth) - minimapX(viewportX))
    .attr("height", minimapY(viewportY + viewportHeight) - minimapY(viewportY));
}

// Function: Enable node drag (still unchanged)
// ... drag ...
