import { RelatedFile, RelatedFileType } from "../types/index.js";

/**
 * Generate a summary of the content of the task-related files
 *
 * This function generates summary information of the file based on the provided RelatedFile object list, without actually reading the archive content.
 * This is a lightweight implementation that generates a formatted summary based only on archival metadata (such as paths, types, descriptions, etc.),
 * Suitable for situations where file context information is required but no access to actual archive content is required.
 *
 * @param relatedFiles Related File List -RelatedFile Object Array, including file path, type, description and other information
 * @param maxTotalLength Maximum total length of summary content -Controls the total number of characters to generate summary to avoid excessive return content
 * @returns An object containing two fields:
 *   -content: Detailed document information, including basic information and prompt information for each file
 *   -summary: A simple overview of archive lists, suitable for quick browsing
 */
export async function loadTaskRelatedFiles(
  relatedFiles: RelatedFile[],
  maxTotalLength: number = 15000 // Controls the total length of generated content
): Promise<{ content: string; summary: string }> {
  if (!relatedFiles || relatedFiles.length === 0) {
    return {
      content: "",
      summary: "No related files",
    };
  }

  let totalContent = "";
  let filesSummary = `## Related file content summary (total ${relatedFiles.length} files)\n\n`;  let totalLength = 0;

  // Sort by file type priority (first process files to be modified)
  const priorityOrder: Record<RelatedFileType, number> = {
    [RelatedFileType.TO_MODIFY]: 1,
    [RelatedFileType.REFERENCE]: 2,
    [RelatedFileType.DEPENDENCY]: 3,
    [RelatedFileType.CREATE]: 4,
    [RelatedFileType.OTHER]: 5,
  };

  const sortedFiles = [...relatedFiles].sort(
    (a, b) => priorityOrder[a.type] - priorityOrder[b.type]
  );

  // Process each file
  for (const file of sortedFiles) {
    if (totalLength >= maxTotalLength) {
  filesSummary += `\n### The context length limit has been reached, some files are not loaded\n`;      break;
    }

    // Generate basic information on files
    const fileInfo = generateFileInfo(file);

    // Add to total content
    const fileHeader = `\n### ${file.type}: ${file.path}${
      file.description ? ` - ${file.description}` : ""
    }${
      file.lineStart && file.lineEnd
        ? ` (行 ${file.lineStart}-${file.lineEnd})`
        : ""
    }\n\n`;

    totalContent += fileHeader + "```\n" + fileInfo + "\n```\n\n";
    filesSummary += `- **${file.path}**${
      file.description ? ` - ${file.description}` : ""
    } (${fileInfo.length} character)\n`;

    totalLength += fileInfo.length + fileHeader.length + 8; // 8 for "```\n" and "\n```"
  }

  return {
    content: totalContent,
    summary: filesSummary,
  };
}

/**
 * Generate a file basic information summary
 *
 * Generate a formatted information summary based on the archive's metadata, including the archive path, type and related prompts.
 * The actual file content is not read, and information is generated only based on the provided RelatedFile object.
 *
 * @param file Related file objects -including basic information such as archive path, type, description, etc.
 * @returns Formatted Archive Information Summary Text
 */function generateFileInfo(file: RelatedFile): string {
  let fileInfo = `file: ${file.path}\n`;
  fileInfo += `Type: ${file.type}\n`;

  if (file.description) {
    fileInfo += `Description: ${file.description}\n`;
  }

  if (file.lineStart && file.lineEnd) {
    fileInfo += `Line Range: ${file.lineStart}-${file.lineEnd}\n`;
  }

  fileInfo += `If you need to view the actual content, please directly view the file: ${file.path}\n`;
  return fileInfo;
}
