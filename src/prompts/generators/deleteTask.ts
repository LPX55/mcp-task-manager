/**
 * deleteTask prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";
import { Task } from "../../types/index.js";

/**
 * deleteTask prompt parameter interface
 */
export interface DeleteTaskPromptParams {
  taskId: string;
  task?: Task;
  success?: boolean;
  message?: string;
  isTaskCompleted?: boolean;
}

/**
 * Get the full prompt of deleteTask
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getDeleteTaskPrompt(
  params: DeleteTaskPromptParams
): Promise<string> {
  const { taskId, task, success, message, isTaskCompleted } = params;

  // Handle the situation where the task does not exist
  if (!task) {
    const notFoundTemplate = await loadPromptFromTemplate(
      "deleteTask/notFound.md"
    );
    return generatePrompt(notFoundTemplate, {
      taskId,
    });
  }

  // Handle the task completed
  if (isTaskCompleted) {
    const completedTemplate = await loadPromptFromTemplate(
      "deleteTask/completed.md"
    );
    return generatePrompt(completedTemplate, {
      taskId: task.id,
      taskName: task.name,
    });
  }

  // Handle the situation where the deletion is successful or failed
  const responseTitle = success ? "Success" : "Failure";
  const indexTemplate = await loadPromptFromTemplate("deleteTask/index.md");
  const prompt = generatePrompt(indexTemplate, {
    responseTitle,
    message,
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "DELETE_TASK");
}
