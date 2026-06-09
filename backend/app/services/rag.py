import os
import uuid
import logging
import httpx
import hashlib
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# pyrefly: ignore [missing-import]
from app.core.config import settings
# pyrefly: ignore [missing-import]
from app.models.orm import DocumentORM, ProviderConnectionORM
# pyrefly: ignore [missing-import]
from app.core.security import vault

logger = logging.getLogger("rag-service")

# Initialize Qdrant Client pointing to the Cloud cluster
try:
    qdrant_client = QdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY
    )
    logger.info(f"Initialized Cloud Qdrant client at {settings.QDRANT_URL}")
except Exception as e:
    logger.error(f"Failed to connect to Cloud Qdrant client: {e}")
    # Fallback client to prevent startup failures
    qdrant_client = QdrantClient(url="http://localhost:6333")

COLLECTION_NAME = "agent_knowledge_base_gemini"
EMBEDDING_DIM = 768  # Gemini gemini-embedding-2 standard optimized output dimension

# Ensure collection is created with 768 dimensions and payload indexes on startup
try:
    if not qdrant_client.collection_exists(COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=qdrant_models.VectorParams(
                size=EMBEDDING_DIM,
                distance=qdrant_models.Distance.COSINE
            )
        )
        logger.info(f"Created Cloud Qdrant collection '{COLLECTION_NAME}' with {EMBEDDING_DIM} dimensions.")
    
    # Ensure payload indexes exist for strict Qdrant environments (required for deletion filters)
    for field in ["document_id", "agent_id"]:
        try:
            qdrant_client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=field,
                field_schema=qdrant_models.PayloadSchemaType.KEYWORD
            )
            logger.info(f"Ensured payload index on '{field}' in collection '{COLLECTION_NAME}'")
        except Exception as ie:
            logger.warning(f"Payload index creation warning for '{field}': {ie}")
except Exception as e:
    logger.error(f"Failed to initialize Qdrant collection: {e}")


class RAGService:
    """RAG system service for managing agent PDF/txt knowledge base via Gemini & Qdrant Cloud."""

    @staticmethod
    async def _get_api_key(db: AsyncSession, user_id: str, provider: str) -> Optional[str]:
        """Fetch and decrypt user's provider API key."""
        try:
            stmt = select(ProviderConnectionORM).where(
                ProviderConnectionORM.user_id == user_id,
                ProviderConnectionORM.provider == provider
            )
            res = await db.execute(stmt)
            conn = res.scalar_one_or_none()
            if conn and conn.api_key:
                return vault.decrypt(conn.api_key)
        except Exception as e:
            logger.error(f"Error loading {provider} key from vault: {e}")
        return None

    @classmethod
    async def _generate_embeddings(
        cls, 
        texts: List[str], 
        db: Optional[AsyncSession] = None, 
        user_id: Optional[str] = None,
        is_query: bool = False
    ) -> List[List[float]]:
        """
        Generates vector embeddings for a list of texts using Google Gemini gemini-embedding-2.
        Falls back to deterministic local pseudo-embeddings of 768 dimensions if no key is configured.
        """
        # Resolve Gemini API Key (Database Connection -> Config settings -> os.environ)
        gemini_key = None
        if db and user_id:
            gemini_key = await cls._get_api_key(db, user_id, "gemini")
        if not gemini_key:
            gemini_key = settings.GEMINI_EMBEDDING_KEY or os.getenv("GEMINI_EMBEDDING_KEY")

        if gemini_key:
            try:
                logger.info(f"Generating Gemini embeddings for {len(texts)} chunks...")
                
                # Format request for batchEmbedContents targeting gemini-embedding-2 with 768 dimensions
                requests_payload = [
                    {
                        "model": "models/gemini-embedding-2",
                        "outputDimensionality": EMBEDDING_DIM,
                        "content": {
                            "parts": [{"text": text}]
                        }
                    } for text in texts
                ]
                
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key={gemini_key}",
                        headers={
                            "Content-Type": "application/json",
                            "x-goog-api-key": gemini_key
                        },
                        json={
                            "requests": requests_payload
                        },
                        timeout=15.0
                    )
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        return [item["values"] for item in data["embeddings"]]
                    else:
                        logger.warning(f"Gemini embedding call failed (Status {resp.status_code}): {resp.text}")
            except Exception as e:
                logger.error(f"Gemini embedding exception: {e}")

        # Local deterministic fallback (hash-based pseudo-embedding)
        logger.info("Using local 768-dimensional deterministic pseudo-embeddings fallback.")
        embeddings = []
        for text in texts:
            # Seed a generator with SHA256 of text
            hasher = hashlib.sha256(text.encode("utf-8"))
            seed = int(hasher.hexdigest()[:8], 16)
            rng = np.random.default_rng(seed)
            # Create a unit-normalized random vector
            vector = rng.standard_normal(EMBEDDING_DIM)
            vector /= np.linalg.norm(vector)
            embeddings.append(vector.tolist())
        return embeddings

    @classmethod
    def _chunk_text(cls, text: str, chunk_size: int = 600, overlap: int = 150) -> List[str]:
        """Splits text into chunks with overlap."""
        if not text:
            return []
        
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunks.append(text[start:end])
            start += chunk_size - overlap
            
        return chunks

    @classmethod
    async def add_document(
        cls, 
        db: AsyncSession, 
        agent_id: str, 
        user_id: str, 
        file_content: bytes, 
        filename: str
    ) -> DocumentORM:
        """Parses a document (PDF/txt), chunks it, embeds it via Gemini, indexes in Qdrant Cloud, and saves metadata."""
        # 1. Parse text based on file format
        text = ""
        file_type = "txt"
        if filename.lower().endswith(".pdf"):
            file_type = "pdf"
            try:
                import io
                pdf_file = io.BytesIO(file_content)
                reader = PdfReader(pdf_file)
                pages_text = []
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        pages_text.append(txt)
                text = "\n".join(pages_text)
            except Exception as e:
                logger.exception(f"Failed to parse PDF document {filename}: {e}")
                raise ValueError(f"Invalid PDF file: {str(e)}")
        else:
            try:
                text = file_content.decode("utf-8", errors="ignore")
            except Exception as e:
                raise ValueError(f"Invalid text file: {str(e)}")

        if not text.strip():
            raise ValueError("Document contains no readable text content.")

        # 2. Slice into chunks
        chunks = cls._chunk_text(text)
        if not chunks:
            raise ValueError("Failed to split document into readable chunks.")

        # 3. Generate Gemini embeddings
        embeddings = await cls._generate_embeddings(chunks, db=db, user_id=user_id, is_query=False)

        # 4. Save file to disk
        doc_id = str(uuid.uuid4())
        doc_dir = settings.DATA_DIR / "documents"
        doc_dir.mkdir(parents=True, exist_ok=True)
        
        file_ext = Path(filename).suffix
        local_file_path = doc_dir / f"{doc_id}{file_ext}"
        with open(local_file_path, "wb") as f:
            f.write(file_content)

        # 5. Insert points in Qdrant
        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            points.append(
                qdrant_models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "document_id": doc_id,
                        "agent_id": agent_id,
                        "filename": filename,
                        "chunk_index": i,
                        "text": chunk
                    }
                )
            )

        # Upsert in chunks to prevent large requests
        chunk_size = 100
        for offset in range(0, len(points), chunk_size):
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points[offset:offset+chunk_size]
            )

        # 6. Insert metadata in SQL DB
        doc_orm = DocumentORM(
            id=doc_id,
            user_id=user_id,
            agent_id=agent_id,
            filename=filename,
            file_type=file_type,
            file_size=len(file_content)
        )
        db.add(doc_orm)
        await db.commit()
        await db.refresh(doc_orm)
        
        logger.info(f"Indexed document {filename} ({len(chunks)} chunks) in Qdrant Cloud for Agent {agent_id}.")
        return doc_orm

    @classmethod
    async def delete_document(cls, db: AsyncSession, document_id: str, user_id: str):
        """Deletes a document from Qdrant Cloud, SQLite metadata, and storage disk."""
        # 1. Fetch document metadata
        stmt = select(DocumentORM).where(
            DocumentORM.id == document_id,
            DocumentORM.user_id == user_id
        )
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if not doc:
            raise ValueError("Document not found or unauthorized access.")

        # 2. Delete vectors from Qdrant matching payload document_id
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="document_id",
                        match=qdrant_models.MatchValue(value=document_id)
                    )
                ]
            )
        )

        # 3. Delete file from local disk
        doc_dir = settings.DATA_DIR / "documents"
        file_ext = ".pdf" if doc.file_type == "pdf" else ".txt"
        local_file_path = doc_dir / f"{document_id}{file_ext}"
        if local_file_path.exists():
            try:
                local_file_path.unlink()
            except Exception as e:
                logger.warning(f"Could not remove local document file: {e}")

        # 4. Remove metadata from SQL
        await db.delete(doc)
        await db.commit()
        logger.info(f"Deleted document {document_id} and its vector indices from Qdrant Cloud.")

    @classmethod
    async def search_knowledge(
        cls, 
        agent_id: str, 
        query: str, 
        limit: int = 4,
        db: Optional[AsyncSession] = None,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Searches the knowledge base vectors for a specific agent query using Gemini query embeddings."""
        if not query or not query.strip():
            return []

        # 1. Embed query
        embeddings = await cls._generate_embeddings([query], db=db, user_id=user_id, is_query=True)
        query_vector = embeddings[0]

        # 2. Query Qdrant with filters using query_points
        search_result = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="agent_id",
                        match=qdrant_models.MatchValue(value=agent_id)
                    )
                ]
            ),
            limit=limit
        )

        results = []
        for point in search_result.points:
            results.append({
                "text": point.payload.get("text", ""),
                "filename": point.payload.get("filename", ""),
                "score": point.score
            })
            
        return results
