/**
 * MiniLM Embedder Module
 * Semantic embeddings for RAG and search operations
 */

import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@latest';

class EmbedderLLM {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        this.loadingProgress = 0;
        this.embeddingCache = new Map();
    }

    async initialize() {
        if (this.isLoaded || this.isLoading) return this.model;
        
        this.isLoading = true;
        console.log('🔄 Loading MiniLM Embedder...');
        
        try {
            this.model = await pipeline(
                'feature-extraction',
                this.modelName,
                {
                    progress_callback: (progress) => {
                        if (progress.status === 'downloading') {
                            this.loadingProgress = Math.round((progress.loaded / progress.total) * 100);
                            console.log(`📥 Embedder loading: ${this.loadingProgress}%`);
                            
                            window.dispatchEvent(new CustomEvent('llmLoadingProgress', {
                                detail: { model: 'embedder', progress: this.loadingProgress }
                            }));
                        }
                    }
                }
            );
            
            this.isLoaded = true;
            this.isLoading = false;
            console.log('✅ MiniLM Embedder loaded successfully');
            
            window.dispatchEvent(new CustomEvent('llmReady', {
                detail: { model: 'embedder', hemisphere: 'echo' }
            }));
            
            return this.model;
        } catch (error) {
            this.isLoading = false;
            console.error('❌ Failed to load Embedder:', error);
            throw error;
        }
    }

    async embed(text, useCache = true) {
        if (!this.isLoaded) {
            await this.initialize();
        }

        // Check cache first
        if (useCache && this.embeddingCache.has(text)) {
            console.log('📋 Using cached embedding');
            return this.embeddingCache.get(text);
        }

        try {
            console.log('🔍 Generating embedding...');
            const embedding = await this.model(text, { 
                pooling: 'mean', 
                normalize: true 
            });
            
            const result = {
                text: text,
                embedding: Array.from(embedding.data),
                dimensions: embedding.dims[1],
                model: 'embedder',
                hemisphere: 'echo'
            };
            
            // Cache the result
            if (useCache) {
                this.embeddingCache.set(text, result);
            }
            
            console.log('✅ Embedding generated');
            return result;
        } catch (error) {
            console.error('❌ Embedding generation failed:', error);
            throw error;
        }
    }

    async embedBatch(texts, useCache = true) {
        const embeddings = [];
        for (const text of texts) {
            const embedding = await this.embed(text, useCache);
            embeddings.push(embedding);
        }
        return embeddings;
    }

    cosineSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same dimensions');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    async findSimilar(queryText, documents, threshold = 0.5) {
        const queryEmbedding = await this.embed(queryText);
        const results = [];

        for (const doc of documents) {
            let docEmbedding;
            if (doc.embedding) {
                docEmbedding = doc;
            } else {
                docEmbedding = await this.embed(doc.text || doc);
            }

            const similarity = this.cosineSimilarity(
                queryEmbedding.embedding,
                docEmbedding.embedding
            );

            if (similarity >= threshold) {
                results.push({
                    document: doc,
                    similarity: similarity,
                    embedding: docEmbedding
                });
            }
        }

        // Sort by similarity (highest first)
        return results.sort((a, b) => b.similarity - a.similarity);
    }

    async semanticSearch(query, documents, topK = 5) {
        const results = await this.findSimilar(query, documents, 0);
        return results.slice(0, topK);
    }

    clearCache() {
        this.embeddingCache.clear();
        console.log('🗑️ Embedding cache cleared');
    }

    getCacheSize() {
        return this.embeddingCache.size;
    }

    getStatus() {
        return {
            model: 'embedder',
            name: 'MiniLM Embedder',
            isLoaded: this.isLoaded,
            isLoading: this.isLoading,
            progress: this.loadingProgress,
            hemisphere: 'echo',
            color: '#FF4500',
            capabilities: ['embeddings', 'semantic-search', 'rag', 'similarity'],
            cacheSize: this.getCacheSize(),
            dimensions: 384
        };
    }
}

export const embedderLLM = new EmbedderLLM();
window.embedderLLM = embedderLLM;
// Make the embedder available under the expected name. LeeSearch looks for window.Embedder
// with initialize() and embed() methods; by assigning the instance here we satisfy that API.
window.Embedder = embedderLLM;
// Also expose the constructor so that other modules can instantiate a new embedder if needed.
window.EmbedderLLM = EmbedderLLM;
