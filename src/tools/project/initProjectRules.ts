import { z } from "zod";
import { getInitProjectRulesPrompt } from "../../prompts/index.js";

// Definitions schema
export const initProjectRulesSchema = z.object({});

/**
 * Initialize project specification tool functions
 * Provide guidance on establishing specification documents
 */
export async function initProjectRules() {
  try {
    // Get prompt words from generator
    const promptContent = await getInitProjectRulesPrompt();

    // Return a successful response
    return {
      content: [
        {
          type: "text" as const,
          text: promptContent,
        },
      ],
    };
  } catch (error) {
    // Error handling
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text" as const,
          text: `An error occurred while initializing the project specification: ${errorMessage}`,
        },
      ],
    };
  }
}
