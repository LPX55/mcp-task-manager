import { z } from "zod";
import { UUID_V4_REGEX } from "../../utils/regex.js";
import {
  getTaskById,
  updateTaskContent as modelUpdateTaskContent,
} from "../../models/taskModel.js";
import { RelatedFileType } from "../../types/index.js";
import { getUpdateTaskContentPrompt } from "../../prompts/index.js";

// Update Task Content Tool
export const updateTaskContentSchema = z.object({
  taskId: z
    .string()
.regex(UUID_V4_REGEX, {
      message: "The task ID format is invalid, please provide a valid UUID v4 format",
    })
    .describe("The unique identifier of the task to be updated must be the task ID that exists and is not completed in the system"),
  name: z.string().optional().describe("New name of task (optional)"),
  description: z.string().optional().describe("New description content of task (optional)"),
  notes: z.string().optional().describe("New supplementary description for tasks (optional)"),
  dependencies: z
    .array(z.string())
    .optional()
    .describe("New dependency of task (optional)"),
  relatedFiles: z
    .array(
      z.object({
        path: z
          .string()
.min(1, { message: "The file path cannot be empty, please provide a valid file path" })
          .describe("File path, which can be a path or an absolute path relative to the root directory of the project"),
        type: z
          .nativeEnum(RelatedFileType)
          .describe(
            "File-task relationship type (TO_MODIFY, REFERENCE, CREATE, DEPENDENCY, OTHER)"
          ),
        description: z.string().optional().describe("Supplementary description of the document (optional)"),
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
  implementationGuide: z
    .string()
    .optional()
    .describe("New Implementation Guide for Tasks (optional)"),
  verificationCriteria: z
    .string()
    .optional()
    .describe("New Verification Standard for Tasks (optional)"),
});

export async function updateTaskContent({
  taskId,
  name,
  description,
  notes,
  relatedFiles,
  dependencies,
  implementationGuide,
  verificationCriteria,
}: z.infer<typeof updateTaskContentSchema>) {
  if (relatedFiles) {
    for (const file of relatedFiles) {
      if (
        (file.lineStart && !file.lineEnd) ||
        (!file.lineStart && file.lineEnd) ||
        (file.lineStart && file.lineEnd && file.lineStart > file.lineEnd)
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: await getUpdateTaskContentPrompt({
                taskId,
                validationError:
"The line number setting is invalid: the start line and the end line must be set at the same time, and the start line must be smaller than the end line",              }),
            },
          ],
        };
      }
    }
  }

  if (
    !(
      name ||
      description ||
      notes ||
      dependencies ||
      implementationGuide ||
      verificationCriteria ||
      relatedFiles
    )
  ) {
    return {
      content: [
        {
          type: "text" as const,
          text: await getUpdateTaskContentPrompt({
            taskId,
            emptyUpdate: true,
          }),
        },
      ],
    };
  }

  // Get the task to check if it exists
  const task = await getTaskById(taskId);

  if (!task) {
    return {
      content: [
        {
          type: "text" as const,
          text: await getUpdateTaskContentPrompt({
            taskId,
          }),
        },
      ],
      isError: true,
    };
  }

//Record tasks and content to be updated
  let updateSummary = `Prepare for update task: ${task.name} (ID: ${task.id})`;
  if (name) updateSummary += `, new name: ${name}`;
  if (description) updateSummary += `, update description`;
  if (notes) updateSummary += `, update notation`;
  if (relatedFiles)
    updateSummary += `, update related files (${relatedFiles.length})`;
  if (dependencies)
    updateSummary += `, update dependencies (${dependencies.length})`;
  if (implementationGuide) updateSummary += `, update the implementation guide`;
if (verificationCriteria) updateSummary += `, update verification standard`;
  // Perform update operations
  const result = await modelUpdateTaskContent(taskId, {
    name,
    description,
    notes,
    relatedFiles,
    dependencies,
    implementationGuide,
    verificationCriteria,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: await getUpdateTaskContentPrompt({
          taskId,
          task,
          success: result.success,
          message: result.message,
          updatedTask: result.task,
        }),
      },
    ],
    isError: !result.success,
  };
}
