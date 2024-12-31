import { OpenAI } from 'openai';
import { getCompletion } from '../../../../src/utils';
import { QdrantClient } from 'qdrant-client';
import * as re from 're';

// Initialize connections
const client = new OpenAI();
const qdrant = new QdrantClient({ host: 'localhost' });

// Set embedding model
const EMBEDDING_MODEL = 'text-embedding-3-large';

// Set qdrant collection
const collectionName = 'help_center';

// Query function for qdrant
async function queryQdrant(query: string, collectionName: string, vectorName = 'article', topK = 5) {
    // Creates embedding vector from user query
    const embeddedQuery = (await client.embeddings.create({
        input: query,
        model: EMBEDDING_MODEL,
    })).data[0].embedding;

    const queryResults = await qdrant.search({
        collection_name: collectionName,
        query_vector: [vectorName, embeddedQuery],
        limit: topK,
    });

    return queryResults;
}

export async function queryDocs(query: string) {
    console.log(`Searching knowledge base with query: ${query}`);
    const queryResults = await queryQdrant(query, collectionName);
    const output: [string, string, string][] = [];

    for (const article of queryResults) {
        const title = article.payload["title"];
        const text = article.payload["text"];
        const url = article.payload["url"];

        output.push([title, text, url]);
    }

    if (output.length > 0) {
        const [title, content] = output[0];
        const response = `Title: ${title}\nContent: ${content}`;
        const truncatedContent = re.sub(r'\s+', ' ', content.length > 50 ? content.slice(0, 50) + '...' : content);
        console.log('Most relevant article title:', truncatedContent);
        return { response };
    } else {
        console.log('No results');
        return { response: 'No results found.' };
    }
}
