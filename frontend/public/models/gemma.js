/**
 * Gemma 2B LLM Module
 * Chat, summarization, and reasoning model
 */

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@latest';

class GemmaLLM {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        // Use compatible models
        this.fallbackModels = [
            'Xenova/LaMini-Flan-T5-248M',     // Small instruction-tuned model
            'Xenova/distilgpt2',              // DistilGPT-2 for generation
            'microsoft/DialoGPT-medium'        // Dialog model
        ];
        this.modelName = this.fallbackModels[0];
        this.maxTokens = 1024; // Conservative for compatibility
        this.loadingProgress = 0;
    }

    async initialize() {
        if (this.isLoaded || this.isLoading) return this.model;
        
        this.isLoading = true;
        console.log('🔄 Loading Gemma compatible model...');
        
        // Try models in order of preference
        for (const modelName of this.fallbackModels) {
            try {
                console.log(`🔄 Attempting to load: ${modelName}`);
                
                this.model = await pipeline(
                    'text-generation',
                    modelName,
                    {
                        progress_callback: (progress) => {
                            if (progress.status === 'downloading') {
                                this.loadingProgress = Math.round((progress.loaded / progress.total) * 100);
                                console.log(`📥 Gemma loading: ${this.loadingProgress}%`);
                                
                                window.dispatchEvent(new CustomEvent('llmLoadingProgress', {
                                    detail: { model: 'gemma', progress: this.loadingProgress }
                                }));
                            }
                        }
                    }
                );
                
                this.modelName = modelName;
                this.isLoaded = true;
                this.isLoading = false;
                console.log(`✅ Gemma loaded successfully: ${modelName}`);
                
                window.dispatchEvent(new CustomEvent('llmReady', {
                    detail: { model: 'gemma', hemisphere: 'gemini' }
                }));
                
                return this.model;
                
            } catch (error) {
                console.log(`⚠️ Failed to load ${modelName}: ${error.message}`);
            }
        }
        
        this.isLoading = false;
        throw new Error('Failed to load any Gemma compatible model');
    }

    async generate(prompt, options = {}) {
        if (!this.isLoaded) {
            await this.initialize();
        }

        const config = {
            max_new_tokens: options.maxTokens || 150,
            temperature: options.temperature || 0.7,
            do_sample: true,
            top_p: options.topP || 0.9,
            repetition_penalty: 1.1,
            ...options
        };

        try {
            console.log('💎 Gemma generating response...');
            const response = await this.model(prompt, config);
            
            const generatedText = response[0].generated_text.replace(prompt, '').trim();
            
            console.log('✅ Gemma response generated');
            return {
                text: generatedText,
                model: 'gemma',
                tokens: generatedText.split(' ').length,
                hemisphere: 'gemini'
            };
        } catch (error) {
            console.error('❌ Gemma generation failed:', error);
            throw error;
        }
    }

    async chat(message, context = []) {
        let prompt = '<bos>';
        
        if (context.length > 0) {
            context.forEach(msg => {
                prompt += `<start_of_turn>${msg.role}\n${msg.content}<end_of_turn>\n`;
            });
        }
        
        prompt += `<start_of_turn>user\n${message}<end_of_turn>\n<start_of_turn>model\n`;
        
        return await this.generate(prompt, { maxTokens: 200 });
    }

    async agentOperation(task, context = '') {
        let prompt = 'Agent Operation Task\n\n';
        if (context) {
            prompt += `Context: ${context}\n\n`;
        }
        prompt += `Task: ${task}\n\nAgent Response:`;
        
        return await this.generate(prompt, { maxTokens: 150 });
    }

    async generateEcho(userInput, systemState) {
        const prompt = `Generate an intelligent echo response for Agent Lee system.

User Input: ${userInput}
System State: ${JSON.stringify(systemState)}

Generate a helpful, contextual response that acknowledges the input and provides relevant information or next steps:`;
        
        return await this.generate(prompt, { maxTokens: 100, temperature: 0.8 });
    }

    getStatus() {
        return {
            model: 'gemma',
            name: 'Gemma 2B',
            isLoaded: this.isLoaded,
            isLoading: this.isLoading,
            progress: this.loadingProgress,
            hemisphere: 'gemini',
            color: '#FF8C00',
            capabilities: ['chat', 'agents', 'echo', 'summarization'],
            contextLength: this.maxTokens
        };
    }
}

export const gemmaLLM = new GemmaLLM();
window.gemmaLLM = gemmaLLM;
// Expose the constructor on window so external modules can instantiate new instances
// of GemmaLLM directly. Without this, LEW.llm falls back to stub classes.
window.GemmaLLM = GemmaLLM;
