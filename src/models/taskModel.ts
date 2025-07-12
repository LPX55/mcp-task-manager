import {
  Task,
  TaskStatus,
  TaskDependency,
  TaskComplexityLevel,
  TaskComplexityThresholds,
  TaskComplexityAssessment,
  RelatedFile,
} from "../types/index.js";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import { getDataDir, getTasksFilePath, getMemoryDir } from "../utils/paths.js";

// Make sure to get the path to the project folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Data file path (changed asynchronously)
// const DATA_DIR = getDataDir();
// const TASKS_FILE = getTasksFilePath();

// Convert exec to promise form
const execPromise = promisify(exec);

// Make sure the data directory exists
async function ensureDataDir() {
  const DATA_DIR = await getDataDir();
  const TASKS_FILE = await getTasksFilePath();

  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  try {
    await fs.access(TASKS_FILE);
  } catch (error) {
    await fs.writeFile(TASKS_FILE, JSON.stringify({ tasks: [] }));
  }
}

// Read all tasks
async function readTasks(): Promise<Task[]> {
  await ensureDataDir();
  const TASKS_FILE = await getTasksFilePath();
  const data = await fs.readFile(TASKS_FILE, "utf-8");
  const tasks = JSON.parse(data).tasks;

  // Convert date string back to Date object
  return tasks.map((task: any) => ({
    ...task,
    createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
    updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
  }));
}

// Write to all tasks
async function writeTasks(tasks: Task[]): Promise<void> {
  await ensureDataDir();
  const TASKS_FILE = await getTasksFilePath();
  await fs.writeFile(TASKS_FILE, JSON.stringify({ tasks }, null, 2));
}

// Get all tasks
export async function getAllTasks(): Promise<Task[]> {
  return await readTasks();
}

// Get tasks based on id
export async function getTaskById(taskId: string): Promise<Task | null> {
  const tasks = await readTasks();
  return tasks.find((task) => task.id === taskId) || null;
}

// Create a new task
export async function createTask(
  name: string,
  description: string,
  notes?: string,
  dependencies: string[] = [],
  relatedFiles?: RelatedFile[]
): Promise<Task> {
  const tasks = await readTasks();

  const dependencyObjects: TaskDependency[] = dependencies.map((taskId) => ({
    taskId,
  }));

  const newTask: Task = {
    id: uuidv4(),
    name,
    description,
    notes,
    status: TaskStatus.PENDING,
    dependencies: dependencyObjects,
    createdAt: new Date(),
    updatedAt: new Date(),
    relatedFiles,
  };

  tasks.push(newTask);
  await writeTasks(tasks);

  return newTask;
}

// Update tasks
export async function updateTask(
  taskId: string,
  updates: Partial<Task>
): Promise<Task | null> {
  const tasks = await readTasks();
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    return null;
  }

  // Check whether the task has been completed. Completed tasks are not allowed to be updated (unless it is an explicitly allowed field)
  if (tasks[taskIndex].status === TaskStatus.COMPLETED) {
    // Only updates to the summary field (task summary) and relatedFiles field are allowed
    const allowedFields = ["summary", "relatedFiles"];
    const attemptedFields = Object.keys(updates);

    const disallowedFields = attemptedFields.filter(
      (field) => !allowedFields.includes(field)
    );

    if (disallowedFields.length > 0) {
      return null;
    }
  }

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...updates,
    updatedAt: new Date(),
  };

  await writeTasks(tasks);

  return tasks[taskIndex];
}

// Update task status
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<Task | null> {
  const updates: Partial<Task> = { status };

  if (status === TaskStatus.COMPLETED) {
    updates.completedAt = new Date();
  }

  return await updateTask(taskId, updates);
}

// Update task summary
export async function updateTaskSummary(
  taskId: string,
  summary: string
): Promise<Task | null> {
  return await updateTask(taskId, { summary });
}

// Update the task content
export async function updateTaskContent(
  taskId: string,
  updates: {
    name?: string;
    description?: string;
    notes?: string;
    relatedFiles?: RelatedFile[];
    dependencies?: string[];
    implementationGuide?: string;
    verificationCriteria?: string;
  }
): Promise<{ success: boolean; message: string; task?: Task }> {
  // Get the task and check if it exists
  const task = await getTaskById(taskId);

  if (!task) {
    return { success: false, message: "The specified task cannot be found" };
  }

  // Check if the task has been completed
  if (task.status === TaskStatus.COMPLETED) {
    return { success: false, message: "Unable to update completed tasks" };
  }

  // Build an updated object, including only the columns that actually need to be updated
  const updateObj: Partial<Task> = {};

  if (updates.name !== undefined) {
    updateObj.name = updates.name;
  }

  if (updates.description !== undefined) {
    updateObj.description = updates.description;
  }

  if (updates.notes !== undefined) {
    updateObj.notes = updates.notes;
  }

  if (updates.relatedFiles !== undefined) {
    updateObj.relatedFiles = updates.relatedFiles;
  }

  if (updates.dependencies !== undefined) {
    updateObj.dependencies = updates.dependencies.map((dep) => ({
      taskId: dep,
    }));
  }

  if (updates.implementationGuide !== undefined) {
    updateObj.implementationGuide = updates.implementationGuide;
  }

  if (updates.verificationCriteria !== undefined) {
    updateObj.verificationCriteria = updates.verificationCriteria;
  }

  // If there is no content to be updated, return in advance
  if (Object.keys(updateObj).length === 0) {
    return { success: true, message: "No content required updates are provided", task };
  }

  // Perform updates
  const updatedTask = await updateTask(taskId, updateObj);

  if (!updatedTask) {
    return { success: false, message: "An error occurred while updating a task" };
  }

  return {
    success: true,
    message: "Task content has been successfully updated",
    task: updatedTask,
  };
}

// Update task-related files
export async function updateTaskRelatedFiles(
  taskId: string,
  relatedFiles: RelatedFile[]
): Promise<{ success: boolean; message: string; task?: Task }> {
  // Get the task and check if it exists
  const task = await getTaskById(taskId);

  if (!task) {
    return { success: false, message: "The specified task cannot be found" };
  }

  // Check if the task has been completed
  if (task.status === TaskStatus.COMPLETED) {
    return { success: false, message: "Unable to update completed tasks" };
  }

  // Perform updates
  const updatedTask = await updateTask(taskId, { relatedFiles });

  if (!updatedTask) {
    return { success: false, message: "An error occurred while updating the task-related files" };
  }

  return {
    success: true,
    message: `The task-related files have been successfully updated, totaling ${relatedFiles.length} files`,
    task: updatedTask,
  };
}

// Bulk creation or update tasks
export async function batchCreateOrUpdateTasks(
  taskDataList: Array<{
    name: string;
    description: string;
    notes?: string;
    dependencies?: string[];
    relatedFiles?: RelatedFile[];
    implementationGuide?: string; // New: Implementation Guide
    verificationCriteria?: string; // New: Verification Standard
  }>,
  updateMode: "append" | "overwrite" | "selective" | "clearAllTasks", // Required parameters, specify task update strategy
  globalAnalysisResult?: string // New: Global analysis results
): Promise<Task[]> {
  // Read all existing tasks
  const existingTasks = await readTasks();

  // Process existing tasks according to update mode
  let tasksToKeep: Task[] = [];

  if (updateMode === "append") {
    // Append mode: Keep all existing tasks
    tasksToKeep = [...existingTasks];
  } else if (updateMode === "overwrite") {
    // Overwrite mode: Only completed tasks are kept, clear all unfinished tasks
    tasksToKeep = existingTasks.filter(
      (task) => task.status === TaskStatus.COMPLETED
    );
  } else if (updateMode === "selective") {
    // Selective update mode: selectively update based on the task name, retaining tasks that are not in the update list
    // 1. Extract the list of names of tasks to be updated
    const updateTaskNames = new Set(taskDataList.map((task) => task.name));

    // 2. Keep all tasks that do not appear in the update list
    tasksToKeep = existingTasks.filter(
      (task) => !updateTaskNames.has(task.name)
    );
  } else if (updateMode === "clearAllTasks") {
    // Clear all task modes: Clear the task list
    tasksToKeep = [];
  }

  // This mapping will be used to store a name to task id mapping, which supports referencing tasks by name
  const taskNameToIdMap = new Map<string, string>();

  // For selective update mode, first record the name and id of the existing task
  if (updateMode === "selective") {
    existingTasks.forEach((task) => {
      taskNameToIdMap.set(task.name, task.id);
    });
  }

  // Record the names and IDs of all tasks, whether they are retained or newly created tasks
  // This will be used to parse dependencies later
  tasksToKeep.forEach((task) => {
    taskNameToIdMap.set(task.name, task.id);
  });

  // Create a list of new tasks
  const newTasks: Task[] = [];

  for (const taskData of taskDataList) {
    // Check if it is selective update mode and the task name already exists
    if (updateMode === "selective" && taskNameToIdMap.has(taskData.name)) {
      // Get the id of the existing task
      const existingTaskId = taskNameToIdMap.get(taskData.name)!;

      // Find existing tasks
      const existingTaskIndex = existingTasks.findIndex(
        (task) => task.id === existingTaskId
      );

      // If an existing task is found and the task is not completed, update it
      if (
        existingTaskIndex !== -1 &&
        existingTasks[existingTaskIndex].status !== TaskStatus.COMPLETED
      ) {
        const taskToUpdate = existingTasks[existingTaskIndex];

        // Update basic information of the task, but retain the original id, creation time, etc.
        const updatedTask: Task = {
          ...taskToUpdate,
          name: taskData.name,
          description: taskData.description,
          notes: taskData.notes,
          // Dependencies will be processed later
          updatedAt: new Date(),
          // New: Save implementation guide (if any)
          implementationGuide: taskData.implementationGuide,
          // New: Save verification criteria (if any)
          verificationCriteria: taskData.verificationCriteria,
          // New: Save global analysis results (if any)
          analysisResult: globalAnalysisResult,
        };

        // Process related files (if any)
        if (taskData.relatedFiles) {
          updatedTask.relatedFiles = taskData.relatedFiles;
        }

        // Add updated tasks to the new task list
        newTasks.push(updatedTask);

        // Remove this task from tasks to keep because it has been updated and added to new tasks
        tasksToKeep = tasksToKeep.filter((task) => task.id !== existingTaskId);
      }
    } else {
      // Create a new task
      const newTaskId = uuidv4();

      // Add the name and id of the new task to the map
      taskNameToIdMap.set(taskData.name, newTaskId);

      const newTask: Task = {
        id: newTaskId,
        name: taskData.name,
        description: taskData.description,
        notes: taskData.notes,
        status: TaskStatus.PENDING,
        dependencies: [], // It will be filled later
        createdAt: new Date(),
        updatedAt: new Date(),
        relatedFiles: taskData.relatedFiles,
        // New: Save implementation guide (if any)
        implementationGuide: taskData.implementationGuide,
        // New: Save verification criteria (if any)
        verificationCriteria: taskData.verificationCriteria,
        // New: Save global analysis results (if any)
        analysisResult: globalAnalysisResult,
      };

      newTasks.push(newTask);
    }
  }

  // Handle dependencies between tasks
  for (let i = 0; i < taskDataList.length; i++) {
    const taskData = taskDataList[i];
    const newTask = newTasks[i];

    // If dependencies exist, process them
    if (taskData.dependencies && taskData.dependencies.length > 0) {
      const resolvedDependencies: TaskDependency[] = [];

      for (const dependencyName of taskData.dependencies) {
        // First try to interpret the dependency as task id
        let dependencyTaskId = dependencyName;

        // If the dependency doesn't look like uuid, try to interpret it as the task name
        if (
          !dependencyName.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          )
        ) {
          // If this name exists in the map, the corresponding id is used
          if (taskNameToIdMap.has(dependencyName)) {
            dependencyTaskId = taskNameToIdMap.get(dependencyName)!;
          } else {
            continue; // Skip this dependency
          }
        } else {
          // It is in uuid format, but it is necessary to confirm whether this id corresponds to the actual existing task.
          const idExists = [...tasksToKeep, ...newTasks].some(
            (task) => task.id === dependencyTaskId
          );
          if (!idExists) {
            continue; // Skip this dependency
          }
        }

        resolvedDependencies.push({ taskId: dependencyTaskId });
      }

      newTask.dependencies = resolvedDependencies;
    }
  }

  // Merge retained tasks and new tasks
  const allTasks = [...tasksToKeep, ...newTasks];

  // Write to the updated task list
  await writeTasks(allTasks);

  return newTasks;
}

// Check if the task can be executed (all dependencies have been completed)
export async function canExecuteTask(
  taskId: string
): Promise<{ canExecute: boolean; blockedBy?: string[] }> {
  const task = await getTaskById(taskId);

  if (!task) {
    return { canExecute: false };
  }

  if (task.status === TaskStatus.COMPLETED) {
    return { canExecute: false }; // Completed tasks do not need to be executed again
  }

  if (task.dependencies.length === 0) {
    return { canExecute: true }; // Tasks without dependencies can be executed directly
  }

  const allTasks = await readTasks();
  const blockedBy: string[] = [];

  for (const dependency of task.dependencies) {
    const dependencyTask = allTasks.find((t) => t.id === dependency.taskId);

    if (!dependencyTask || dependencyTask.status !== TaskStatus.COMPLETED) {
      blockedBy.push(dependency.taskId);
    }
  }

  return {
    canExecute: blockedBy.length === 0,
    blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
  };
}

// Delete a task
export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; message: string }> {
  const tasks = await readTasks();
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    return { success: false, message: "The specified task cannot be found" };
  }

  // Check the task status, completed tasks are not allowed to be deleted
  if (tasks[taskIndex].status === TaskStatus.COMPLETED) {
    return { success: false, message: "Unable to delete completed tasks" };
  }

  // Check if there are other tasks that depend on this task
  const allTasks = tasks.filter((_, index) => index !== taskIndex);
  const dependentTasks = allTasks.filter((task) =>
    task.dependencies.some((dep) => dep.taskId === taskId)
  );

  if (dependentTasks.length > 0) {
    const dependentTaskNames = dependentTasks
      .map((task) => `"${task.name}" (ID: ${task.id})`)
      .join(", ");
    return {
      success: false,
      message: `This task cannot be deleted because the following task depends on it: ${dependentTaskNames}`,
    };
  }

  // Perform a delete operation
  tasks.splice(taskIndex, 1);
  await writeTasks(tasks);

  return { success: true, message: "Task deletion successfully" };
}

// Assess task complexity
export async function assessTaskComplexity(
  taskId: string
): Promise<TaskComplexityAssessment | null> {
  const task = await getTaskById(taskId);

  if (!task) {
    return null;
  }

  // Evaluate various indicators
  const descriptionLength = task.description.length;
  const dependenciesCount = task.dependencies.length;
  const notesLength = task.notes ? task.notes.length : 0;
  const hasNotes = !!task.notes;

  // Evaluate complexity levels based on various indicators
  let level = TaskComplexityLevel.LOW;

  // Description length evaluation
  if (
    descriptionLength >= TaskComplexityThresholds.DESCRIPTION_LENGTH.VERY_HIGH
  ) {
    level = TaskComplexityLevel.VERY_HIGH;
  } else if (
    descriptionLength >= TaskComplexityThresholds.DESCRIPTION_LENGTH.HIGH
  ) {
    level = TaskComplexityLevel.HIGH;
  } else if (
    descriptionLength >= TaskComplexityThresholds.DESCRIPTION_LENGTH.MEDIUM
  ) {
    level = TaskComplexityLevel.MEDIUM;
  }

  // Dependency quantity evaluation (take the highest level)
  if (
    dependenciesCount >= TaskComplexityThresholds.DEPENDENCIES_COUNT.VERY_HIGH
  ) {
    level = TaskComplexityLevel.VERY_HIGH;
  } else if (
    dependenciesCount >= TaskComplexityThresholds.DEPENDENCIES_COUNT.HIGH &&
    level !== TaskComplexityLevel.VERY_HIGH
  ) {
    level = TaskComplexityLevel.HIGH;
  } else if (
    dependenciesCount >= TaskComplexityThresholds.DEPENDENCIES_COUNT.MEDIUM &&
    level !== TaskComplexityLevel.HIGH &&
    level !== TaskComplexityLevel.VERY_HIGH
  ) {
    level = TaskComplexityLevel.MEDIUM;
  }

  // Note the length evaluation (take the highest level)
  if (notesLength >= TaskComplexityThresholds.NOTES_LENGTH.VERY_HIGH) {
    level = TaskComplexityLevel.VERY_HIGH;
  } else if (
    notesLength >= TaskComplexityThresholds.NOTES_LENGTH.HIGH &&
    level !== TaskComplexityLevel.VERY_HIGH
  ) {
    level = TaskComplexityLevel.HIGH;
  } else if (
    notesLength >= TaskComplexityThresholds.NOTES_LENGTH.MEDIUM &&
    level !== TaskComplexityLevel.HIGH &&
    level !== TaskComplexityLevel.VERY_HIGH
  ) {
    level = TaskComplexityLevel.MEDIUM;
  }

  // Generate processing suggestions based on complexity level
  const recommendations: string[] = [];
//Recommended for low-complexity tasks
  if (level === TaskComplexityLevel.LOW) {
    recommendations.push("This task is relatively complex and can be executed directly");
    recommendations.push("It is recommended to set clear completion standards to ensure that acceptance is clear basis");
  }
  //Medium complex task recommendations
  else if (level === TaskComplexityLevel.MEDIUM) {
    recommendations.push("This task has some complexity, it is recommended to plan the execution steps in detail");
    recommendations.push("can be performed in phases and periodically checked to ensure accurate understanding and complete implementation");
    if (dependenciesCount > 0) {
      recommendations.push("Please check the completion status and output quality of all dependent tasks");
    }
  }
//High complexity task suggestions
  else if (level === TaskComplexityLevel.HIGH) {
    recommendations.push("This task is more complex, it is recommended to conduct sufficient analysis and planning first");
    recommendations.push("Consider splitting the task into smaller, independently executable subtasks");
    recommendations.push("Create clear milestones and checkpoints for easy tracking of progress and quality");
    if (
      dependenciesCount > TaskComplexityThresholds.DEPENDENCIES_COUNT.MEDIUM
    ) {
      recommendations.push(
        "There are many dependencies, so it is recommended to create a dependency diagram to ensure the execution order is correct."
      );
    }
  }//Extremely complex tasks recommendations
  else if (level === TaskComplexityLevel.VERY_HIGH) {
    recommendations.push("⚠️ This task is extremely complex and it is highly recommended to split it into multiple independent tasks");
    recommendations.push(
      "Conduct detailed analysis and planning before execution to clearly define the scope and interface of each subtask"
    );
    recommendations.push(
      "Conduct risk assessment of tasks, identify possible barriers and develop response strategies"
    );
    recommendations.push("Create specific testing and verification standards to ensure the output quality of each subtask");
    if (
      descriptionLength >= TaskComplexityThresholds.DESCRIPTION_LENGTH.VERY_HIGH
    ) {
      recommendations.push(
"The task description is very long, it is recommended to organize key points and establish a structured execution list"
      );
    }
    if (dependenciesCount >= TaskComplexityThresholds.DEPENDENCIES_COUNT.HIGH) {
      recommendations.push(
        "There are too many dependent tasks, and it is recommended to reevaluate the task boundaries to ensure that the task segmentation is reasonable"
      );
    }
  }

  return {
    level,
    metrics: {
      descriptionLength,
      dependenciesCount,
      notesLength,
      hasNotes,
    },
    recommendations,
  };
}

// Clear all tasks
export async function clearAllTasks(): Promise<{
  success: boolean;
  message: string;
  backupFile?: string;
}> {
  try {
    // Make sure the data directory exists
    await ensureDataDir();

    // Read existing tasks
    const allTasks = await readTasks();

    // If there is no task, return directly
    if (allTasks.length === 0) {
      return { success: true, message: "No tasks to be cleared" };
    }

    // Filter out completed tasks
    const completedTasks = allTasks.filter(
      (task) => task.status === TaskStatus.COMPLETED
    );

    // Create a backup file name
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\..+/, "");
    const backupFileName = `tasks_memory_${timestamp}.json`;

    // Make sure the memory directory exists
    const MEMORY_DIR = await getMemoryDir();
    try {
      await fs.access(MEMORY_DIR);
    } catch (error) {
      await fs.mkdir(MEMORY_DIR, { recursive: true });
    }

    // Create a backup path under the memory directory
    const memoryFilePath = path.join(MEMORY_DIR, backupFileName);

    // Write to the memory directory at the same time (contains only completed tasks)
    await fs.writeFile(
      memoryFilePath,
      JSON.stringify({ tasks: completedTasks }, null, 2)
    );

    // Clear task files
    await writeTasks([]);
return {
      success: true,
      message: `All tasks have been successfully cleared, a total of ${allTasks.length} tasks have been deleted, and ${completedTasks.length} completed tasks have been backed up to the memory directory`,
      backupFile: backupFileName,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error occurred while clearing the task: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

// Use system instructions to search for task memory
export async function searchTasksWithCommand(
  query: string,
  isId: boolean = false,
  page: number = 1,
  pageSize: number = 5
): Promise<{
  tasks: Task[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    hasMore: boolean;
  };
}> {
  // Read tasks in the current task file
  const currentTasks = await readTasks();
  let memoryTasks: Task[] = [];

  // Search tasks in memory folder
  const MEMORY_DIR = await getMemoryDir();

  try {
    // Make sure the memory folder exists
    await fs.access(MEMORY_DIR);

    // Generate search command
    const cmd = generateSearchCommand(query, isId, MEMORY_DIR);

    // If there is a search command, execute it
    if (cmd) {
      try {
        const { stdout } = await execPromise(cmd, {
          maxBuffer: 1024 * 1024 * 10,
        });

        if (stdout) {
          // Analyze search results and extract the corresponding archive path
          const matchedFiles = new Set<string>();

          stdout.split("\n").forEach((line) => {
            if (line.trim()) {
              // The format is usually: File path: Match content
              const filePath = line.split(":")[0];
              if (filePath) {
                matchedFiles.add(filePath);
              }
            }
          });

          // Limit the number of files to be read
          const MAX_FILES_TO_READ = 10;
          const sortedFiles = Array.from(matchedFiles)
            .sort()
            .reverse()
            .slice(0, MAX_FILES_TO_READ);

          // Only process files that meet the criteria
          for (const filePath of sortedFiles) {
            try {
              const data = await fs.readFile(filePath, "utf-8");
              const tasks = JSON.parse(data).tasks || [];

              // Format date field
              const formattedTasks = tasks.map((task: any) => ({
                ...task,
                createdAt: task.createdAt
                  ? new Date(task.createdAt)
                  : new Date(),
                updatedAt: task.updatedAt
                  ? new Date(task.updatedAt)
                  : new Date(),
                completedAt: task.completedAt
                  ? new Date(task.completedAt)
                  : undefined,
              }));

              // Further filter tasks to ensure compliance
              const filteredTasks = isId
                ? formattedTasks.filter((task: Task) => task.id === query)
                : formattedTasks.filter((task: Task) => {
                    const keywords = query
                      .split(/\s+/)
                      .filter((k) => k.length > 0);
                    if (keywords.length === 0) return true;

                    return keywords.every((keyword) => {
                      const lowerKeyword = keyword.toLowerCase();
                      return (
                        task.name.toLowerCase().includes(lowerKeyword) ||
                        task.description.toLowerCase().includes(lowerKeyword) ||
                        (task.notes &&
                          task.notes.toLowerCase().includes(lowerKeyword)) ||
                        (task.implementationGuide &&
                          task.implementationGuide
                            .toLowerCase()
                            .includes(lowerKeyword)) ||
                        (task.summary &&
                          task.summary.toLowerCase().includes(lowerKeyword))
                      );
                    });
                  });

              memoryTasks.push(...filteredTasks);
            } catch (error: unknown) {}
          }
        }
      } catch (error: unknown) {}
    }
  } catch (error: unknown) {}

  // Filter tasks that meet the criteria from the current task
  const filteredCurrentTasks = filterCurrentTasks(currentTasks, query, isId);

  // Merge the results and remove them
  const taskMap = new Map<string, Task>();

  // Current task priority
  filteredCurrentTasks.forEach((task) => {
    taskMap.set(task.id, task);
  });

  // Add memory tasks to avoid repetition
  memoryTasks.forEach((task) => {
    if (!taskMap.has(task.id)) {
      taskMap.set(task.id, task);
    }
  });

  // Merged results
  const allTasks = Array.from(taskMap.values());

  // Sort -sort in descending order by update or completion time
  allTasks.sort((a, b) => {
    // Priority sorted by completion time
    if (a.completedAt && b.completedAt) {
      return b.completedAt.getTime() - a.completedAt.getTime();
    } else if (a.completedAt) {
      return -1; // A is done but b is not done, a row is in front
    } else if (b.completedAt) {
      return 1; // B is done but a is not completed, b is in front
    }

    // Otherwise, sort by update time
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  // Pagination processing
  const totalResults = allTasks.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages || 1)); // Ensure page number is valid
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalResults);
  const paginatedTasks = allTasks.slice(startIndex, endIndex);

  return {
    tasks: paginatedTasks,
    pagination: {
      currentPage: safePage,
      totalPages: totalPages || 1,
      totalResults,
      hasMore: safePage < totalPages,
    },
  };
}

// Generate appropriate search commands based on the platform
function generateSearchCommand(
  query: string,
  isId: boolean,
  memoryDir: string
): string {
  // Safely escape user input
  const safeQuery = escapeShellArg(query);
  const keywords = safeQuery.split(/\s+/).filter((k) => k.length > 0);

  // Detect operating system type
  const isWindows = process.platform === "win32";

  if (isWindows) {
    // Windows environment, use the findstr command
    if (isId) {
      // Id search
      return `findstr /s /i /c:"${safeQuery}" "${memoryDir}\\*.json"`;
    } else if (keywords.length === 1) {
      // Single keyword
      return `findstr /s /i /c:"${safeQuery}" "${memoryDir}\\*.json"`;
    } else {
      // Multi-keyword search -Using PowerShell in Windows
      const keywordPatterns = keywords.map((k) => `'${k}'`).join(" -and ");
      return `powershell -Command "Get-ChildItem -Path '${memoryDir}' -Filter *.json -Recurse | Select-String -Pattern ${keywordPatterns} | ForEach-Object { $_.Path }"`;
    }
  } else {
    // Unix/linux/mac os environment, use grep command
    if (isId) {
      return `grep -r --include="*.json" "${safeQuery}" "${memoryDir}"`;
    } else if (keywords.length === 1) {
      return `grep -r --include="*.json" "${safeQuery}" "${memoryDir}"`;
    } else {
      // Multiple keywords use pipes to connect multiple grep commands
      const firstKeyword = escapeShellArg(keywords[0]);
      const otherKeywords = keywords.slice(1).map((k) => escapeShellArg(k));

      let cmd = `grep -r --include="*.json" "${firstKeyword}" "${memoryDir}"`;
      for (const keyword of otherKeywords) {
        cmd += ` | grep "${keyword}"`;
      }
      return cmd;
    }
  }
}

/**
 * Safely escape shell parameters to prevent command injection
 */
function escapeShellArg(arg: string): string {
  if (!arg) return "";

  // Remove all control characters and special characters
  return arg
    .replace(/[\x00-\x1F\x7F]/g, "") // Control characters
    .replace(/[&;`$"'<>|]/g, ""); // Shell special characters
}

// Filter the current task list
function filterCurrentTasks(
  tasks: Task[],
  query: string,
  isId: boolean
): Task[] {
  if (isId) {
    return tasks.filter((task) => task.id === query);
  } else {
    const keywords = query.split(/\s+/).filter((k) => k.length > 0);
    if (keywords.length === 0) return tasks;

    return tasks.filter((task) => {
      return keywords.every((keyword) => {
        const lowerKeyword = keyword.toLowerCase();
        return (
          task.name.toLowerCase().includes(lowerKeyword) ||
          task.description.toLowerCase().includes(lowerKeyword) ||
          (task.notes && task.notes.toLowerCase().includes(lowerKeyword)) ||
          (task.implementationGuide &&
            task.implementationGuide.toLowerCase().includes(lowerKeyword)) ||
          (task.summary && task.summary.toLowerCase().includes(lowerKeyword))
        );
      });
    });
  }
}
