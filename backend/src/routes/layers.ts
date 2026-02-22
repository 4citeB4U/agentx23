import { Router, Request, Response } from 'express';
import { layerEngine } from '../services/consciousness.js';

export const layersRouter = Router();

/**
 * GET /api/layers/status
 * Returns the full 50-layer registry + kernel/contextual breakdown.
 * Requires handshake (covered by securityMiddleware upstream).
 */
layersRouter.get('/status', (_req: Request, res: Response) => {
    const all = layerEngine.getAllLayers();
    const kernel = layerEngine.getKernelLayers();
    const loaded = layerEngine.isLoaded();

    const byRing: Record<number, typeof all> = {};
    all.forEach(l => {
        if (!byRing[l.ring]) byRing[l.ring] = [];
        byRing[l.ring].push(l);
    });

    res.json({
        loaded,
        version: '50-layer-v1',
        total: all.length,
        kernel_count: kernel.length,
        kernel_ids: kernel.map(l => l.id),
        by_ring: {
            ring_1_identity_kernel: (byRing[1] || []).map(l => ({ id: l.id, name: l.name, always_on: l.always_on })),
            ring_2_operational:     (byRing[2] || []).map(l => ({ id: l.id, name: l.name, always_on: l.always_on })),
            ring_3_memory_learning: (byRing[3] || []).map(l => ({ id: l.id, name: l.name, always_on: l.always_on })),
            ring_4_expansion:       (byRing[4] || []).map(l => ({ id: l.id, name: l.name, always_on: l.always_on })),
        },
        all_layers: all.map(l => ({
            id: l.id,
            name: l.name,
            group: l.group,
            ring: l.ring,
            always_on: l.always_on,
            enforcement: l.enforcement ?? 'STANDARD',
            purpose: l.purpose,
            tags: l.tags,
        })),
        identity_assertion: 'Agent Lee (entity) — 50-layer cognitive OS — voice-first, tool-grounded.',
        timestamp: new Date().toISOString(),
    });
});

/**
 * POST /api/layers/evaluate
 * Given a message/intent, returns which layers would activate.
 */
layersRouter.post('/evaluate', (req: Request, res: Response) => {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'text field required' });
        return;
    }
    const active = layerEngine.selectActiveLayers(text);
    const ctx = layerEngine.buildLayerContext(active);
    res.json({
        input: text.slice(0, 200),
        active_layer_count: active.length,
        active_layers: active.map(l => ({ id: l.id, name: l.name, always_on: l.always_on, tags: l.tags })),
        layer_context_block: ctx,
        timestamp: new Date().toISOString(),
    });
});
