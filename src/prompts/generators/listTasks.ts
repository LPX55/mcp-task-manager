/**
 * listTasks prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";
import { Task, TaskStatus } from "../../types/index.js";

/**
 * listTasks prompt parameter interface
 */
export interface ListTasksPromptParams {
  status: string;
  tasks: Record<string, Task[]>;
  allTasks: Task[];
}

/**
 * Get the full prompt of listTasks
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getListTasksPrompt(
  params: ListTasksPromptParams
): Promise<string> {
  const { status, tasks, allTasks } = params;

  // If there is no task, display notification
  if (allTasks.length === 0) {
    const notFoundTemplate = await loadPromptFromTemplate(
      "listTasks/notFound.md"
    );
    const statusText = status === "all" ? "任何" : `任何 ${status} 的`;
    return generatePrompt(notFoundTemplate, {
      statusText: statusText,
    });
  }

  // Get counts of all states
  const statusCounts = Object.values(TaskStatus)
    .map((statusType) => {
      const count = tasks[statusType]?.length || 0;
      return `- **${statusType}**: ${count} 個任務`;
    })
    .join("\n");

  let filterStatus = "all";
  switch (status) {
    case "pending":
      filterStatus = TaskStatus.PENDING;
      break;
    case "in_progress":
      filterStatus = TaskStatus.IN_PROGRESS;
      break;
    case "completed":
      filterStatus = TaskStatus.COMPLETED;
      break;
  }

  let taskDetails = "";
  let taskDetailsTemplate = await loadPromptFromTemplate(
    "listTasks/taskDetails.md"
  );
  // Add detailed tasks in each state
  for (const statusType of Object.values(TaskStatus)) {
    const tasksWithStatus = tasks[statusType] || [];
    if (
      tasksWithStatus.length > 0 &&
      (filterStatus === "all" || filterStatus === statusType)
    ) {
      for (const task of tasksWithStatus) {
        let dependencies = "沒有依賴";
        if (task.dependencies && task.dependencies.length > 0) {
          dependencies = task.dependencies
            .map((d) => `\`${d.taskId}\``)
            .join(", ");
        }
        taskDetails += generatePrompt(taskDetailsTemplate, {
          name: task.name,
          id: task.id,
          description: task.description,
          createAt: task.createdAt,
          complatedSummary:
            (task.summary || "").substring(0, 100) +
            ((task.summary || "").length > 100 ? "..." : ""),
          dependencies: dependencies,
          complatedAt: task.completedAt,
        });
      }
    }
  }

  const indexTemplate = await loadPromptFromTemplate("listTasks/index.md");
  let prompt = generatePrompt(indexTemplate, {
    statusCount: statusCounts,
    taskDetailsTemplate: taskDetails,
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "LIST_TASKS");
}
