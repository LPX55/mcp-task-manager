import { z } from "zod";
import { searchTasksWithCommand } from "../../models/taskModel.js";
import { getQueryTaskPrompt } from "../../prompts/index.js";

// Query task tool
export const queryTaskSchema = z.object({
  query: z
    .string()
    .min(1, {
      message: "The query content cannot be empty, please provide the task id or search for keywords",
    })
    .describe("Search and query text, which can be task id or multiple keywords (space separated)"),
  isId: z
    .boolean()
    .optional()
    .default(false)
    .describe("Specify whether it is id query mode, default is No (keyword mode)"),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("Page number, default is page 1"),
  pageSize: z
    .number()
    .int()
    .positive()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("The number of tasks displayed on each page is 5 by default and the maximum is 20 by default."),
});

export async function queryTask({
  query,
  isId = false,
  page = 1,
  pageSize = 3,
}: z.infer<typeof queryTaskSchema>) {
  try {
    // Search functions using system instructions
    const results = await searchTasksWithCommand(query, isId, page, pageSize);

    // Use the propt generator to get the final propt
    const prompt = await getQueryTaskPrompt({
      query,
      isId,
      tasks: results.tasks,
      totalTasks: results.pagination.totalResults,
      page: results.pagination.currentPage,
      pageSize,
      totalPages: results.pagination.totalPages,
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
          text: `## System Error\n\nAn error occurred while querying the task: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}
