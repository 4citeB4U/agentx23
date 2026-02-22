/**
 * TELEMETRY SERVICE
 * Collects and broadcasts real-time system metrics for the Settings Control Tower.
 */

interface SystemMetrics {
    timestamp: number;
    system: {
        state: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
        ports: {
            frontend: { port: number; healthy: boolean };
            backend: { port: number; healthy: boolean };
            ws: { port: number; healthy: boolean };
            devtools: { port: number; healthy: boolean };
        };
        latency: number; // ms
        queueDepth: number;
        errorRate: number; // percentage
    };
    messageBus: {
        messagesPerSecond: number;
        dedupeDrops: number;
        totalProcessed: number;
    };
    llmOrchestration: {
        model: string;
        tokensUsed: number;
        latency: number;
        requestsPerMinute: number;
    };
    tooling: {
        mcpCalls: number;
        terminalCommands: number;
        filesystemOps: number;
    };
    deploy: {
        currentStage: string;
        successRate: number;
        lastDeployTime: number | null;
    };
}

interface TelemetryEvent {
    id: string;
    timestamp: number;
    type: 'security' | 'tool' | 'filesystem' | 'deploy';
    message: string;
    metadata?: Record<string, any>;
}

export class TelemetryService {
    private static instance: TelemetryService;
    private metrics: SystemMetrics;
    private events: TelemetryEvent[] = [];
    private readonly MAX_EVENTS = 100; // Keep last 100 events
    private readonly frontendPort = Number(process.env.FRONTEND_PORT || process.env.VITE_PORT || 8000);
    private readonly backendPort = Number(process.env.PORT || 8001);
    private readonly wsPort = Number(process.env.WS_PORT || 8003);
    private readonly devtoolsPort = Number(process.env.CHROME_DEVTOOLS_PORT || 8015);

    private constructor() {
        this.metrics = this.initializeMetrics();
        this.startCollection();
    }

    static getInstance(): TelemetryService {
        if (!this.instance) {
            this.instance = new TelemetryService();
        }
        return this.instance;
    }

    private initializeMetrics(): SystemMetrics {
        return {
            timestamp: Date.now(),
            system: {
                state: 'ONLINE',
                ports: {
                    frontend: { port: this.frontendPort, healthy: true },
                    backend: { port: this.backendPort, healthy: true },
                    ws: { port: this.wsPort, healthy: true },
                    devtools: { port: this.devtoolsPort, healthy: false } // Assume false until checked
                },
                latency: 0,
                queueDepth: 0,
                errorRate: 0
            },
            messageBus: {
                messagesPerSecond: 0,
                dedupeDrops: 0,
                totalProcessed: 0
            },
            llmOrchestration: {
                model: 'gemini-2.0-flash-thinking-exp-01-21',
                tokensUsed: 0,
                latency: 0,
                requestsPerMinute: 0
            },
            tooling: {
                mcpCalls: 0,
                terminalCommands: 0,
                filesystemOps: 0
            },
            deploy: {
                currentStage: 'idle',
                successRate: 100,
                lastDeployTime: null
            }
        };
    }

    private startCollection(): void {
        // Collect metrics every 1 second
        setInterval(() => {
            this.updateMetrics();
        }, 1000);
    }

    private async updateMetrics(): Promise<void> {
        this.metrics.timestamp = Date.now();

        // Update port health (simple ping check)
        await this.checkPortHealth();

        // Calculate latency (mock for now, real implementation would measure actual response times)
        this.metrics.system.latency = this.calculateLatency();

        // Update queue depth (integration with router if available)
        this.metrics.system.queueDepth = this.getQueueDepth();
    }

    private async checkPortHealth(): Promise<void> {
        // Simple health check - ping each port
        try {
            // Backend health endpoint
            const backendRes = await fetch(`http://localhost:${this.backendPort}/health`).catch(() => null);
            this.metrics.system.ports.backend.healthy = backendRes?.ok ?? false;

            // Frontend dev server
            const frontendRes = await fetch(`http://localhost:${this.frontendPort}`).catch(() => null);
            this.metrics.system.ports.frontend.healthy = frontendRes?.ok ?? false;
        } catch (error) {
            console.error('[Telemetry] Port health check failed:', error);
        }
    }

    private calculateLatency(): number {
        // Mock latency calculation - in real implementation, measure HTTP/WS round-trip
        return Math.floor(Math.random() * 50) + 30; // 30-80ms range
    }

    private getQueueDepth(): number {
        // Mock - would integrate with MessageRouter.queueSize
        return 0;
    }

    // Public API for other services to report events
    public recordEvent(type: TelemetryEvent['type'], message: string, metadata?: Record<string, any>): void {
        const event: TelemetryEvent = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            type,
            message,
            metadata
        };

        this.events.unshift(event);
        if (this.events.length > this.MAX_EVENTS) {
            this.events = this.events.slice(0, this.MAX_EVENTS);
        }
    }

    public recordMessageBusActivity(messagesPerSecond: number, dedupeDrops: number): void {
        this.metrics.messageBus.messagesPerSecond = messagesPerSecond;
        this.metrics.messageBus.dedupeDrops += dedupeDrops;
        this.metrics.messageBus.totalProcessed += messagesPerSecond;
    }

    public recordLLMActivity(model: string, tokensUsed: number, latency: number): void {
        this.metrics.llmOrchestration.model = model;
        this.metrics.llmOrchestration.tokensUsed += tokensUsed;
        this.metrics.llmOrchestration.latency = latency;
        this.metrics.llmOrchestration.requestsPerMinute += 1;
    }

    public recordToolActivity(type: 'mcp' | 'terminal' | 'filesystem'): void {
        switch (type) {
            case 'mcp':
                this.metrics.tooling.mcpCalls += 1;
                break;
            case 'terminal':
                this.metrics.tooling.terminalCommands += 1;
                break;
            case 'filesystem':
                this.metrics.tooling.filesystemOps += 1;
                break;
        }
    }

    public recordDeployEvent(stage: string, success: boolean): void {
        this.metrics.deploy.currentStage = stage;
        this.metrics.deploy.lastDeployTime = Date.now();

        // Update success rate (simple moving average)
        const currentRate = this.metrics.deploy.successRate;
        this.metrics.deploy.successRate = (currentRate * 0.9) + (success ? 10 : 0);
    }

    // Getters for HTTP API
    public getCurrentMetrics(): SystemMetrics {
        return { ...this.metrics };
    }

    public getEvents(limit: number = 50): TelemetryEvent[] {
        return this.events.slice(0, limit);
    }

    public getEventsByType(type: TelemetryEvent['type'], limit: number = 50): TelemetryEvent[] {
        return this.events.filter(e => e.type === type).slice(0, limit);
    }
}

// Singleton export
export const telemetryService = TelemetryService.getInstance();
