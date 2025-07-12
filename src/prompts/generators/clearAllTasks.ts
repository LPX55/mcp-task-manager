/**
 * clearAllTasks prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";

/**
 * clearAllTasks prompt parameter interface
 */
export interface ClearAllTasksPromptParams {
  confirm?: boolean;
  success?: boolean;
  message?: string;
  backupFile?: string;
  isEmpty?: boolean;
}

/**
 * Get the complete prompt of clearAllTasks
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getClearAllTasksPrompt(
  params: ClearAllTasksPromptParams
): Promise<string> {
  const { confirm, success, message, backupFile, isEmpty } = params;

  // Handle unconfirmed situations
  if (confirm === false) {
    const cancelTemplate = await loadPromptFromTemplate(
      "clearAllTasks/cancel.md"
    );
    return generatePrompt(cancelTemplate, {});
  }

  // Handle situations where no task needs to be cleared
  if (isEmpty) {
    const emptyTemplate = await loadPromptFromTemplate(
      "clearAllTasks/empty.md"
    );
    return generatePrompt(emptyTemplate, {});
  }

  // Handle a situation where the clearance is successful or failed
  const responseTitle = success ? "Success" : "Failure";

  // Generate backupInfo using templates
  const backupInfo = backupFile
    ? generatePrompt(
        await loadPromptFromTemplate("clearAllTasks/backupInfo.md"),
        {
          backupFile,
        }
      )
    : "";

  const indexTemplate = await loadPromptFromTemplate("clearAllTasks/index.md");
  const prompt = generatePrompt(indexTemplate, {
    responseTitle,
    message,
    backupInfo,
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "CLEAR_ALL_TASKS");
}
