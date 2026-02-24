// agentRouter.ts
// Centralized router for Agent Lee's agents, pipelines, and live reporting

import { EventEmitter } from 'events';

interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  lastReport: string;
  pipeline: string;
}

interface Pipeline {
  id: string;
  name: string;
  agents: string[];
  status: 'active' | 'inactive' | 'error';
}

class AgentRouter extends EventEmitter {
  agents: Record<string, Agent> = {};
  pipelines: Record<string, Pipeline> = {};

  registerAgent(agent: Agent) {
    this.agents[agent.id] = agent;
    this.emit('agentRegistered', agent);
  }

  updateAgentStatus(id: string, status: Agent['status'], lastReport: string) {
    if (this.agents[id]) {
      this.agents[id].status = status;
      this.agents[id].lastReport = lastReport;
      this.emit('agentStatusUpdated', this.agents[id]);
    }
  }

  registerPipeline(pipeline: Pipeline) {
    this.pipelines[pipeline.id] = pipeline;
    this.emit('pipelineRegistered', pipeline);
  }

  updatePipelineStatus(id: string, status: Pipeline['status']) {
    if (this.pipelines[id]) {
      this.pipelines[id].status = status;
      this.emit('pipelineStatusUpdated', this.pipelines[id]);
    }
  }

  getLiveAgents() {
    return Object.values(this.agents);
  }

  getLivePipelines() {
    return Object.values(this.pipelines);
  }

  getAgentReport(id: string) {
    return this.agents[id]?.lastReport || '';
  }
}

export const agentRouter = new AgentRouter();
