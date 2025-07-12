import { z } from "zod";
import {
  getAllTasks,
  clearAllTasks as modelClearAllTasks,
} from "../../models/taskModel.js";
import { getClearAllTasksPrompt } from "../../prompts/index.js";

// Clear all task tools
export const clearAllTasksSchema = z.object({
  confirm: z
    .boolean()
    .refine((val) => val === true, {
      message:
        "The clear operation must be confirmed clearly. Please set the confirm parameter to true to confirm this dangerous operation.",
    })
    .describe("Confirm that all unfinished tasks are deleted (this operation is irreversible)"),
});

export async function clearAllTasks({
  confirm,
}: z.infer<typeof clearAllTasksSchema>) {
  // Security check: If no confirmation is made, operation is refused
  if (!confirm) {
    return {
      content: [
        {
          type: "text" as const,
          text: await getClearAllTasksPrompt({ confirm: false }),
        },
      ],
    };
  }

  // Check if there are really tasks that need to be cleared
  const allTasks = await getAllTasks();
  if (allTasks.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: await getClearAllTasksPrompt({ isEmpty: true }),
        },
      ],
    };
  }

  // Perform a clear operation
  const result = await modelClearAllTasks();

  return {
    content: [
      {
        type: "text" as const,
        text: await getClearAllTasksPrompt({
          success: result.success,
          message: result.message,
          backupFile: result.backupFile,
        }),
      },
    ],
    isError: !result.success,
  };
}
