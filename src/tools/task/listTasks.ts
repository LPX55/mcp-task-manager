import { z } from "zod";
import { getAllTasks } from "../../models/taskModel.js";
import { TaskStatus } from "../../types/index.js";
import { getListTasksPrompt } from "../../prompts/index.js";

export const listTasksSchema = z.object({
  status: z
    .enum(["all", "pending", "in_progress", "completed"])
    .describe("The task status to be listed, select 'all' to list all tasks, or specify specific status"),
});

// List task tools
export async function listTasks({ status }: z.infer<typeof listTasksSchema>) {
  const tasks = await getAllTasks();
  let filteredTasks = tasks;
  switch (status) {
    case "all":
      break;
    case "pending":
      filteredTasks = tasks.filter(
        (task) => task.status === TaskStatus.PENDING
      );
      break;
    case "in_progress":
      filteredTasks = tasks.filter(
        (task) => task.status === TaskStatus.IN_PROGRESS
      );
      break;
    case "completed":
      filteredTasks = tasks.filter(
        (task) => task.status === TaskStatus.COMPLETED
      );
      break;
  }

  if (filteredTasks.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `## System Notification\n\nThere is currently no${
            status === "all" ? "any" : `any ${status} of`
          }Task. Please query other status tasks or use the "split_tasks" tool to create a task structure before performing subsequent operations.`,
        },
      ],
    };
  }

  const tasksByStatus = tasks.reduce((acc, task) => {
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {} as Record<string, typeof tasks>);

  // Use the propt generator to get the final propt
  const prompt = await getListTasksPrompt({
    status,
    tasks: tasksByStatus,
    allTasks: filteredTasks,
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
