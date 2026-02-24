// liveGauges.tsx
// React component for live gauges and agent movement visualization

import React, { useEffect, useState } from 'react';
import { agentRouter } from './agentRouter';

export function LiveGauges() {
  const [agents, setAgents] = useState([]);
  const [pipelines, setPipelines] = useState([]);

  useEffect(() => {
    setAgents(agentRouter.getLiveAgents());
    setPipelines(agentRouter.getLivePipelines());
    
    const handleAgentUpdate = () => setAgents(agentRouter.getLiveAgents());
    const handlePipelineUpdate = () => setPipelines(agentRouter.getLivePipelines());

    agentRouter.on('agentStatusUpdated', handleAgentUpdate);
    agentRouter.on('pipelineStatusUpdated', handlePipelineUpdate);

    return () => {
      agentRouter.off('agentStatusUpdated', handleAgentUpdate);
      agentRouter.off('pipelineStatusUpdated', handlePipelineUpdate);
    };
  }, []);

  return (
    <div>
      <h2>Live Agent Gauges</h2>
      <ul>
        {agents.map(agent => (
          <li key={agent.id}>
            <strong>{agent.name}</strong> — Status: {agent.status} — Last Report: {agent.lastReport}
          </li>
        ))}
      </ul>
      <h2>Live Pipeline Gauges</h2>
      <ul>
        {pipelines.map(pipeline => (
          <li key={pipeline.id}>
            <strong>{pipeline.name}</strong> — Status: {pipeline.status} — Agents: {pipeline.agents.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}
