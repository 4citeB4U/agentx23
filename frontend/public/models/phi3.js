/**
 * PHI-3 Mini LLM Module
 * Instruction-tuned model for chat, reasoning, and RAG operations
 */

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@latest';

class Phi3LLM {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        // Use a supported model name - Microsoft's PHI-3 on Hugging Face
        this.modelName = 'microsoft/Phi-3-mini-4k-instruct';
        this.maxTokens = 4096; // Start with smaller context for reliability
        this.loadingProgress = 0;
        this.fallbackModels = [
            'microsoft/Phi-3-mini-4k-instruct',
            'Xenova/LaMini-Flan-T5-248M', // Fallback option
            'Xenova/distilgpt2', // More reliable fallback
            'Xenova/gpt2', // Very reliable
            'Xenova/distilbert-base-uncased' // Ultra-reliable final fallback
        ];
    }

    async initialize() {
        if (this.isLoaded || this.isLoading) return this.model;
        
        this.isLoading = true;
        console.log('🔄 Loading PHI-3 Mini (4K context)...');
        
        // Try models in order of preference
        for (const modelName of this.fallbackModels) {
            try {
                console.log(`🔄 Attempting to load: ${modelName}`);
                
                // Create pipeline with progress tracking
                this.model = await pipeline(
                    'text-generation',
                    modelName,
                    {
                        progress_callback: (progress) => {
                            if (progress.status === 'downloading') {
                                this.loadingProgress = Math.round((progress.loaded / progress.total) * 100);
                                console.log(`📥 PHI-3 loading: ${this.loadingProgress}%`);
                                
                                // Dispatch progress event
                                window.dispatchEvent(new CustomEvent('llmLoadingProgress', {
                                    detail: { model: 'phi3', progress: this.loadingProgress }
                                }));
                            }
                        }
                    }
                );
                
                this.modelName = modelName; // Update to successful model
                this.isLoaded = true;
                this.isLoading = false;
                console.log(`✅ PHI-3 loaded successfully: ${modelName}`);
                
                // Dispatch ready event
                window.dispatchEvent(new CustomEvent('llmReady', {
                    detail: { model: 'phi3', hemisphere: 'phi3' }
                }));
                
                return this.model;
                
            } catch (error) {
                console.log(`⚠️ Failed to load ${modelName}: ${error.message}`);
                console.log(`📊 Error details:`, error);
                
                // Add specific error handling for common issues
                if (error.message.includes('fetch')) {
                    console.log(`🌐 Network issue with ${modelName}, trying next...`);
                } else if (error.message.includes('ONNX')) {
                    console.log(`🔧 ONNX compatibility issue with ${modelName}, trying next...`);
                } else if (error.message.includes('memory')) {
                    console.log(`💾 Memory issue with ${modelName}, trying smaller model...`);
                }
                // Continue to next model
            }
        }
        
        // If all models failed
        this.isLoading = false;
        throw new Error('Failed to load any PHI-3 compatible model');
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
            console.log('🧠 PHI-3 generating response...');
            const response = await this.model(prompt, config);
            
            // Extract generated text (remove original prompt)
            const generatedText = response[0].generated_text.replace(prompt, '').trim();
            
            console.log('✅ PHI-3 response generated');
            return {
                text: generatedText,
                model: 'phi3',
                tokens: generatedText.split(' ').length,
                hemisphere: 'phi3'
            };
        } catch (error) {
            console.error('❌ PHI-3 generation failed:', error);
            throw error;
        }
    }

    async chat(message, context = []) {
        // Format as chat conversation
        let prompt = '';
        
        // Add context if provided
        if (context.length > 0) {
            context.forEach(msg => {
                prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
            });
        }
        
        prompt += `User: ${message}\nAssistant:`;
        
        return await this.generate(prompt, { maxTokens: 200 });
    }

    async reason(problem, steps = []) {
        // Format for reasoning tasks
        let prompt = `Problem: ${problem}\n\n`;
        
        if (steps.length > 0) {
            prompt += 'Previous reasoning steps:\n';
            steps.forEach((step, i) => {
                prompt += `${i + 1}. ${step}\n`;
            });
            prompt += '\n';
        }
        
        prompt += 'Next reasoning step:';
        
        return await this.generate(prompt, { maxTokens: 100, temperature: 0.3 });
    }

    async summarize(text, maxLength = 100) {
        const prompt = `Summarize the following text in ${maxLength} words or less:\n\n${text}\n\nSummary:`;
        return await this.generate(prompt, { maxTokens: maxLength + 20 });
    }

    getStatus() {
        return {
            model: 'phi3',
            name: 'PHI-3 Mini 128K',
            isLoaded: this.isLoaded,
            isLoading: this.isLoading,
            progress: this.loadingProgress,
            hemisphere: 'phi3',
            color: '#FFD700',
            capabilities: ['chat', 'reasoning', 'summarization', 'rag'],
            contextLength: this.maxTokens
        };
    }
}

// Create and export instance
export const phi3LLM = new Phi3LLM();

// Global access
window.phi3LLM = phi3LLM;
// Expose the constructor on window so external modules can instantiate new instances
// of this model directly. This avoids falling back to stubs defined in index.html.
window.Phi3LLM = Phi3LLM;
