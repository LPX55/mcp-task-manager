/**
 * prompt loader
 * Provides the function of loading custom prompts from environment variables
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDataDir } from "../utils/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function processEnvString(input: string | undefined): string {
  if (!input) return "";

  return input
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

/**
 * Load prompt to support customization of environment variables
 * @param basePrompt Basic prompt content
 * @param promptKey The key name of prompt is used to generate environment variable names
 * @returns The final prompt content
 */
export function loadPrompt(basePrompt: string, promptKey: string): string {
  // Convert to capitalization as part of environment variables
  const envKey = promptKey.toUpperCase();

  // Check if there are environment variables in replacement mode
  const overrideEnvVar = `MCP_PROMPT_${envKey}`;
  if (process.env[overrideEnvVar]) {
    // Completely replace the original prompt with environment variables
    return processEnvString(process.env[overrideEnvVar]);
  }

  // Check whether there are additional mode environment variables
  const appendEnvVar = `MCP_PROMPT_${envKey}_APPEND`;
  if (process.env[appendEnvVar]) {
    // After appending the environment variable content to the original prompt
    return `${basePrompt}\n\n${processEnvString(process.env[appendEnvVar])}`;
  }

  // If there is no customization, use the original prompt
  return basePrompt;
}

/**
 * Generate prompt with dynamic parameters
 * @param promptTemplate prompt template
 * @param params Dynamic parameters
 * @returns prompt after filling parameters
 */
export function generatePrompt(
  promptTemplate: string,
  params: Record<string, any> = {}
): string {
  // Use a simple template replacement method, replace {paramName} with the corresponding parameter value
  let result = promptTemplate;

  Object.entries(params).forEach(([key, value]) => {
    // If the value is undefined or null, replace it with an empty string
    const replacementValue =
      value !== undefined && value !== null ? String(value) : "";

    // Replace all matching placeholders with regular expressions
    const placeholder = new RegExp(`\\{${key}\\}`, "g");
    result = result.replace(placeholder, replacementValue);
  });

  return result;
}

/**
 * Load prompt from template
 * @param templatePath The template path relative to the template set root directory (e.g., 'chat/basic.md')
 * @returns Template content
 * @throws Error If the template file cannot be found
 */
export async function loadPromptFromTemplate(
  templatePath: string
): Promise<string> {
  const templateSetName = process.env.TEMPLATES_USE || "en";
  const dataDir = await getDataDir();
  const builtInTemplatesBaseDir = __dirname;

  let finalPath = "";
  const checkedPaths: string[] = []; // For more detailed error reports

  // 1. Check the custom path in DATA_DIR
  // path.resolve can handle the situation where templateSetName is an absolute path
  const customFilePath = path.resolve(dataDir, templateSetName, templatePath);
  checkedPaths.push(`Custom: ${customFilePath}`);
  if (fs.existsSync(customFilePath)) {
    finalPath = customFilePath;
  }

  // 2. If the custom path is not found, check the specific built-in template directory
  if (!finalPath) {
    // Assume that templateSetName is 'en', 'zh', etc. for the built-in template
    const specificBuiltInFilePath = path.join(
      builtInTemplatesBaseDir,
      `templates_${templateSetName}`,
      templatePath
    );
    checkedPaths.push(`Specific Built-in: ${specificBuiltInFilePath}`);
    if (fs.existsSync(specificBuiltInFilePath)) {
      finalPath = specificBuiltInFilePath;
    }
  }

  // 3. If the specific built-in template is not found, and is not 'en' (avoid repeated checks)
  if (!finalPath && templateSetName !== "en") {
    const defaultBuiltInFilePath = path.join(
      builtInTemplatesBaseDir,
      "templates_en",
      templatePath
    );
    checkedPaths.push(`Default Built-in ('en'): ${defaultBuiltInFilePath}`);
    if (fs.existsSync(defaultBuiltInFilePath)) {
      finalPath = defaultBuiltInFilePath;
    }
  }

  // 4. If all paths cannot find the template, an error is thrown
  if (!finalPath) {
    throw new Error(
      `Template file not found: '${templatePath}' in template set '${templateSetName}'. Checked paths:\n - ${checkedPaths.join(
        "\n - "
      )}`
    );
  }

  // 5. Read the found file
  return fs.readFileSync(finalPath, "utf-8");
}
