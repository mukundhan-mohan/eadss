from pydantic import BaseModel

class AdminLoginIn(BaseModel):
    email: str
    password: str

class AdminRegisterIn(BaseModel):
    email: str
    password: str

class AdminMeOut(BaseModel):
    id: str
    email: str
    is_super_admin: bool
