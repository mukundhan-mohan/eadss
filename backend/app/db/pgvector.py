from __future__ import annotations

from sqlalchemy.types import UserDefinedType


class PGVector(UserDefinedType):
    cache_ok = True

    def __init__(self, dim: int):
        self.dim = dim

    def get_col_spec(self, **_kw) -> str:
        return f"vector({self.dim})"

    def bind_processor(self, dialect):
        def process(value):
            if value is None:
                return None
            if isinstance(value, str):
                return value
            return "[" + ",".join(f"{float(x):.8f}" for x in value) + "]"

        return process

    def result_processor(self, dialect, coltype):
        def process(value):
            if value is None or isinstance(value, list):
                return value
            value = value.strip()
            if not value:
                return []
            if value[0] == "[" and value[-1] == "]":
                body = value[1:-1].strip()
                if not body:
                    return []
                return [float(part) for part in body.split(",")]
            return value

        return process
