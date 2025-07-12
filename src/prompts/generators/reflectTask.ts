/**
 * reflectTask prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";

/**
 * reflectTask prompt parameter interface
 */
export interface ReflectTaskPromptParams {
  summary: string;
  analysis: string;
}

/**
 * Get the full prompt of reflectTask
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getReflectTaskPrompt(
  params: ReflectTaskPromptParams
): Promise<string> {
  const indexTemplate = await loadPromptFromTemplate("reflectTask/index.md");
  const prompt = generatePrompt(indexTemplate, {
    summary: params.summary,
    analysis: params.analysis,
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "REFLECT_TASK");
}
