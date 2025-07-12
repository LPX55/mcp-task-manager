import { z } from "zod";
import { UUID_V4_REGEX } from "../../utils/regex.js";
import {
  getTaskById,
  deleteTask as modelDeleteTask,
} from "../../models/taskModel.js";
import { TaskStatus } from "../../types/index.js";
import { getDeleteTaskPrompt } from "../../prompts/index.js";

// Delete Task Tool
export const deleteTaskSchema = z.object({
  taskId: z
    .string()
    .regex(UUID_V4_REGEX, {
      message: "The task ID format is invalid, please provide a valid UUID v4 format",
    })
    .describe("The unique identifier of the task to be deleted must be the task id that exists and is not completed in the system."),
});

export async function deleteTask({ taskId }: z.infer<typeof deleteTaskSchema>) {
  const task = await getTaskById(taskId);

  if (!task) {
    return {
      content: [
        {
          type: "text" as const,
          text: await getDeleteTaskPrompt({ taskId }),
        },
      ],
      isError: true,
    };
  }

  if (task.status === TaskStatus.COMPLETED) {
    return {
      content: [
        {
          type: "text" as const,
          text: await getDeleteTaskPrompt({
            taskId,
            task,
            isTaskCompleted: true,
          }),
        },
      ],
      isError: true,
    };
  }

  const result = await modelDeleteTask(taskId);

  return {
    content: [
      {
        type: "text" as const,
        text: await getDeleteTaskPrompt({
          taskId,
          task,
          success: result.success,
          message: result.message,
        }),
      },
    ],
    isError: !result.success,
  };
}
