import path from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import fs from "fs";

// Obtain the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Global server instance
let globalServer: Server | null = null;

/**
 * Setting up a global server instance
 */
export function setGlobalServer(server: Server): void {
  globalServer = server;
}

/**
 * Get global server instance
 */
export function getGlobalServer(): Server | null {
  return globalServer;
}

/**
 * Get the DATA_DIR path
 * If there is a server and supports listRoots, use root + "/data" starting with the first file://
 * Otherwise, use environment variables or project root directory
 */
export async function getDataDir(): Promise<string> {
  const server = getGlobalServer();
  let rootPath: string | null = null;

  if (server) {
    try {
      const roots = await server.listRoots();

      // Find the first root at the beginning of file://
      if (roots.roots && roots.roots.length > 0) {
        const firstFileRoot = roots.roots.find((root) =>
          root.uri.startsWith("file://")
        );
        if (firstFileRoot) {
          // Extract the actual path from the file://URI
          rootPath = firstFileRoot.uri.replace("file://", "");
        }
      }
    } catch (error) {
      console.error("Failed to get roots:", error);
    }
  }

  // Process process.env.DATA_DIR
  if (process.env.DATA_DIR) {
    if (path.isAbsolute(process.env.DATA_DIR)) {
      // If DATA_DIR is an absolute path, return "DATA_DIR/rootPath last folder name"
      if (rootPath) {
        const lastFolderName = path.basename(rootPath);
        return path.join(process.env.DATA_DIR, lastFolderName);
      } else {
        // If there is no rootPath, return DATA_DIR directly
        return process.env.DATA_DIR;
      }
    } else {
      // If DATA_DIR is a relative path, return "rootPath/DATA_DIR"
      if (rootPath) {
        return path.join(rootPath, process.env.DATA_DIR);
      } else {
        // If rootPath is not available, use PROJECT_ROOT
        return path.join(PROJECT_ROOT, process.env.DATA_DIR);
      }
    }
  }

  // If there is no DATA_DIR, use preset logic
  if (rootPath) {
    return path.join(rootPath, "data");
  }

  // Finally, back to the project root directory
  return path.join(PROJECT_ROOT, "data");
}

/**
 * Obtain the task file path
 */
export async function getTasksFilePath(): Promise<string> {
  const dataDir = await getDataDir();
  return path.join(dataDir, "tasks.json");
}

/**
 * Get the memory folder path
 */
export async function getMemoryDir(): Promise<string> {
  const dataDir = await getDataDir();
  return path.join(dataDir, "memory");
}

/**
 * Get the WebGUI file path
 */
export async function getWebGuiFilePath(): Promise<string> {
  const dataDir = await getDataDir();
  return path.join(dataDir, "WebGUI.md");
}

/**
 * Obtain the project root directory
 */
export function getProjectRoot(): string {
  return PROJECT_ROOT;
}
