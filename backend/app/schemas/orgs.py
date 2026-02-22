from pydantic import BaseModel

class OrgRegisterIn(BaseModel):
    org_id: str
    name: str

class OrgRegisterOut(BaseModel):
    org_id: str
    name: str
    api_key: str  # plaintext once