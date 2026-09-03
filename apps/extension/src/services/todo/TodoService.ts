/**
 * TODO Service: Manages agent TODO lists and task tracking
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * TODO task status
 */
export type TodoStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';

/**
 * TODO task priority  
 */
export type TodoPriority = 'low' | 'medium' | 'high';

/**
 * TODO task interface
 */
export interface TodoTask {
    id: string;
    title: string;
    description: string;
    assignedAgent: string;
    status: TodoStatus;
    dependencies: string[];
    priority: TodoPriority;
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
}

/**
 * TODO list interface
 */
export interface TodoList {
    agentName: string;
    tasks: TodoTask[];
    createdAt: number;
    updatedAt: number;
}

/**
 * Service for managing agent TODO lists
 */
export class TodoService {
    private workspaceRoot: string;
    private todosDir: string;
    private todoLists: Map<string, TodoList> = new Map();

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.todosDir = path.join(workspaceRoot, '.verno', 'todos');
        this.ensureDirectoryExists();
        this.loadAllTodoLists();
    }

    /**
     * Create a TODO list for an agent
     */
    createTodoList(agentName: string, tasks: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'>[]): TodoList {
        const todoList: TodoList = {
            agentName,
            tasks: tasks.map((task, index) => ({
                ...task,
                id: `task-${agentName}-${Date.now()}-${index}`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            })),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.todoLists.set(agentName, todoList);
        this.saveTodoList(todoList);
        return todoList;
    }

    /**
     * Add a task to an agent's TODO list
     */
    addTask(
        agentName: string,
        task: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'>
    ): TodoTask {
        let todoList = this.todoLists.get(agentName);

        if (!todoList) {
            todoList = {
                agentName,
                tasks: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            this.todoLists.set(agentName, todoList);
        }

        const newTask: TodoTask = {
            ...task,
            id: `task-${agentName}-${Date.now()}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        todoList.tasks.push(newTask);
        todoList.updatedAt = Date.now();
        this.saveTodoList(todoList);

        return newTask;
    }

    /**
     * Update a task's status
     */
    updateTaskStatus(agentName: string, taskId: string, status: TodoStatus): void {
        const todoList = this.todoLists.get(agentName);
        if (!todoList) {
            throw new Error(`TODO list for agent ${agentName} not found`);
        }

        const task = todoList.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.status = status;
        task.updatedAt = Date.now();

        if (status === 'completed') {
            task.completedAt = Date.now();
        }

        todoList.updatedAt = Date.now();
        this.saveTodoList(todoList);
    }

    /**
     * Get TODO list for an agent
     */
    getTodoList(agentName: string): TodoList | null {
        return this.todoLists.get(agentName) || null;
    }

    /**
     * Get all TODO lists
     */
    getAllTodoLists(): TodoList[] {
        return Array.from(this.todoLists.values());
    }

    /**
     * Get pending tasks for an agent
     */
    getPendingTasks(agentName: string): TodoTask[] {
        const todoList = this.todoLists.get(agentName);
        if (!todoList) {
            return [];
        }
        return todoList.tasks.filter(t => t.status === 'pending' || t.status === 'in-progress');
    }

    /**
     * Get completed tasks for an agent
     */
    getCompletedTasks(agentName: string): TodoTask[] {
        const todoList = this.todoLists.get(agentName);
        if (!todoList) {
            return [];
        }
        return todoList.tasks.filter(t => t.status === 'completed');
    }

    /**
     * Clear all tasks for an agent
     */
    clearTodoList(agentName: string): void {
        const todoList = this.todoLists.get(agentName);
        if (todoList) {
            todoList.tasks = [];
            todoList.updatedAt = Date.now();
            this.saveTodoList(todoList);
        }
    }

    /**
     * Delete a TODO list
     */
    deleteTodoList(agentName: string): void {
        const filePath = this.getTodoListFilePath(agentName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        this.todoLists.delete(agentName);
    }

    /**
     * Generate TODO summary
     */
    getTodoSummary(): string {
        let summary = '# TODO Summary\n\n';

        for (const todoList of this.todoLists.values()) {
            const pending = todoList.tasks.filter(t => t.status === 'pending' || t.status === 'in-progress').length;
            const completed = todoList.tasks.filter(t => t.status === 'completed').length;
            const total = todoList.tasks.length;

            summary += `## ${todoList.agentName}\n`;
            summary += `- Total Tasks: ${total}\n`;
            summary += `- Pending: ${pending}\n`;
            summary += `- Completed: ${completed}\n`;
            summary += `- Progress: ${total > 0 ? Math.round((completed / total) * 100) : 0}%\n\n`;
        }

        return summary;
    }

    /**
     * Save a TODO list to disk
     */
    private saveTodoList(todoList: TodoList): void {
        try {
            const filePath = this.getTodoListFilePath(todoList.agentName);
            fs.writeFileSync(filePath, JSON.stringify(todoList, null, 2), 'utf-8');
        } catch (err) {
            console.error(`Failed to save TODO list for ${todoList.agentName}:`, err);
        }
    }

    /**
     * Load all TODO lists from disk
     */
    private loadAllTodoLists(): void {
        try {
            if (!fs.existsSync(this.todosDir)) {
                return;
            }

            const files = fs.readdirSync(this.todosDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.todosDir, file);
                    const data = fs.readFileSync(filePath, 'utf-8');
                    const todoList = JSON.parse(data) as TodoList;
                    this.todoLists.set(todoList.agentName, todoList);
                }
            }
        } catch (err) {
            console.error('Failed to load TODO lists:', err);
        }
    }

    /**
     * Ensure todos directory exists
     */
    private ensureDirectoryExists(): void {
        if (!fs.existsSync(this.todosDir)) {
            fs.mkdirSync(this.todosDir, { recursive: true });
        }
    }

    /**
     * Get file path for a TODO list
     */
    private getTodoListFilePath(agentName: string): string {
        return path.join(this.todosDir, `${agentName}.json`);
    }
}
