/**
 * completeTask prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";
import { Task } from "../../types/index.js";

/**
 * completeTask prompt parameter interface
 */
export interface CompleteTaskPromptParams {
  task: Task;
  completionTime: string;
}

/**
 * Get the complete prompt of completeTask
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getCompleteTaskPrompt(
  params: CompleteTaskPromptParams
): Promise<string> {
  const { task, completionTime } = params;

  const indexTemplate = await loadPromptFromTemplate("completeTask/index.md");

  // Start building the basic prompt
  let prompt = generatePrompt(indexTemplate, {
    name: task.name,
    id: task.id,
    completionTime: completionTime,
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "COMPLETE_TASK");
}
