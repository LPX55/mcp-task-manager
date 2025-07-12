import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import { getAllTasks } from "../../models/taskModel.js";
import { TaskStatus, Task } from "../../types/index.js";
import { getPlanTaskPrompt } from "../../prompts/index.js";
import { getMemoryDir } from "../../utils/paths.js";

// Start planning tools
export const planTaskSchema = z.object({
  description: z
    .string()
    .min(10, {
      message: "The task description cannot be less than 10 characters. Please provide a more detailed description to ensure that the task objective is clear.",
    })
    .describe("A complete and detailed task problem description should include task objectives, background and expected results"),
  requirements: z
    .string()
    .optional()
    .describe("Special technical requirements, business constraints or quality standards for tasks (optional)"),
  existingTasksReference: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to refer to existing tasks as the basis for planning, for task adjustment and continuity planning"),
});

export async function planTask({
  description,
  requirements,
  existingTasksReference = false,
}: z.infer<typeof planTaskSchema>) {
  // Get the basic directory path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const PROJECT_ROOT = path.resolve(__dirname, "../../..");
  const MEMORY_DIR = await getMemoryDir();

  // Prepare the required parameters
  let completedTasks: Task[] = [];
  let pendingTasks: Task[] = [];

  // When existingTasksReference is true, load all tasks from the database as reference
  if (existingTasksReference) {
    try {
      const allTasks = await getAllTasks();

      // Divide tasks into two categories: completed and unfinished
      completedTasks = allTasks.filter(
        (task) => task.status === TaskStatus.COMPLETED
      );
      pendingTasks = allTasks.filter(
        (task) => task.status !== TaskStatus.COMPLETED
      );
    } catch (error) {}
  }

  // Use the propt generator to get the final propt
  const prompt = await getPlanTaskPrompt({
    description,
    requirements,
    existingTasksReference,
    completedTasks,
    pendingTasks,
    memoryDir: MEMORY_DIR,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: prompt,
      },
    ],
  };
}
