import { z } from "zod";
import { getAnalyzeTaskPrompt } from "../../prompts/index.js";

// Problem analysis tool
export const analyzeTaskSchema = z.object({
  summary: z
    .string()
    .min(10, {
      message: "The task summary cannot be less than 10 characters. Please provide a more detailed description to ensure that the task objective is clear.",
    })
    .describe(
      "Structured task summary, including task objectives, scope and key technical challenges, with a minimum of 10 characters"
    ),
  initialConcept: z
    .string()
    .min(50, {
      message:
        "The preliminary answer concept cannot be less than 50 characters. Please provide more detailed content to ensure the technical solution is clear.",
    })
    .describe(
      "A preliminary solution idea of a minimum of 50 characters, including technical solutions, architectural design and implementation strategies. If you need to provide code, please use the pseudocode format and only provide advanced logical processes and critical steps to avoid complete code."
    ),
  previousAnalysis: z
    .string()
    .optional()
    .describe("The analysis results of the previous iteration, used for continuous improvement solutions (released only when reanalyzing)"),
});

export async function analyzeTask({
  summary,
  initialConcept,
  previousAnalysis,
}: z.infer<typeof analyzeTaskSchema>) {
  // Use the propt generator to get the final propt
  const prompt = await getAnalyzeTaskPrompt({
    summary,
    initialConcept,
    previousAnalysis,
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
