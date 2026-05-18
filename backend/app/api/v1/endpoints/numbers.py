from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from app.db.session import get_db
from app.models.orm import PhoneNumberORM, UserORM
from app.api.deps import get_current_user

router = APIRouter()

# --- SCHEMAS ---
class NumberBase(BaseModel):
    number: str = "+1234567890"
    provider: str = "custom"
    provider_sid: Optional[str] = None

class NumberCreate(NumberBase):
    pass # user_id is now handled by JWT

class NumberResponse(NumberBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True

# --- ENDPOINTS ---

@router.post("/", response_model=NumberResponse)
async def add_number(
    number: NumberCreate, 
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        db_number = PhoneNumberORM(
            **number.model_dump(),
            user_id=current_user.id
        )
        db.add(db_number)
        await db.commit()
        await db.refresh(db_number)
        return db_number
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[NumberResponse])
async def list_numbers(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PhoneNumberORM).where(PhoneNumberORM.user_id == current_user.id))
    return result.scalars().all()

@router.delete("/{number_id}")
async def delete_number(
    number_id: str, 
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify ownership before delete
    stmt = select(PhoneNumberORM).where(
        PhoneNumberORM.id == number_id,
        PhoneNumberORM.user_id == current_user.id
    )
    result = await db.execute(stmt)
    db_number = result.scalar_one_or_none()
    
    if not db_number:
        raise HTTPException(status_code=404, detail="Phone number not found or unauthorized")
        
    await db.delete(db_number)
    await db.commit()
    return {"message": "Number deleted"}
