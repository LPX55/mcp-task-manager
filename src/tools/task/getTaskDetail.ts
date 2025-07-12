import { z } from "zod";
import { searchTasksWithCommand } from "../../models/taskModel.js";
import { getGetTaskDetailPrompt } from "../../prompts/index.js";

// Get parameters for complete task details
export const getTaskDetailSchema = z.object({
  taskId: z
    .string()
    .min(1, {
      message: "The task ID cannot be empty, please provide a valid task ID",
    })
    .describe("Task ID to view details"),
});

// Get full details of the task
export async function getTaskDetail({
  taskId,
}: z.infer<typeof getTaskDetailSchema>) {
  try {
    // Use searchTasksWithCommand instead of getTaskById to implement memory area task search
    // Set isId to true, which means search by ID; page number is 1, and each page size is 1
    const result = await searchTasksWithCommand(taskId, true, 1, 1);

    // Check whether the task is found
    if (result.tasks.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `## Error\n\nThe task with ID \`${taskId}\` cannot be found. Please confirm whether the task ID is correct.`,
          },
        ],
        isError: true,
      };
    }

    // Get the found task (first and only one)
    const task = result.tasks[0];

    // Use the propt generator to get the final propt
    const prompt = await getGetTaskDetailPrompt({
      taskId,
      task,
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
    // Use the propt generator to get error messages
    const errorPrompt = await getGetTaskDetailPrompt({
      taskId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: errorPrompt,
        },
      ],
    };
  }
}
