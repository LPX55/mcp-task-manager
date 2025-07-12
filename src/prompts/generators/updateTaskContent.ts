/**
 * updateTaskContent prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";
import { Task, RelatedFile } from "../../types/index.js";

/**
 * updateTaskContent prompt parameter interface
 */
export interface UpdateTaskContentPromptParams {
  taskId: string;
  task?: Task;
  success?: boolean;
  message?: string;
  validationError?: string;
  emptyUpdate?: boolean;
  updatedTask?: Task;
}

/**
 * Get the full prompt of updateTaskContent
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getUpdateTaskContentPrompt(
  params: UpdateTaskContentPromptParams
): Promise<string> {
  const {
    taskId,
    task,
    success,
    message,
    validationError,
    emptyUpdate,
    updatedTask,
  } = params;

  // Handle the situation where the task does not exist
  if (!task) {
    const notFoundTemplate = await loadPromptFromTemplate(
      "updateTaskContent/notFound.md"
    );
    return generatePrompt(notFoundTemplate, {
      taskId,
    });
  }

  // Handle verification errors
  if (validationError) {
    const validationTemplate = await loadPromptFromTemplate(
      "updateTaskContent/validation.md"
    );
    return generatePrompt(validationTemplate, {
      error: validationError,
    });
  }

  // Handle empty updates
  if (emptyUpdate) {
    const emptyUpdateTemplate = await loadPromptFromTemplate(
      "updateTaskContent/emptyUpdate.md"
    );
    return generatePrompt(emptyUpdateTemplate, {});
  }

  // Handle updates successfully or failed
  const responseTitle = success ? "Success" : "Failure";
  let content = message || "";

  // Update successful and updated task details
  if (success && updatedTask) {
    const successTemplate = await loadPromptFromTemplate(
      "updateTaskContent/success.md"
    );

    // Combining relevant document information
    let filesContent = "";
    if (updatedTask.relatedFiles && updatedTask.relatedFiles.length > 0) {
      const fileDetailsTemplate = await loadPromptFromTemplate(
        "updateTaskContent/fileDetails.md"
      );

      // Grouped by file type
      const filesByType = updatedTask.relatedFiles.reduce((acc, file) => {
        if (!acc[file.type]) {
          acc[file.type] = [];
        }
        acc[file.type].push(file);
        return acc;
      }, {} as Record<string, RelatedFile[]>);

      // Generate content for each file type
      for (const [type, files] of Object.entries(filesByType)) {
        const filesList = files.map((file) => `\`${file.path}\``).join(", ");
        filesContent += generatePrompt(fileDetailsTemplate, {
          fileType: type,
          fileCount: files.length,
          filesList,
        });
      }
    }

    // Processing task notes
    const taskNotesPrefix = "- **Notes:** ";
    const taskNotes = updatedTask.notes
      ? `${taskNotesPrefix}${
          updatedTask.notes.length > 100
            ? `${updatedTask.notes.substring(0, 100)}...`
            : updatedTask.notes
        }\n`
      : "";

    // Generate detailed information about successful updates
    content += generatePrompt(successTemplate, {
      taskName: updatedTask.name,
      taskDescription:
        updatedTask.description.length > 100
          ? `${updatedTask.description.substring(0, 100)}...`
          : updatedTask.description,
      taskNotes: taskNotes,
      taskStatus: updatedTask.status,
      taskUpdatedAt: new Date(updatedTask.updatedAt).toISOString(),
      filesContent,
    });
  }

  const indexTemplate = await loadPromptFromTemplate(
    "updateTaskContent/index.md"
  );
  const prompt = generatePrompt(indexTemplate, {
    responseTitle,
    message: content,
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "UPDATE_TASK_CONTENT");
}
