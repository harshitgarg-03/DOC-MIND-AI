import json
from app.core.clients import genai_client, collection
from app.core.config import CHAT_MODEL, MAX_CONTEXT_CHUNKS

PROMPT_TEMPLATE = """Answer the question based on the context provided below. If the answer is not available in the context, say "This information was not found in the document."

Context:
{context}

Question:
{question}
"""


def retrieve_relevant_chunks(question: str, document_id: str):
    total_chunks = collection.count()
    if total_chunks == 0:
        return None

    n = min(total_chunks, MAX_CONTEXT_CHUNKS)
    results = collection.query(query_texts=[question], n_results=n, where={"document_id": document_id})

    # TODO: distance-based threshold filtering yahan add karna hai
    relevant_chunks = results["documents"][0]
    relevant_metadata = results["metadatas"][0]
    return relevant_chunks, relevant_metadata


def build_prompt(question: str, relevant_chunks: list[str]) -> str:
    context = "\n\n---\n\n".join(relevant_chunks)
    return PROMPT_TEMPLATE.format(context=context, question=question)


async def stream_answer(question: str, relevant_chunks: list[str], relevant_metadata: list[dict]):
    prompt = build_prompt(question, relevant_chunks)

    response = genai_client.models.generate_content_stream(
        model=CHAT_MODEL,
        contents=prompt,
    )

    for chunk in response:
        if chunk.text:
            yield {"data": json.dumps({"token": chunk.text})}

    citations = [
        {
            "chunk_index": i,
            "page": meta.get("page"),
            "section": meta.get("section"),
            "preview": (doc[:180].strip() + "..." if len(doc) > 180 else doc.strip()),
        }
        for i, (doc, meta) in enumerate(zip(relevant_chunks, relevant_metadata))
    ]
    yield {"data": json.dumps({"citations": citations})}

    yield {"data": json.dumps({"done": True, "chunk_used": len(relevant_chunks)})}