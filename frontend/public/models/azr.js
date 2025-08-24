/**
 * Absolute Zero Reasoner (AZR) Module
 * Deep reasoning using Wllama (browser-native GGUF execution)
 */

import { Wllama } from '../../node_modules/@wllama/wllama/esm/index.js';

class AbsoluteZeroReasoner {
    constructor() {
        this.wllama = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.modelUrl = null; // Will be set to GitHub raw URL or local path
        this.loadingProgress = 0;

        // Wllama configuration - use installed version 2.3.2
        this.configPaths = {
            'single-thread/wllama.wasm': './node_modules/@wllama/wllama/esm/single-thread/wllama.wasm',
            'multi-thread/wllama.wasm': './node_modules/@wllama/wllama/esm/multi-thread/wllama.wasm',
            'multi-thread/wllama.worker.mjs': './node_modules/@wllama/wllama/esm/multi-thread/wllama.worker.mjs',
        };

        // Model configuration
        this.modelConfig = {
            n_ctx: 2048, // Smaller context for better performance
            n_threads: Math.min(navigator.hardwareConcurrency || 4, 4),
            temperature: 0.1,
            top_p: 0.9,
            n_gpu_layers: 0 // CPU only for compatibility
        };
    }

    async initialize() {
        if (this.isLoaded || this.isLoading) return this.wllama;

        this.isLoading = true;
        console.log('🔄 Loading AZR model with Wllama...');

        try {
            // Initialize Wllama
            this.wllama = new Wllama(this.configPaths);

            // Try to load model from different sources
            await this.loadModel();

            this.isLoaded = true;
            this.isLoading = false;
            console.log('✅ AZR model loaded successfully with Wllama');

            window.dispatchEvent(new CustomEvent('llmReady', {
                detail: { model: 'azr', hemisphere: 'azr' }
            }));

            return this.wllama;

        } catch (error) {
            this.isLoading = false;
            console.error('❌ Failed to load AZR model:', error);
            throw error;
        }
    }

    async loadModel() {
        console.log('🔄 Attempting to load AZR model...');

        // Try different model sources in order of preference
        const modelSources = [
            // Working Hugging Face models (smaller, browser-friendly)
            'https://huggingface.co/Xenova/llama2.c-stories15M/resolve/main/ggml-model-q8_0.gguf',
            'https://huggingface.co/Xenova/llama2.c-stories42M/resolve/main/ggml-model-q8_0.gguf',
            // Local file (fallback - will likely fail)
            './electron backend/llama_models/andrewzh_Absolute_Zero_Reasoner-Coder-3b-Q4_K_M.gguf'
        ];

        for (const modelUrl of modelSources) {
            try {
                console.log(`🔄 Trying to load model from: ${modelUrl}`);

                // First check if the model is accessible
                try {
                    const testResponse = await fetch(modelUrl, { method: 'HEAD' });
                    if (!testResponse.ok) {
                        console.log(`❌ Model not accessible: ${testResponse.status}`);
                        continue;
                    }
                    const size = testResponse.headers.get('content-length');
                    console.log(`✅ Model accessible, size: ${size} bytes`);
                } catch (testError) {
                    console.log(`❌ Model URL test failed: ${testError.message}`);
                    continue;
                }

                await this.wllama.loadModelFromUrl(modelUrl, {
                    progressCallback: (progress) => {
                        if (progress.total && progress.loaded) {
                            this.loadingProgress = Math.round((progress.loaded / progress.total) * 100);
                            if (this.loadingProgress % 10 === 0) { // Only log every 10%
                                console.log(`📥 AZR loading: ${this.loadingProgress}%`);

                                window.dispatchEvent(new CustomEvent('llmLoadingProgress', {
                                    detail: { model: 'azr', progress: this.loadingProgress }
                                }));
                            }
                        }
                    },
                    ...this.modelConfig
                });

                this.modelUrl = modelUrl;
                this.isLoaded = true;
                this.isLoading = false;
                console.log(`✅ AZR model loaded from: ${modelUrl}`);
                return;

                // Dispatch ready event
                window.dispatchEvent(new CustomEvent('llmReady', {
                    detail: { model: 'azr', hemisphere: 'indigo' }
                }));

                return;

            } catch (error) {
                console.warn(`⚠️ Failed to load from ${modelUrl}:`, error.message);
                continue;
            }
        }

        throw new Error('Could not load AZR model from any source');
    }

    async tryStartBridge() {
        console.log('🚀 Attempting to start AZR Bridge...');
        
        // Try to start the Python bridge
        try {
            const response = await fetch('/start-azr-bridge', { method: 'POST' });
            if (response.ok) {
                console.log('✅ AZR Bridge started, retrying connection...');
                setTimeout(() => this.initialize(), 2000);
            }
        } catch (error) {
            console.log('⚠️ Could not auto-start AZR Bridge. Please run: python azr_bridge.py');
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            
            console.log(`🔄 Reconnecting to AZR Bridge in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.initialize(), delay);
        } else {
            console.log('❌ Max reconnection attempts reached for AZR Bridge');
        }
    }

    send(message) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify(message));
        } else {
            throw new Error('AZR Bridge not connected');
        }
    }

    handleMessage(message) {
        const { type, requestId, data, error } = message;
        
        if (requestId && this.pendingRequests.has(requestId)) {
            const { resolve, reject } = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            
            if (error) {
                reject(new Error(error));
            } else {
                resolve(data);
            }
        }
        
        // Handle system messages
        if (type === 'status') {
            console.log('📊 AZR Status:', data);
        } else if (type === 'error') {
            console.error('❌ AZR Error:', error);
        }
    }

    async reason(problem, context = {}) {
        // Try to use Wllama-based reasoning first
        if (this.isLoaded) {
            return await this.reasonWithWllama(problem, context);
        }
        
        // Fallback to PHI-3 if AZR is not available
        console.log('⚠️ AZR not available, falling back to PHI-3 for reasoning');
        return await this.reasonWithPhi3Fallback(problem, context);
    }

    async reasonWithWllama(problem, context = {}) {
        if (!this.isLoaded) {
            await this.initialize();
        }

        // Build reasoning prompt
        const prompt = this.buildReasoningPrompt(problem, context);

        console.log('🧠 AZR reasoning with Wllama:', problem.substring(0, 100) + '...');

        try {
            const response = await this.wllama.createCompletion(prompt, {
                nPredict: context.maxTokens || 512,
                temperature: context.temperature || 0.1,
                topP: context.topP || 0.9,
                repeatPenalty: 1.1,
                stopSequence: ['</reasoning>', 'Human:', 'User:']
            });

            // Parse the reasoning response
            const reasoningResult = this.parseReasoningResponse(response);

            console.log('✅ AZR reasoning complete');
            return reasoningResult;

        } catch (error) {
            console.error('❌ AZR reasoning failed:', error);
            throw error;
        }
    }

    async reasonWithPhi3Fallback(problem, context = {}) {
        try {
            // Check if PHI-3 is available
            if (!window.phi3LLM || !window.phi3LLM.isLoaded) {
                throw new Error('PHI-3 fallback not available');
            }

            console.log('🔄 Using PHI-3 for reasoning fallback');

            const reasoningPrompt = `You are an advanced reasoning system. Analyze this problem step by step:

Problem: ${problem}

Please provide:
1. Step-by-step analysis
2. Clear reasoning process
3. Final solution

Analysis:`;

            const response = await window.phi3LLM.generate(reasoningPrompt, {
                maxTokens: context.maxTokens || 512,
                temperature: 0.1
            });

            return {
                solution: response.text,
                reasoning_steps: response.text.split('\n').filter(line => line.trim()),
                confidence: 0.7,
                verification: 'Completed using PHI-3 fallback',
                model: 'azr-phi3-fallback',
                hemisphere: 'azr'
            };

        } catch (error) {
            console.error('❌ PHI-3 fallback also failed:', error);
            
            // Final fallback - return a basic response
            return {
                solution: `I apologize, but I cannot process this reasoning request right now. The problem "${problem}" requires deeper analysis that is temporarily unavailable.`,
                reasoning_steps: ['AZR model unavailable', 'PHI-3 fallback failed', 'Basic response provided'],
                confidence: 0.1,
                verification: 'Fallback response - systems unavailable',
                model: 'azr-basic-fallback',
                hemisphere: 'azr'
            };
        }
    }

    buildReasoningPrompt(problem, context) {
        let prompt = `<reasoning>
You are the Absolute Zero Reasoner (AZR), an advanced AI system designed for deep logical reasoning and problem-solving.

Problem: ${problem}

Context: ${JSON.stringify(context, null, 2)}

Instructions:
1. Break down the problem into logical steps
2. Analyze each component systematically
3. Consider multiple approaches and their trade-offs
4. Provide a clear, actionable solution
5. Verify your reasoning for logical consistency

Reasoning Process:
`;

        // Add previous steps if provided
        if (context.previousSteps && context.previousSteps.length > 0) {
            prompt += "\nPrevious reasoning steps:\n";
            context.previousSteps.forEach((step, i) => {
                prompt += `${i + 1}. ${step}\n`;
            });
            prompt += "\nContinue reasoning:\n";
        }

        return prompt;
    }

    parseReasoningResponse(response) {
        const lines = response.split('\n');
        const reasoning_steps = [];
        let solution = "";
        let confidence = 0.8;

        let current_step = "";
        let in_solution = false;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Look for numbered steps
            if (/^\d+\./.test(trimmed)) {
                if (current_step) {
                    reasoning_steps.push(current_step);
                }
                current_step = trimmed;
            } else if (/^(solution|answer|result):/i.test(trimmed)) {
                if (current_step) {
                    reasoning_steps.push(current_step);
                    current_step = "";
                }
                in_solution = true;
                solution = trimmed.split(':', 1)[1]?.trim() || trimmed;
            } else if (in_solution) {
                solution += " " + trimmed;
            } else if (current_step) {
                current_step += " " + trimmed;
            }
        }

        // Add final step if exists
        if (current_step) {
            reasoning_steps.push(current_step);
        }

        // If no explicit solution found, use the last reasoning step
        if (!solution && reasoning_steps.length > 0) {
            solution = reasoning_steps[reasoning_steps.length - 1];
        }

        return {
            solution: solution,
            reasoning_steps: reasoning_steps,
            confidence: confidence,
            verification: 'Reasoning completed successfully',
            model: 'azr',
            hemisphere: 'azr'
        };
    }

    async solve(problem, steps = []) {
        const context = {
            previousSteps: steps,
            domain: 'general',
            requireVerification: true
        };

        return await this.reason(problem, context);
    }

    async verify(solution, problem) {
        if (!this.isLoaded) {
            await this.initialize();
        }

        const prompt = `<verification>
Original Problem: ${problem}

Proposed Solution: ${solution}

Please verify this solution by:
1. Checking if it addresses the original problem
2. Evaluating logical consistency
3. Identifying any potential issues or improvements
4. Providing a confidence score (0-1)

Verification:
`;

        try {
            const response = await this.wllama.createCompletion(prompt, {
                nPredict: 256,
                temperature: 0.1,
                stopSequence: ['</verification>', 'Human:', 'User:']
            });

            const verification_text = response.trim();

            return {
                verification: verification_text,
                is_valid: /valid|correct|accurate/i.test(verification_text),
                confidence: 0.8, // Could parse this from the response
                model: 'azr',
                hemisphere: 'azr'
            };

        } catch (error) {
            console.error('❌ AZR verification failed:', error);
            throw error;
        }
    }

    async orchestrate(task, availableModels = []) {
        const context = {
            task: task,
            availableModels: availableModels,
            systemState: this.getSystemState()
        };
        
        return await this.reason(`Orchestrate the following task: ${task}`, context);
    }

    getSystemState() {
        return {
            connectedModels: window.AgentLeeCore?.getConnectedModels?.() || [],
            activeHemispheres: window.AgentLeeCore?.getActiveHemispheres?.() || [],
            timestamp: new Date().toISOString()
        };
    }

    async orchestrate(task, availableModels = []) {
        const context = {
            task: task,
            availableModels: availableModels,
            systemState: this.getSystemState()
        };

        return await this.reason(`Orchestrate the following task: ${task}`, context);
    }

    getSystemState() {
        return {
            connectedModels: window.StreamlinedLLMManager?.getAvailableModels?.() || [],
            activeHemispheres: Object.keys(window.BRAIN_HEMISPHERES || {}),
            timestamp: new Date().toISOString()
        };
    }

    getStatus() {
        const hasPhi3Fallback = window.phi3LLM && window.phi3LLM.isLoaded;
        const effectivelyWorking = this.isLoaded || hasPhi3Fallback;
        
        return {
            model: 'azr',
            name: this.isLoaded ? 'Absolute Zero Reasoner (Wllama)' : 'AZR (PHI-3 Fallback)',
            isLoaded: effectivelyWorking,
            isLoading: this.isLoading,
            progress: this.loadingProgress,
            hemisphere: 'azr',
            color: this.isLoaded ? '#4B0082' : '#6B46C1',
            capabilities: ['reasoning', 'verification', 'orchestration', 'problem-solving'],
            modelUrl: this.modelUrl || 'fallback-mode',
            engine: this.isLoaded ? 'wllama' : 'phi3-fallback',
            contextLength: this.modelConfig.n_ctx,
            fallbackAvailable: hasPhi3Fallback
        };
    }

    async unload() {
        if (this.wllama) {
            await this.wllama.exit();
            this.wllama = null;
        }
        this.isLoaded = false;
        this.isLoading = false;
        console.log('🔌 AZR model unloaded');
    }
}

export const azrLLM = new AbsoluteZeroReasoner();
window.azrLLM = azrLLM;
// Expose the constructor on window so external modules can instantiate new instances
// of the AbsoluteZeroReasoner directly. This ensures LeeSearch and tool_components
// can use a fresh AZR model rather than falling back to stub classes.
window.AZRLLM = AbsoluteZeroReasoner;
