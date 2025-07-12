/**
 * initProjectRules prompt generator
 * Responsible for combining templates and parameters into the final prompt
 */

import { loadPrompt, loadPromptFromTemplate } from "../loader.js";
/**
 * initProjectRules prompt parameter interface
 */
export interface InitProjectRulesPromptParams {
  // There are currently no additional parameters, and can be expanded on demand in the future
}

/**
 * Get the full prompt of initProjectRules
 * @param params prompt parameter (optional)
 * @returns Generated prompt
 */
export async function getInitProjectRulesPrompt(
  params?: InitProjectRulesPromptParams
): Promise<string> {
  const indexTemplate = await loadPromptFromTemplate(
    "initProjectRules/index.md"
  );

  // Load possible custom prompt (overwrite or append via environment variables)
  return loadPrompt(indexTemplate, "INIT_PROJECT_RULES");
}
