import { z } from "zod";
import {
  getProcessThoughtPrompt,
  ProcessThoughtPromptParams,
} from "../../prompts/generators/processThought.js";

/**
 * Parameter structure of processThought tool
 */
export const processThoughtSchema = z.object({
  thought: z
    .string()
    .min(1, {
      message: "The thinking content cannot be empty, please provide effective thinking content",
    })
    .describe("Thinking content"),
  thought_number: z
    .number()
    .int()
    .positive({
      message: "The thinking number must be a positive integer",
    })
    .describe("Current thinking number"),
  total_thoughts: z
    .number()
    .int()
    .positive({
      message: "The total number of thinking must be a positive integer",
    })
    .describe("The total number of thinking is expected, and if more thinking is needed, it can be changed at any time."),
  next_thought_needed: z.boolean().describe("Do you need next thinking"),
  stage: z
    .string()
    .min(1, {
      message: "The thinking stage cannot be empty, please provide an effective thinking stage",
    })
    .describe(
      "Thinking stage. Available stages include: Problem Definition, Information Gathering, Research, Analysis, Synthesis, Conclusion, Critical Questioning, and Planning."
    ),
  tags: z.array(z.string()).optional().describe("Thinking tag is an array string"),
  axioms_used: z
    .array(z.string())
    .optional()
    .describe("The axiom used is an array string"),
  assumptions_challenged: z
    .array(z.string())
    .optional()
    .describe("The challenged assumption is an array string"),
});

/**
 * Process single thinking and return formatted output
 */
export async function processThought(
  params: z.infer<typeof processThoughtSchema>
) {
  try {
    // Convert parameters to a standard thought data format
    const thoughtData: ProcessThoughtPromptParams = {
      thought: params.thought,
      thoughtNumber: params.thought_number,
      totalThoughts: params.total_thoughts,
      nextThoughtNeeded: params.next_thought_needed,
      stage: params.stage,
      tags: params.tags || [],
      axioms_used: params.axioms_used || [],
      assumptions_challenged: params.assumptions_challenged || [],
    };

    // Ensure that the thinking number does not exceed the total thinking number
    if (thoughtData.thoughtNumber > thoughtData.totalThoughts) {
      // Automatically adjust the total number of thinking
      thoughtData.totalThoughts = thoughtData.thoughtNumber;
    }

    // Format thinking output
    const formattedThought = await getProcessThoughtPrompt(thoughtData);

    // Return a successful response
    return {
      content: [
        {
          type: "text" as const,
          text: formattedThought,
        },
      ],
    };
  } catch (error) {
    // Catch and handle all unanticipated errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text" as const,
          text: `An error occurred while dealing with thinking: ${errorMessage}`,
        },
      ],
    };
  }
}
