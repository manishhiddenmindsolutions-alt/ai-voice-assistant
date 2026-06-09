from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import os

# pyrefly: ignore [missing-import]
from app.db.session import get_db
# pyrefly: ignore [missing-import]
from app.models.orm import DocumentORM, AgentORM, UserORM
# pyrefly: ignore [missing-import]
from app.api.deps import get_current_user
# pyrefly: ignore [missing-import]
from app.services.rag import RAGService
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/agent/{agent_id}", response_model=List[DocumentResponse])
async def list_agent_documents(
    agent_id: str,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists all knowledge documents associated with a specific agent."""
    # 1. Verify agent ownership
    stmt = select(AgentORM).where(AgentORM.id == agent_id, AgentORM.user_id == current_user.id)
    res = await db.execute(stmt)
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or unauthorized access.")

    # 2. Retrieve documents
    doc_stmt = select(DocumentORM).where(DocumentORM.agent_id == agent_id, DocumentORM.user_id == current_user.id)
    doc_res = await db.execute(doc_stmt)
    return doc_res.scalars().all()


@router.post("/agent/{agent_id}", response_model=DocumentResponse)
async def upload_agent_document(
    agent_id: str,
    file: UploadFile = File(...),
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Uploads a PDF or TXT file to be processed, chunked, and indexed in the agent's knowledge base."""
    # 1. Verify agent ownership
    stmt = select(AgentORM).where(AgentORM.id == agent_id, AgentORM.user_id == current_user.id)
    res = await db.execute(stmt)
    agent = res.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or unauthorized access.")

    # 2. Validate file type
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(status_code=400, detail="Only PDF (.pdf) and Text (.txt) files are supported.")

    # 3. Read content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file content: {str(e)}")

    # 4. Delegate to RAGService
    try:
        doc = await RAGService.add_document(
            db=db,
            agent_id=agent_id,
            user_id=current_user.id,
            file_content=content,
            filename=filename
        )
        return doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal indexing error: {str(e)}")


@router.delete("/{document_id}")
async def delete_agent_document(
    document_id: str,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a specific knowledge document and removes its indexed vectors."""
    try:
        await RAGService.delete_document(
            db=db,
            document_id=document_id,
            user_id=current_user.id
        )
        return {"status": "success", "message": "Document deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@router.get("/search")
async def search_agent_knowledge(
    agent_id: str,
    query: str,
    limit: int = 4,
    db: AsyncSession = Depends(get_db)
):
    """Internal search endpoint called by the agent worker to search a specific agent's knowledge base."""
    try:
        results = await RAGService.search_knowledge(agent_id=agent_id, query=query, limit=limit)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

