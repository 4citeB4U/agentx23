/**
 * Agent Lee — Parallel Task Orchestrator
 * Layer 11: ParallelNavigator | LEEWAY-CORE-2026
 * Backed by InsForge DB for state persistence
 */

import { createClient } from '@insforge/sdk';
import { EventEmitter } from 'events';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

// ── Task Types ────────────────────────────────────────────────────────────
export type TaskType = 'research' | 'build' | 'phone' | 'email' | 'analysis' | 'learning';
export type TaskStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed';

export interface AgentTask {
  id:                       string;
  type:                     TaskType;
  priority:                 1 | 2 | 3 | 4 | 5;
  dependencies:             string[];
  status:                   TaskStatus;
  linked_memory_ids:        string[];
  linked_notebook_entries:  string[];
  voice_summary:            string;
  research_doc_id:          string | null;
  reward_score:             number | null;
  context_capsule:          Record<string, unknown>;
  handler:                  (task: AgentTask) => Promise<void>;
  created_at:               string;
  started_at:               string | null;
  completed_at:             string | null;
}

// ── Queue Config ──────────────────────────────────────────────────────────
const QUEUE_CONCURRENCY: Record<TaskType, number> = {
  research:  5,
  build:     3,
  phone:     2,
  email:     4,
  analysis:  5,
  learning:  2,
};

// ── Parallel Task Orchestrator ────────────────────────────────────────────
export class ParallelTaskOrchestrator extends EventEmitter {
  private queues: Record<TaskType, AgentTask[]> = {
    research: [], build: [], phone: [], email: [], analysis: [], learning: [],
  };
  private running: Record<TaskType, number> = {
    research: 0, build: 0, phone: 0, email: 0, analysis: 0, learning: 0,
  };
  private allTasks = new Map<string, AgentTask>();

  constructor() {
    super();
    // Tick every 500ms to pick up queued tasks
    setInterval(() => this.tick(), 500);
  }

  // ── Enqueue a task ──────────────────────────────────────────────────────
  async enqueue(task: Omit<AgentTask, 'status' | 'created_at' | 'started_at' | 'completed_at'>): Promise<AgentTask> {
    const full: AgentTask = {
      ...task,
      status:       'queued',
      created_at:   new Date().toISOString(),
      started_at:   null,
      completed_at: null,
    };

    this.queues[task.type].push(full);
    this.allTasks.set(full.id, full);

    // Sort by priority desc
    this.queues[task.type].sort((a, b) => b.priority - a.priority);

    // Persist to InsForge
    await insforge.database.from('task_queue').insert([{
      id:           full.id,
      type:         full.type,
      priority:     full.priority,
      dependencies: full.dependencies,
      status:       full.status,
      voice_summary: full.voice_summary,
      research_doc_id: full.research_doc_id,
      context_capsule: full.context_capsule,
      created_at:   full.created_at,
    }]).select();

    this.emit('task:queued', full);
    console.log(`  [ParallelNavigator] Queued task ${full.id} (${full.type}, priority ${full.priority})`);
    return full;
  }

  // ── Tick — pick up ready tasks ──────────────────────────────────────────
  private tick(): void {
    for (const type of Object.keys(this.queues) as TaskType[]) {
      while (
        this.running[type] < QUEUE_CONCURRENCY[type] &&
        this.queues[type].length > 0
      ) {
        const task = this.queues[type].find(t => this.dependenciesMet(t));
        if (!task) break;

        // Remove from queue
        this.queues[type] = this.queues[type].filter(t => t.id !== task.id);
        this.runTask(task);
      }
    }
  }

  // ── Check dependency satisfaction ───────────────────────────────────────
  private dependenciesMet(task: AgentTask): boolean {
    return task.dependencies.every(depId => {
      const dep = this.allTasks.get(depId);
      return dep?.status === 'completed';
    });
  }

  // ── Execute a task ──────────────────────────────────────────────────────
  private async runTask(task: AgentTask): Promise<void> {
    this.running[task.type]++;
    task.status = 'running';
    task.started_at = new Date().toISOString();
    this.emit('task:started', task);

    await insforge.database.from('task_queue')
      .update({ status: 'running', started_at: task.started_at })
      .eq('id', task.id);

    try {
      await task.handler(task);
      task.status = 'completed';
      task.completed_at = new Date().toISOString();
      this.emit('task:completed', task);
    } catch (err) {
      task.status = 'failed';
      task.completed_at = new Date().toISOString();
      this.emit('task:failed', { task, error: err });
      console.error(`  [ParallelNavigator] Task ${task.id} failed:`, err);
    } finally {
      this.running[task.type]--;
      await insforge.database.from('task_queue')
        .update({ status: task.status, completed_at: task.completed_at })
        .eq('id', task.id);
    }
  }

  // ── Status snapshot ─────────────────────────────────────────────────────
  getStatus(): Record<string, unknown> {
    const queueSizes: Record<string, number> = {};
    for (const [type, queue] of Object.entries(this.queues)) {
      queueSizes[type] = queue.length;
    }
    return {
      queued: queueSizes,
      running: { ...this.running },
      total_tracked: this.allTasks.size,
    };
  }

  // ── Cancel a task ────────────────────────────────────────────────────────
  cancel(taskId: string): boolean {
    const task = this.allTasks.get(taskId);
    if (!task || task.status !== 'queued') return false;
    this.queues[task.type] = this.queues[task.type].filter(t => t.id !== taskId);
    task.status = 'failed';
    return true;
  }
}

// Singleton
export const orchestrator = new ParallelTaskOrchestrator();
