// Task status enumeration: defines the current stage of a task in the workflow
export enum TaskStatus {
  PENDING = "pending", // A task that has been created but has not started yet
  IN_PROGRESS = "in_progress", // The task currently being executed
  COMPLETED = "completed", // A task that has been successfully completed and verified
  BLOCKED = "blocked", // Tasks that cannot be executed temporarily due to dependencies
}

// Task dependency: defines the precondition relationship between tasks
export interface TaskDependency {
  taskId: string; // A unique identifier for the predecessor task. This dependent task must be completed before the current task is executed.
}

// Related file types: Define the relationship type between file and task
export enum RelatedFileType {
  TO_MODIFY = "TO_MODIFY", // Files that need to be modified in the task
  REFERENCE = "REFERENCE", // References or related documents for tasks
  CREATE = "CREATE", // Files that need to be created in the task
  DEPENDENCY = "DEPENDENCY", // Task-dependent components or library files
  OTHER = "OTHER", // Other types of related files
}

// Related files: Define task-related file information
export interface RelatedFile {
  path: string; // The file path can be a path relative to the project root directory or an absolute path
  type: RelatedFileType; // File and task relationship type
  description?: string; // Supplementary description of the document, explaining its specific relationship or purpose with the task
  lineStart?: number; // The starting line of the relevant code block (optional)
  lineEnd?: number; // End line of relevant code blocks (optional)
}

// Task interface: Define the complete data structure of a task
export interface Task {
  id: string; // Unique identifier for a task
  name: string; // Concise and clear task name
  description: string; // Detailed task description, including implementation points and acceptance standards
  notes?: string; // Supplementary instructions, special handling requirements or implementation suggestions (optional)
  status: TaskStatus; // The current execution status of the task
  dependencies: TaskDependency[]; // List of predependencies for tasks
  createdAt: Date; // Timestamp created by task
  updatedAt: Date; // The last updated time stamp of the task
  completedAt?: Date; // Timestamp for task completion (only for completed tasks)
  summary?: string; // Task completion summary, concise description of implementation results and important decisions (only applicable to completed tasks)
  relatedFiles?: RelatedFile[]; // List of files related to tasks (optional)

  // Added column: Save the complete technical analysis results
  analysisResult?: string; // Complete analysis results from the analyze_task and reflect_task stages

  // Added columns: Save specific implementation guide
  implementationGuide?: string; // Specific implementation methods, steps and suggestions

  // Added columns: Save verification standards and inspection methods
  verificationCriteria?: string; // Clear verification standards, testing points and acceptance conditions
}

// Task complexity level: defines the complexity classification of tasks
export enum TaskComplexityLevel {
  LOW = "Low complexity", // Simple and direct tasks that usually do not require special processing
  MEDIUM = "Medium complexity", // Tasks that are complex but still manageable
  HIGH = "High complexity", // Complex and time-consuming tasks that require special attention
  VERY_HIGH = "Extremely complex", // Extremely complex tasks, it is recommended to split and handle
}

// Task complexity threshold: a reference criterion for defining task complexity evaluation
export const TaskComplexityThresholds = {
  DESCRIPTION_LENGTH: {
    MEDIUM: 500, // Exceeding this number of words is considered to be of medium complexity
    HIGH: 1000, // Exceeding this number of words is determined to be of high complexity
    VERY_HIGH: 2000, // Exceeding this number of words is considered to be extremely complex
  },
  DEPENDENCIES_COUNT: {
    MEDIUM: 2, // Exceeding this dependency number is determined to be of medium complexity
    HIGH: 5, // Exceeding this dependency number is determined to be high complexity
    VERY_HIGH: 10, // Exceeding this dependency number is determined to be extremely complex
  },
  NOTES_LENGTH: {
    MEDIUM: 200, // Exceeding this number of words is considered to be of medium complexity
    HIGH: 500, // Exceeding this number of words is determined to be of high complexity
    VERY_HIGH: 1000, // Exceeding this number of words is considered to be extremely complex
  },
};

// Task complexity evaluation results: Record detailed results of task complexity analysis
export interface TaskComplexityAssessment {
  level: TaskComplexityLevel; // Overall complexity level
  metrics: {
    // Detailed data on various evaluation indicators
    descriptionLength: number; // Description length
    dependenciesCount: number; // Number of dependencies
    notesLength: number; // Note length
    hasNotes: boolean; // Is there any notes
  };
  recommendations: string[]; // Processing suggestions list
}
