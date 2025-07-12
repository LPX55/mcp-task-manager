import express, { Request, Response } from "express";
import getPort from "get-port";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import { fileURLToPath } from "url";
import {
  getDataDir,
  getTasksFilePath,
  getWebGuiFilePath,
} from "../utils/paths.js";

export async function createWebServer() {
  // Create Express app
  const app = express();

  // Store list of SSE clients
  let sseClients: Response[] = [];

  // Helper function for sending SSE events
  function sendSseUpdate() {
    sseClients.forEach((client) => {
      // Check if the client is still connected
      if (!client.writableEnded) {
        client.write(
          `event: update\ndata: ${JSON.stringify({
            timestamp: Date.now(),
          })}\n\n`
        );
      }
    });
    // Clean up disconnected clients (optional, but recommended)
    sseClients = sseClients.filter((client) => !client.writableEnded);
  }

  // Setting up static file directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const publicPath = path.join(__dirname, "..", "..", "src", "public");
  const TASKS_FILE_PATH = await getTasksFilePath(); // Use tool functions to get the archive path

  app.use(express.static(publicPath));

  // Set up API routing
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      // Keep asynchronous read using fsPromises
      const tasksData = await fsPromises.readFile(TASKS_FILE_PATH, "utf-8");
      res.json(JSON.parse(tasksData));
    } catch (error) {
      // Make sure that the file does not exist returns to an empty task list
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        res.json({ tasks: [] });
      } else {
        res.status(500).json({ error: "Failed to read tasks data" });
      }
    }
  });

  // New: SSE endpoint
  app.get("/api/tasks/stream", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Optional: CORS header, if the front-end and back-end are not on the same origin
      // "Access-Control-Allow-Origin": "*",
    });

    // Send an initial event or keep the connection
    res.write("data: connected\n\n");

    // Add client to list
    sseClients.push(res);

    // When the client is disconnected, remove it from the list
    req.on("close", () => {
      sseClients = sseClients.filter((client) => client !== res);
    });
  });

  // Define writeWebGuiFile function
  async function writeWebGuiFile(port: number | string) {
    try {
      // Read TEMPLATES_USE environment variables and convert them to language code
      const templatesUse = process.env.TEMPLATES_USE || "en";
      const getLanguageFromTemplate = (template: string): string => {
        if (template === "zh") return "zh-TW";
        if (template === "en") return "en";
        // Customized template presets are in English
        return "en";
      };
      const language = getLanguageFromTemplate(templatesUse);

      const websiteUrl = `[Task Manager UI](http://localhost:${port}?lang=${language})`;
      const websiteFilePath = await getWebGuiFilePath();
      const DATA_DIR = await getDataDir();
      try {
        await fsPromises.access(DATA_DIR);
      } catch (error) {
        await fsPromises.mkdir(DATA_DIR, { recursive: true });
      }
      await fsPromises.writeFile(websiteFilePath, websiteUrl, "utf-8");
    } catch (error) {}
  }

  return {
    app,
    sendSseUpdate,
    async startServer() {
      // Get available ports
      const port = process.env.WEB_PORT || (await getPort());

      // Start the HTTP server
      const httpServer = app.listen(port, () => {
        // Start monitoring file changes after the server is started
        try {
          // Check whether the file exists, and if it does not exist, do not listen (avoid watch errors)
          if (fs.existsSync(TASKS_FILE_PATH)) {
            fs.watch(TASKS_FILE_PATH, (eventType, filename) => {
              if (
                filename &&
                (eventType === "change" || eventType === "rename")
              ) {
                // Slightly delay sending to prevent multiple triggers in a short time (such as editor saves)
                // debounce sendSseUpdate if needed
                sendSseUpdate();
              }
            });
          }
        } catch (watchError) {}

        // Write URL to WebGUI.md
        writeWebGuiFile(port).catch((error) => {});
      });

      // Set process termination event handling (make sure to remove watcher)
      const shutdownHandler = async () => {
        // Close all SSE connections
        sseClients.forEach((client) => client.end());
        sseClients = [];

        // Turn off the HTTP server
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      };

      process.on("SIGINT", shutdownHandler);
      process.on("SIGTERM", shutdownHandler);

      return httpServer;
    },
  };
}
