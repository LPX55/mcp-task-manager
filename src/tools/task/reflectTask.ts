import { z } from "zod";
import { getReflectTaskPrompt } from "../../prompts/index.js";

//Reflection and conception tool
export const reflectTaskSchema = z.object({
  summary: z
    .string()
    .min(10, {
      message: "The task summary cannot be less than 10 characters. Please provide a more detailed description to ensure that the task objective is clear",
    })
    .describe("Structured task summary, keeping consistent with the analysis phase to ensure continuity"),
  analysis: z
    .string()
    .min(100, {
      message: "The technical analysis content is not detailed enough, please provide a complete technical analysis and implementation plan",
    })
    .describe(
      "Complete and detailed technical analysis results, including all technical details, dependencies and implementations, use the pseudocode format if required to provide code and only provide advanced logical processes and critical steps to avoid complete code"
    ),
});
export async function reflectTask({
  summary,
  analysis,
}: z.infer<typeof reflectTaskSchema>) {
  // Use the propt generator to get the final propt
  const prompt = await getReflectTaskPrompt({
    summary,
    analysis,
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
