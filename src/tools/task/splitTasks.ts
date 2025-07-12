import { z } from "zod";
import {
  getAllTasks,
  batchCreateOrUpdateTasks,
  clearAllTasks as modelClearAllTasks,
} from "../../models/taskModel.js";
import { RelatedFileType, Task } from "../../types/index.js";
import { getSplitTasksPrompt } from "../../prompts/index.js";

// Split Task Tool
export const splitTasksSchema = z.object({
  updateMode: z
    .enum(["append", "overwrite", "selective", "clearAllTasks"])
.describe(
      "Task update mode selection: 'append' (retain all existing tasks and add new tasks), 'overwrite' (clear all unfinished tasks and replace them completely, retain completed tasks), 'selective' (intelligent update: update existing tasks according to task name matching, retain tasks that are not in the list, recommended for task fine-tuning), 'clearAllTasks' (clear all tasks and create backups).\nPreset to 'clearAllTasks' mode, use other modes only if the user requests to change or modify the scheduled content"
    ),
  tasks: z
 .array(
      z.object({
        name: z
          .string()
          .max(100, {
            message: "The task name is too long, please limit it to 100 characters",
          })
          .describe("A concise and clear task name should clearly express the purpose of the task"),
        description: z
          .string()
          .min(10, {
            message: "The task description is too short, please provide more detailed content to ensure understanding",
          })
          .describe("Detailed task description, including implementation points, technical details and acceptance standards"),
        implementationGuide: z
          .string()
          .describe(
            "For specific implementation methods and steps for this specific task, please refer to the previous analysis results to provide a streamlined pseudocode"
          ),
dependencies: z
          .array(z.string())
          .optional()
          .describe(
            "This task depends on the pre-task ID or task name list, supports two reference methods, name reference is more intuitive, and is a string array"
          ),
        notes: z
          .string()
          .optional()
          .describe("Supplementary Notes, Special Handling Requirements or Implementation Recommendations (optional)"),
        relatedFiles: z
          .array(
            z.object({
              path: z
                .string()
                .min(1, {
                  message: "The file path cannot be empty",
                })
.describe("File path, which can be a path or an absolute path relative to the root directory of the project"),
              type: z
                .nativeEnum(RelatedFileType)
                .describe(
"File type (TO_MODIFY: to be modified, REFERENCE: Reference, CREATE: to be created, DEPENDENCY: to be dependent files, OTHER: others)"                ),
              description: z
                .string()
                .min(1, {
                  message: "The file description cannot be empty",
                })
                .describe("File description, used to illustrate the purpose and content of the file"),
              lineStart: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("The starting line of the relevant code block (optional)"),
              lineEnd: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("end line of related code block (optional)"),
            })
          )
.optional()
          .describe(
            "A list of tasks related to the file, used to record tasks related to the code files, reference materials, files to be created, etc. (optional)"
          ),
        verificationCriteria: z
          .string()
          .optional()
          .describe("Verification criteria and verification methods for this specific task"),
      })
    )
    .min(1, {
      message: "Please provide at least one task",
    })
    .describe(
      "Structured task list, each task should be atomic and have clear completion standards, avoid overly simple tasks, and simple modifications can be integrated with other tasks to avoid too many tasks."
    ),
  globalAnalysisResult: z
    .string()
    .optional()
    .describe("The task end goal, from the common part that was previously analyzed for all tasks"),
});

export async function splitTasks({
  updateMode,
  tasks,
  globalAnalysisResult,
}: z.infer<typeof splitTasksSchema>) {
  try {
    // Check whether the name in tasks is duplicated
    const nameSet = new Set();
    for (const task of tasks) {
      if (nameSet.has(task.name)) {
        return {
          content: [
            {
              type: "text" as const,
text: "There are duplicate task names in the tasks parameter, please make sure that each task name is unique",            },
          ],
        };
      }
      nameSet.add(task.name);
    }

    // Process tasks according to different update modes
    let message = "";
    let actionSuccess = true;
    let backupFile = null;
    let createdTasks: Task[] = [];
    let allTasks: Task[] = [];

    // Convert task data to a format that conforms to batch create or update tasks
    const convertedTasks = tasks.map((task) => ({
      name: task.name,
      description: task.description,
      notes: task.notes,
      dependencies: task.dependencies,
      implementationGuide: task.implementationGuide,
      verificationCriteria: task.verificationCriteria,
      relatedFiles: task.relatedFiles?.map((file) => ({
        path: file.path,
        type: file.type as RelatedFileType,
        description: file.description,
        lineStart: file.lineStart,
        lineEnd: file.lineEnd,
      })),
    }));

    // Handle clearAllTasks mode
    if (updateMode === "clearAllTasks") {
      const clearResult = await modelClearAllTasks();

      if (clearResult.success) {
        message = clearResult.message;
        backupFile = clearResult.backupFile;

        try {
          // Create a new task after clearing it
          createdTasks = await batchCreateOrUpdateTasks(
            convertedTasks,
            "append",
            globalAnalysisResult
          );
          message += `\n成功創建了 ${createdTasks.length} 個新任務。`;
        } catch (error) {
          actionSuccess = false;
          message += `\n創建新任務時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      } else {
        actionSuccess = false;
        message = clearResult.message;
      }
    } else {
      // For other modes, use batchCreateOrUpdateTasks directly
      try {
        createdTasks = await batchCreateOrUpdateTasks(
          convertedTasks,
          updateMode,
          globalAnalysisResult
        );

        // Generate messages according to different update modes
switch (updateMode) {
          case "append":
            message = `Successfully added ${createdTasks.length} new tasks. `;
            break;
          case "overwrite":
            message = `The unfinished task was successfully cleared and new tasks were created ${createdTasks.length}. `;
            break;
          case "selective":
            message = `Successfully selectively updated/created ${createdTasks.length} tasks. `;
            break;
        }
      } catch (error) {
        actionSuccess = false;
        message = `Task creation failed:${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }

    // Get all tasks for displaying dependencies
    try {
      allTasks = await getAllTasks();
    } catch (error) {
      allTasks = [...createdTasks]; // If the acquisition fails, at least use the task you just created
    }

    // Use the propt generator to get the final propt
    const prompt = await getSplitTasksPrompt({
      updateMode,
      createdTasks,
      allTasks,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: prompt,
        },
      ],
      ephemeral: {
        taskCreationResult: {
          success: actionSuccess,
          message,
          backupFilePath: backupFile,
        },
      },
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text:
            "An error occurred while performing task splitting: " +
            (error instanceof Error ? error.message : String(error)),
        },
      ],
    };
  }
}
