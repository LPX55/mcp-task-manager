/**
 * planTask prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";
import { Task, TaskDependency } from "../../types/index.js";

/**
 * planTask prompt parameter interface
 */
export interface PlanTaskPromptParams {
  description: string;
  requirements?: string;
  existingTasksReference?: boolean;
  completedTasks?: Task[];
  pendingTasks?: Task[];
  memoryDir: string;
}

/**
 * Get the full prompt of planTask
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getPlanTaskPrompt(
  params: PlanTaskPromptParams
): Promise<string> {
  let tasksContent = "";
  if (
    params.existingTasksReference &&
    params.completedTasks &&
    params.pendingTasks
  ) {
    const allTasks = [...params.completedTasks, ...params.pendingTasks];
    // If a task exists, add relevant information
    if (allTasks.length > 0) {
      let completeTasksContent = "no completed tasks";

      // Process completed tasks
      if (params.completedTasks.length > 0) {
        completeTasksContent = "";
        // Display up to 10 completed tasks to avoid the prompt word being too long
        const tasksToShow =
          params.completedTasks.length > 10
            ? params.completedTasks.slice(0, 10)
            : params.completedTasks;

        tasksToShow.forEach((task, index) => {
          // Generate completion time information (if any)
          const completedTimeText = task.completedAt
            ? `   - completedAt：${task.completedAt.toLocaleString()}\n`
            : "";

          completeTasksContent += `{index}. **${task.name}** (ID: \`${
            task.id
          }\`)\n   - description：${
            task.description.length > 100
              ? task.description.substring(0, 100) + "..."
              : task.description
          }\n${completedTimeText}`;
          // If it is not the last task, add a newline
          if (index < tasksToShow.length - 1) {
            completeTasksContent += "\n\n";
          }
        });

        // If there are more tasks, the prompt will be displayed
        if (params.completedTasks.length > 10) {
          completeTasksContent += `\n\n*（僅顯示前10個，共 ${params.completedTasks.length} 個）*\n`;
        }
      }

      let unfinishedTasksContent = "no pending tasks";
      // Handle unfinished tasks
      if (params.pendingTasks && params.pendingTasks.length > 0) {
        unfinishedTasksContent = "";

        params.pendingTasks.forEach((task, index) => {
          const dependenciesText =
            task.dependencies && task.dependencies.length > 0
              ? `   - dependence：${task.dependencies
                  .map((dep: TaskDependency) => `\`${dep.taskId}\``)
                  .join(", ")}\n`
              : "";

          unfinishedTasksContent += `${index + 1}. **${task.name}** (ID: \`${
            task.id
          }\`)\n   - description：${
            task.description.length > 150
              ? task.description.substring(0, 150) + "..."
              : task.description
          }\n   - status：${task.status}\n${dependenciesText}`;

          // If it is not the last task, add a newline
          if (index < (params.pendingTasks?.length ?? 0) - 1) {
            unfinishedTasksContent += "\n\n";
          }
        });
      }

      const tasksTemplate = await loadPromptFromTemplate("planTask/tasks.md");
      tasksContent = generatePrompt(tasksTemplate, {
        completedTasks: completeTasksContent,
        unfinishedTasks: unfinishedTasksContent,
      });
    }
  }

  let thoughtTemplate = "";
  if (process.env.ENABLE_THOUGHT_CHAIN !== "false") {
    thoughtTemplate = await loadPromptFromTemplate("planTask/hasThought.md");
  } else {
    thoughtTemplate = await loadPromptFromTemplate("planTask/noThought.md");
  }
  const indexTemplate = await loadPromptFromTemplate("planTask/index.md");
  let prompt = generatePrompt(indexTemplate, {
    description: params.description,
    requirements: params.requirements || "No requirements",
    tasksTemplate: tasksContent,
    rulesPath: "shrimp-rules.md",
    memoryDir: params.memoryDir,
    thoughtTemplate: thoughtTemplate,
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "PLAN_TASK");
}
