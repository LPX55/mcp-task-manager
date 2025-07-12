import { z } from "zod";
import { UUID_V4_REGEX } from "../../utils/regex.js";
import {
  getTaskById,
  updateTaskStatus,
  canExecuteTask,
  assessTaskComplexity,
} from "../../models/taskModel.js";
import { TaskStatus, Task } from "../../types/index.js";
import { getExecuteTaskPrompt } from "../../prompts/index.js";
import { loadTaskRelatedFiles } from "../../utils/fileLoader.js";

//Task execution tool
export const executeTaskSchema = z.object({
  taskId: z
    .string()
    .regex(UUID_V4_REGEX, {
      message: "The task ID format is invalid, please provide a valid UUID v4 format",
    })
    .describe("The unique identifier of the task to be executed must be a valid task ID that exists in the system"),
});
export async function executeTask({
  taskId,
}: z.infer<typeof executeTaskSchema>) {
  try {
    // Check if the task exists
    const task = await getTaskById(taskId);
    if (!task) {
      return {
        content: [
          {
            type: "text" as const,
            text: `找不到ID為 \`${taskId}\` 的任務。請確認ID是否正確。`,
          },
        ],
      };
    }

    // Check whether the task can be executed (all dependencies have been completed)
    const executionCheck = await canExecuteTask(taskId);
    if (!executionCheck.canExecute) {
      const blockedByTasksText =
        executionCheck.blockedBy && executionCheck.blockedBy.length > 0
          ? `被以下未完成的依賴任務阻擋: ${executionCheck.blockedBy.join(", ")}`
          : "無法確定阻擋原因";

      return {
        content: [
          {
            type: "text" as const,
            text: `任務 "${task.name}" (ID: \`${taskId}\`) 目前無法執行。${blockedByTasksText}`,
          },
        ],
      };
    }

    // If the task has been marked as "In Progress", prompt the user
    if (task.status === TaskStatus.IN_PROGRESS) {
      return {
        content: [
          {
            type: "text" as const,
            text: `任務 "${task.name}" (ID: \`${taskId}\`) 已經處於進行中狀態。`,
          },
        ],
      };
    }

    // If the task has been marked "Completed", prompt the user
    if (task.status === TaskStatus.COMPLETED) {
      return {
        content: [
          {
            type: "text" as const,
            text: `任務 "${task.name}" (ID: \`${taskId}\`) 已經標記為完成。如需重新執行，請先使用 delete_task 刪除該任務並重新創建。`,
          },
        ],
      };
    }

    // Update the task status to "In Progress"
    await updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

    // Assess task complexity
    const complexityResult = await assessTaskComplexity(taskId);

    // Convert complexity results to the appropriate format
    const complexityAssessment = complexityResult
      ? {
          level: complexityResult.level,
          metrics: {
            descriptionLength: complexityResult.metrics.descriptionLength,
            dependenciesCount: complexityResult.metrics.dependenciesCount,
          },
          recommendations: complexityResult.recommendations,
        }
      : undefined;

    // Get dependency tasks to display completion summary
    const dependencyTasks: Task[] = [];
    if (task.dependencies && task.dependencies.length > 0) {
      for (const dep of task.dependencies) {
        const depTask = await getTaskById(dep.taskId);
        if (depTask) {
          dependencyTasks.push(depTask);
        }
      }
    }

    // Load the file contents related to the task
    let relatedFilesSummary = "";
    if (task.relatedFiles && task.relatedFiles.length > 0) {
      try {
        const relatedFilesResult = await loadTaskRelatedFiles(
          task.relatedFiles
        );
        relatedFilesSummary =
          typeof relatedFilesResult === "string"
            ? relatedFilesResult
            : relatedFilesResult.summary || "";
      } catch (error) {
        relatedFilesSummary =
          "Error loading related files, please check the files manually.";
      }
    }

    // Use the propt generator to get the final propt
    const prompt = await getExecuteTaskPrompt({
      task,
      complexityAssessment,
      relatedFilesSummary,
      dependencyTasks,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: prompt,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `執行任務時發生錯誤: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}
