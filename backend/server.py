from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

# User Models
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "manager"

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    cash_balance: float = 0.0
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Sales Models
class SaleItem(BaseModel):
    product_name: str
    quantity: float
    unit_price: float
    total: float

class SaleCreate(BaseModel):
    customer_name: str
    items: List[SaleItem]
    total_amount: float
    payment_type: str  # "cash" or "credit"
    collected_by: str  # user_id
    notes: Optional[str] = None

class SaleResponse(BaseModel):
    id: str
    sale_number: str
    customer_name: str
    items: List[SaleItem]
    total_amount: float
    payment_type: str
    collected_by: str
    collected_by_name: str
    status: str  # "pending", "settled", "partial"
    paid_amount: float
    notes: Optional[str] = None
    created_at: datetime

# Cash Transfer Models
class TransferRequest(BaseModel):
    to_user_id: str
    amount: float
    reason: str

class TransferResponse(BaseModel):
    id: str
    from_user_id: str
    from_user_name: str
    to_user_id: str
    to_user_name: str
    amount: float
    reason: str
    status: str  # "pending", "approved", "rejected"
    created_at: datetime
    approved_at: Optional[datetime] = None

class TransferApproval(BaseModel):
    action: str  # "approve" or "reject"

# Production Models
class ProductionCreate(BaseModel):
    product_name: str
    quantity: float
    unit: str
    raw_materials_used: List[dict]
    workers: List[str]
    notes: Optional[str] = None

class ProductionResponse(BaseModel):
    id: str
    production_number: str
    product_name: str
    quantity: float
    unit: str
    raw_materials_used: List[dict]
    workers: List[str]
    status: str  # "in_progress", "completed"
    created_by: str
    created_by_name: str
    notes: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

# Raw Material Models
class RawMaterialCreate(BaseModel):
    material_name: str
    quantity: float
    unit: str
    unit_price: float
    supplier_name: str
    notes: Optional[str] = None

class RawMaterialResponse(BaseModel):
    id: str
    material_name: str
    quantity: float
    unit: str
    unit_price: float
    supplier_name: str
    added_by: str
    added_by_name: str
    notes: Optional[str] = None
    created_at: datetime

# Credit Models
class CreditPayment(BaseModel):
    sale_id: str
    amount: float
    collected_by: str
    notes: Optional[str] = None

class CreditPaymentResponse(BaseModel):
    id: str
    sale_id: str
    amount: float
    collected_by: str
    collected_by_name: str
    notes: Optional[str] = None
    created_at: datetime

# ==================== HELPER FUNCTIONS ====================

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def get_current_user(user_id: str = Depends(verify_token)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user
    user_id = str(uuid.uuid4())
    user_dict = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": hashed_password.decode('utf-8'),
        "role": user_data.role,
        "cash_balance": 0.0,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user_id})
    
    user_response = UserResponse(
        id=user_id,
        name=user_data.name,
        email=user_data.email,
        role=user_data.role,
        cash_balance=0.0,
        created_at=user_dict["created_at"]
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    # Find user
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user["password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create token
    access_token = create_access_token(data={"sub": user["id"]})
    
    user_response = UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        cash_balance=user.get("cash_balance", 0.0),
        created_at=user["created_at"]
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
        cash_balance=current_user.get("cash_balance", 0.0),
        created_at=current_user["created_at"]
    )

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard")
async def get_dashboard(current_user = Depends(get_current_user)):
    # Get all managers with cash balances
    managers = await db.users.find({"role": "manager"}).to_list(100)
    
    # Get pending transfer requests for current user
    pending_transfers = await db.transfers.find({
        "to_user_id": current_user["id"],
        "status": "pending"
    }).to_list(100)
    
    # Get recent transactions
    recent_sales = await db.sales.find({"collected_by": current_user["id"]}).sort("created_at", -1).limit(5).to_list(5)
    
    # Format managers list
    managers_list = []
    for manager in managers:
        managers_list.append({
            "id": manager["id"],
            "name": manager["name"],
            "cash_balance": manager.get("cash_balance", 0.0)
        })
    
    # Format pending transfers
    transfers_list = []
    for transfer in pending_transfers:
        from_user = await db.users.find_one({"id": transfer["from_user_id"]})
        transfers_list.append({
            "id": transfer["id"],
            "from_user_name": from_user["name"] if from_user else "Unknown",
            "amount": transfer["amount"],
            "reason": transfer["reason"],
            "created_at": transfer["created_at"]
        })
    
    return {
        "my_cash_balance": current_user.get("cash_balance", 0.0),
        "managers": managers_list,
        "pending_approvals": transfers_list,
        "recent_transactions_count": len(recent_sales)
    }

# ==================== SALES ROUTES ====================

@api_router.post("/sales", response_model=SaleResponse)
async def create_sale(sale_data: SaleCreate, current_user = Depends(get_current_user)):
    # Generate sale number
    count = await db.sales.count_documents({}) + 1
    sale_number = f"SALE-{count:06d}"
    
    sale_id = str(uuid.uuid4())
    sale_dict = {
        "id": sale_id,
        "sale_number": sale_number,
        "customer_name": sale_data.customer_name,
        "items": [item.dict() for item in sale_data.items],
        "total_amount": sale_data.total_amount,
        "payment_type": sale_data.payment_type,
        "collected_by": current_user["id"],
        "collected_by_name": current_user["name"],
        "status": "settled" if sale_data.payment_type == "cash" else "pending",
        "paid_amount": sale_data.total_amount if sale_data.payment_type == "cash" else 0.0,
        "notes": sale_data.notes,
        "created_at": datetime.utcnow()
    }
    
    await db.sales.insert_one(sale_dict)
    
    # Update cash balance if cash payment
    if sale_data.payment_type == "cash":
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"cash_balance": sale_data.total_amount}}
        )
    
    return SaleResponse(**sale_dict)

@api_router.get("/sales", response_model=List[SaleResponse])
async def get_sales(current_user = Depends(get_current_user)):
    sales = await db.sales.find().sort("created_at", -1).to_list(100)
    return [SaleResponse(**sale) for sale in sales]

@api_router.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(sale_id: str, current_user = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return SaleResponse(**sale)

# ==================== CREDIT ROUTES ====================

@api_router.post("/credit/payment", response_model=CreditPaymentResponse)
async def record_credit_payment(payment_data: CreditPayment, current_user = Depends(get_current_user)):
    # Find the sale
    sale = await db.sales.find_one({"id": payment_data.sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    if sale["payment_type"] != "credit":
        raise HTTPException(status_code=400, detail="Sale is not a credit sale")
    
    # Create payment record
    payment_id = str(uuid.uuid4())
    payment_dict = {
        "id": payment_id,
        "sale_id": payment_data.sale_id,
        "amount": payment_data.amount,
        "collected_by": current_user["id"],
        "collected_by_name": current_user["name"],
        "notes": payment_data.notes,
        "created_at": datetime.utcnow()
    }
    
    await db.credit_payments.insert_one(payment_dict)
    
    # Update sale paid amount
    new_paid_amount = sale["paid_amount"] + payment_data.amount
    new_status = "settled" if new_paid_amount >= sale["total_amount"] else "partial"
    
    await db.sales.update_one(
        {"id": payment_data.sale_id},
        {"$set": {"paid_amount": new_paid_amount, "status": new_status}}
    )
    
    # Update collector's cash balance
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"cash_balance": payment_data.amount}}
    )
    
    return CreditPaymentResponse(**payment_dict)

@api_router.get("/credit/sales", response_model=List[SaleResponse])
async def get_credit_sales(current_user = Depends(get_current_user)):
    sales = await db.sales.find({"payment_type": "credit"}).sort("created_at", -1).to_list(100)
    return [SaleResponse(**sale) for sale in sales]

# ==================== TRANSFER ROUTES ====================

@api_router.post("/transfers", response_model=TransferResponse)
async def create_transfer_request(transfer_data: TransferRequest, current_user = Depends(get_current_user)):
    # Check if sender has enough balance
    if current_user.get("cash_balance", 0.0) < transfer_data.amount:
        raise HTTPException(status_code=400, detail="Insufficient cash balance")
    
    # Get recipient user
    to_user = await db.users.find_one({"id": transfer_data.to_user_id})
    if not to_user:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Create transfer request
    transfer_id = str(uuid.uuid4())
    transfer_dict = {
        "id": transfer_id,
        "from_user_id": current_user["id"],
        "from_user_name": current_user["name"],
        "to_user_id": transfer_data.to_user_id,
        "to_user_name": to_user["name"],
        "amount": transfer_data.amount,
        "reason": transfer_data.reason,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "approved_at": None
    }
    
    await db.transfers.insert_one(transfer_dict)
    
    return TransferResponse(**transfer_dict)

@api_router.get("/transfers", response_model=List[TransferResponse])
async def get_transfers(current_user = Depends(get_current_user)):
    transfers = await db.transfers.find({
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    }).sort("created_at", -1).to_list(100)
    return [TransferResponse(**transfer) for transfer in transfers]

@api_router.post("/transfers/{transfer_id}/approve", response_model=TransferResponse)
async def approve_transfer(transfer_id: str, approval: TransferApproval, current_user = Depends(get_current_user)):
    # Find transfer
    transfer = await db.transfers.find_one({"id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Check if current user is the recipient
    if transfer["to_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only recipient can approve/reject")
    
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail="Transfer already processed")
    
    # Update transfer status
    new_status = approval.action  # "approve" or "reject"
    await db.transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": new_status + "d", "approved_at": datetime.utcnow()}}
    )
    
    # If approved, update balances
    if approval.action == "approve":
        # Decrease sender's balance
        await db.users.update_one(
            {"id": transfer["from_user_id"]},
            {"$inc": {"cash_balance": -transfer["amount"]}}
        )
        
        # Increase recipient's balance
        await db.users.update_one(
            {"id": transfer["to_user_id"]},
            {"$inc": {"cash_balance": transfer["amount"]}}
        )
    
    # Get updated transfer
    updated_transfer = await db.transfers.find_one({"id": transfer_id})
    return TransferResponse(**updated_transfer)

# ==================== PRODUCTION ROUTES ====================

@api_router.post("/production", response_model=ProductionResponse)
async def create_production(production_data: ProductionCreate, current_user = Depends(get_current_user)):
    # Generate production number
    count = await db.production.count_documents({}) + 1
    production_number = f"PROD-{count:06d}"
    
    production_id = str(uuid.uuid4())
    production_dict = {
        "id": production_id,
        "production_number": production_number,
        "product_name": production_data.product_name,
        "quantity": production_data.quantity,
        "unit": production_data.unit,
        "raw_materials_used": production_data.raw_materials_used,
        "workers": production_data.workers,
        "status": "in_progress",
        "created_by": current_user["id"],
        "created_by_name": current_user["name"],
        "notes": production_data.notes,
        "created_at": datetime.utcnow(),
        "completed_at": None
    }
    
    await db.production.insert_one(production_dict)
    
    # Update raw material quantities
    for material in production_data.raw_materials_used:
        await db.raw_materials.update_one(
            {"material_name": material["material_name"]},
            {"$inc": {"quantity": -material["quantity_used"]}}
        )
    
    return ProductionResponse(**production_dict)

@api_router.get("/production", response_model=List[ProductionResponse])
async def get_production(current_user = Depends(get_current_user)):
    production = await db.production.find().sort("created_at", -1).to_list(100)
    return [ProductionResponse(**prod) for prod in production]

@api_router.patch("/production/{production_id}/complete")
async def complete_production(production_id: str, current_user = Depends(get_current_user)):
    production = await db.production.find_one({"id": production_id})
    if not production:
        raise HTTPException(status_code=404, detail="Production not found")
    
    await db.production.update_one(
        {"id": production_id},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    
    return {"message": "Production marked as completed"}

# ==================== RAW MATERIAL ROUTES ====================

@api_router.post("/raw-materials", response_model=RawMaterialResponse)
async def create_raw_material(material_data: RawMaterialCreate, current_user = Depends(get_current_user)):
    material_id = str(uuid.uuid4())
    material_dict = {
        "id": material_id,
        "material_name": material_data.material_name,
        "quantity": material_data.quantity,
        "unit": material_data.unit,
        "unit_price": material_data.unit_price,
        "supplier_name": material_data.supplier_name,
        "added_by": current_user["id"],
        "added_by_name": current_user["name"],
        "notes": material_data.notes,
        "created_at": datetime.utcnow()
    }
    
    # Check if material already exists, update quantity
    existing = await db.raw_materials.find_one({"material_name": material_data.material_name})
    if existing:
        await db.raw_materials.update_one(
            {"material_name": material_data.material_name},
            {"$inc": {"quantity": material_data.quantity}}
        )
        updated = await db.raw_materials.find_one({"material_name": material_data.material_name})
        return RawMaterialResponse(**updated)
    
    await db.raw_materials.insert_one(material_dict)
    return RawMaterialResponse(**material_dict)

@api_router.get("/raw-materials", response_model=List[RawMaterialResponse])
async def get_raw_materials(current_user = Depends(get_current_user)):
    materials = await db.raw_materials.find().sort("material_name", 1).to_list(100)
    return [RawMaterialResponse(**material) for material in materials]

# ==================== USER ROUTES ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user = Depends(get_current_user)):
    users = await db.users.find({"role": "manager"}).to_list(100)
    return [UserResponse(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        cash_balance=user.get("cash_balance", 0.0),
        created_at=user["created_at"]
    ) for user in users]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
