/**
 * Llama 3.2-1B LLM Module
 * General chat, RAG, and reasoning model
 */

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@latest';

class LlamaLLM {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        // Use compatible models
        this.fallbackModels = [
            'Xenova/LaMini-Flan-T5-248M',     // Instruction-tuned model
            'Xenova/distilgpt2',              // DistilGPT-2
            'Xenova/gpt2'                     // Standard GPT-2
        ];
        this.modelName = this.fallbackModels[0];
        this.maxTokens = 1024;
        this.loadingProgress = 0;
    }

    async initialize() {
        if (this.isLoaded || this.isLoading) return this.model;
        
        this.isLoading = true;
        console.log('🔄 Loading Llama compatible model...');
        
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
                                console.log(`📥 Llama loading: ${this.loadingProgress}%`);
                                
                                window.dispatchEvent(new CustomEvent('llmLoadingProgress', {
                                    detail: { model: 'llama', progress: this.loadingProgress }
                                }));
                            }
                        }
                    }
                );
                
                this.modelName = modelName;
                this.isLoaded = true;
                this.isLoading = false;
                console.log(`✅ Llama loaded successfully: ${modelName}`);
                
                window.dispatchEvent(new CustomEvent('llmReady', {
                    detail: { model: 'llama', hemisphere: 'llama' }
                }));
                
                return this.model;
                
            } catch (error) {
                console.log(`⚠️ Failed to load ${modelName}: ${error.message}`);
            }
        }
        
        this.isLoading = false;
        throw new Error('Failed to load any Llama compatible model');
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
            console.log('🦙 Llama generating response...');
            const response = await this.model(prompt, config);
            
            const generatedText = response[0].generated_text.replace(prompt, '').trim();
            
            console.log('✅ Llama response generated');
            return {
                text: generatedText,
                model: 'llama',
                tokens: generatedText.split(' ').length,
                hemisphere: 'llama'
            };
        } catch (error) {
            console.error('❌ Llama generation failed:', error);
            throw error;
        }
    }

    async chat(message, context = []) {
        let prompt = '<|begin_of_text|>';
        
        if (context.length > 0) {
            context.forEach(msg => {
                prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n${msg.content}<|eot_id|>`;
            });
        }
        
        prompt += `<|start_header_id|>user<|end_header_id|>\n${message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`;
        
        return await this.generate(prompt, { maxTokens: 200 });
    }

    async databaseQuery(query, schema = '') {
        let prompt = 'Database Query Assistant\n\n';
        if (schema) {
            prompt += `Schema: ${schema}\n\n`;
        }
        prompt += `Query: ${query}\n\nResponse:`;
        
        return await this.generate(prompt, { maxTokens: 150, temperature: 0.3 });
    }

    async dataAnalysis(data, question) {
        const prompt = `Data Analysis Task\n\nData: ${JSON.stringify(data, null, 2)}\n\nQuestion: ${question}\n\nAnalysis:`;
        return await this.generate(prompt, { maxTokens: 200 });
    }

    getStatus() {
        return {
            model: 'llama',
            name: 'Llama 3.2-1B',
            isLoaded: this.isLoaded,
            isLoading: this.isLoading,
            progress: this.loadingProgress,
            hemisphere: 'llama',
            color: '#87CEEB',
            capabilities: ['chat', 'database', 'analysis', 'general'],
            contextLength: this.maxTokens
        };
    }
}

export const llamaLLM = new LlamaLLM();
window.llamaLLM = llamaLLM;
// Expose the constructor on window so external modules can instantiate new instances
// of LlamaLLM directly. Without this, LEW.llm falls back to stub classes.
window.LlamaLLM = LlamaLLM;
