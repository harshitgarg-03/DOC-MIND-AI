from google import genai
import chromadb
from chromadb.utils import embedding_functions
import time
from app.core.config import GEMINI_API_KEY, CHROMA_PATH, EMBEDDING_MODEL
from app.core.cache import cache_get, cache_set, embedding_cache_key
from app.core.config import EMBEDDING_CACHE_TTL

genai_client = genai.Client(api_key=GEMINI_API_KEY)

embedder = embedding_functions.GoogleGeminiEmbeddingFunction(
    model_name=EMBEDDING_MODEL,
    task_type="RETRIEVAL_DOCUMENT",
)

def embed_texts_individually(texts: list[str]) -> list[list[float]]:
    embeddings = []
    batch_size = 30

    print(f"📄 Total chunks: {len(texts)}")

    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]

        print(
            f"🔄 EMBEDDING BATCH "
            f"{start + 1}-{min(start + batch_size, len(texts))}"
            f"/{len(texts)}"
        )

        batch_embeddings = []

        for text in batch:
            key = embedding_cache_key(text)
            cached = cache_get(key)

            if cached is not None:
                print("🟢 CACHE HIT")
                batch_embeddings.append(cached)
            else:
                batch_embeddings.append(None)

        # Only send uncached texts to Gemini
        missing_indexes = [
            i for i, embedding in enumerate(batch_embeddings)
            if embedding is None
        ]

        if missing_indexes:
            missing_texts = [batch[i] for i in missing_indexes]

            print(
                f"🔴 CACHE MISS: {len(missing_texts)} "
                f"→ Gemini embedding request"
            )

            generated = embedder(missing_texts)

            time.sleep(2)

            for index, embedding in zip(missing_indexes, generated):
                batch_embeddings[index] = embedding

                key = embedding_cache_key(batch[index])
                cache_set(
                    key,
                    embedding,
                    EMBEDDING_CACHE_TTL
                )

        embeddings.extend(batch_embeddings)

        print(
            f"✅ BATCH COMPLETE "
            f"{len(embeddings)}/{len(texts)}"
        )

    print(f"🎉 EMBEDDING COMPLETE: {len(embeddings)}/{len(texts)}")

    return embeddings

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = chroma_client.get_or_create_collection(
    name="pdf_chunks",
    embedding_function=embedder,
)