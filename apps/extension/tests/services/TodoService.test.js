"use strict";
/**
 * Unit tests for TodoService
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const TodoService_1 = require("../../src/services/todo/TodoService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
describe('TodoService', () => {
    let todoService;
    let testWorkspace;
    beforeEach(() => {
        testWorkspace = path.join(__dirname, '..', '..', '.test-workspace');
        // Clean up test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
        fs.mkdirSync(testWorkspace, { recursive: true });
        todoService = new TodoService_1.TodoService(testWorkspace);
    });
    afterEach(() => {
        // Cleanup
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });
    describe('createTodoList', () => {
        it('should create a new TODO list for an agent', () => {
            const tasks = [
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
            const tasks = [
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
//# sourceMappingURL=TodoService.test.js.map