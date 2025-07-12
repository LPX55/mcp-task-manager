/**
 * researchMode prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import {
  loadPrompt,
  generatePrompt,
  loadPromptFromTemplate,
} from "../loader.js";

/**
 * researchMode prompt parameter interface
 */
export interface ResearchModePromptParams {
  topic: string;
  previousState: string;
  currentState: string;
  nextSteps: string;
  memoryDir: string;
}

/**
 * Get the full prompt of researchMode
 * @param params prompt parameter
 * @returns Generated prompt
 */
export async function getResearchModePrompt(
  params: ResearchModePromptParams
): Promise<string> {
  // Research status before processing
  let previousStateContent = "";
  if (params.previousState && params.previousState.trim() !== "") {
    const previousStateTemplate = await loadPromptFromTemplate(
      "researchMode/previousState.md"
    );
    previousStateContent = generatePrompt(previousStateTemplate, {
      previousState: params.previousState,
    });
  } else {
    previousStateContent = "這是第一次進行此主題的研究，沒有之前的研究狀態。";
  }

  // Load the main template
  const indexTemplate = await loadPromptFromTemplate("researchMode/index.md");
  let prompt = generatePrompt(indexTemplate, {
    topic: params.topic,
    previousStateContent: previousStateContent,
    currentState: params.currentState,
    nextSteps: params.nextSteps,
    memoryDir: params.memoryDir,
    time: new Date().toLocaleString(),
  });

  // Load possible custom prompts
  return loadPrompt(prompt, "RESEARCH_MODE");
}
