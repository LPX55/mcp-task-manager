import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import { getResearchModePrompt } from "../../prompts/index.js";
import { getMemoryDir } from "../../utils/paths.js";

// Research Model Tools
export const researchModeSchema = z.object({
  topic: z
    .string()
    .min(5, {
      message: "The research topic cannot be less than 5 characters. Please provide a clear research topic.",
    })
    .describe("The programming topics to be studied should be clear and specific"),
  previousState: z
    .string()
    .optional()
    .default("")
    .describe(
      "The previous research status and content summary is empty when executed for the first time. The subsequent detailed and critical research results will be included, which will help subsequent research."
    ),
  currentState: z
    .string()
    .describe(
      "The current Agent mainly executes content, such as using network tools to search for certain keywords or analyze specific codes. After the research is completed, please call research_mode to record the status and integrate it with the previous `previousState`. This will help you better save and execute research content."
    ),
  nextSteps: z
    .string()
    .describe(
      "Subsequent plans, steps or research directions are used to restrict Agent from deviating from the topic or going in the wrong direction. If you find that you need to adjust the research direction during the research process, please update this column."
    ),
});

export async function researchMode({
  topic,
  previousState = "",
  currentState,
  nextSteps,
}: z.infer<typeof researchModeSchema>) {
  // Get the basic directory path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const PROJECT_ROOT = path.resolve(__dirname, "../../..");
  const MEMORY_DIR = await getMemoryDir();

  // Use the propt generator to get the final propt
  const prompt = await getResearchModePrompt({
    topic,
    previousState,
    currentState,
    nextSteps,
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
