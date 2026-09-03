/**
 * Unit tests for TodoService
 */

import { TodoService, TodoTask, TodoPriority } from '../../src/services/todo/TodoService';
import * as fs from 'fs';
import * as path from 'path';

describe('TodoService', () => {
    let todoService: TodoService;
    let testWorkspace: string;

    beforeEach(() => {
        testWorkspace = path.join(__dirname, '..', '..', '.test-workspace');
        // Clean up test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
        fs.mkdirSync(testWorkspace, { recursive: true });

        todoService = new TodoService(testWorkspace);
    });

    afterEach(() => {
        // Cleanup
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });

    describe('createTodoList', () => {
        it('should create a new TODO list for an agent', () => {
            const tasks: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'>[] = [
                {
                    title: 'Test Task 1',
                    description: 'Description 1',
                    assignedAgent: 'TestAgent',
                    status: 'pending',
                    dependencies: [],
                    priority: 'high'
                }
            ];

            const createdTasks = todoService.createTodoList('TestAgent', tasks);

            expect(createdTasks).toHaveLength(1);
            expect(createdTasks[0].title).toBe('Test Task 1');
            expect(createdTasks[0].id).toBeDefined();
            expect(createdTasks[0].createdAt).toBeDefined();
        });

        it('should save TODO list to file', () => {
            const tasks: Omit<TodoTask, 'id' | 'createdAt' | 'updatedAt'>[] = [
                {
                    title: 'Task 1',
                    description: '  Test',
                    assignedAgent: 'Agent1',
                    status: 'pending',
                    dependencies: [],
                    priority: 'medium'
                }
            ];

            todoService.createTodoList('Agent1', tasks);

            const todoPath = path.join(testWorkspace, '.verno', 'todos', 'Agent1');
            expect(fs.existsSync(todoPath)).toBe(true);

            const files = fs.readdirSync(todoPath);
            expect(files.length).toBeGreaterThan(0);
        });
    });

    describe('updateTaskStatus', () => {
        it('should update task status correctly', () => {
            const tasks = todoService.createTodoList('TestAgent', [
                {
                    title: 'Task 1',
                    description: 'Test',
                    assignedAgent: 'TestAgent',
                    status: 'pending',
                    dependencies: [],
                    priority: 'high'
                }
            ]);

            const taskId = tasks[0].id;
            todoService.updateTaskStatus('TestAgent', taskId, 'completed');

            const list = todoService.getTodoList('TestAgent');
            const updatedTask = list.tasks.find(t => t.id === taskId);

            expect(updatedTask?.status).toBe('completed');
            expect(updatedTask?.updatedAt).toBeGreaterThan(updatedTask?.createdAt || 0);
        });
    });

    describe('getTodoSummary', () => {
        it('should return summary of all TODOs', () => {
            todoService.createTodoList('Agent1', [
                {
                    title: 'Task 1',
                    description: 'Test',
                    assignedAgent: 'Agent1',
                    status: 'pending',
                    dependencies: [],
                    priority: 'high'
                },
                {
                    title: 'Task 2',
                    description: 'Test',
                    assignedAgent: 'Agent1',
                    status: 'completed',
                    dependencies: [],
                    priority: 'low'
                }
            ]);

            const summary = todoService.getTodoSummary();

            expect(summary).toContain('Agent1');
            expect(summary).toContain('Task 1');
            expect(summary).toContain('pending');
            expect(summary).toContain('completed');
        });
    });
});
