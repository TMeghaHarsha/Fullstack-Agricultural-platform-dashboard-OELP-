from __future__ import annotations

import os
import uuid
from typing import Any


def asset_upload_to(instance: Any, filename: str) -> str:
    name, ext = os.path.splitext(filename)
    ext = ext or ".bin"
    model_name = instance.__class__.__name__.lower()
    user_id = getattr(getattr(instance, "user", None), "pk", None)
    user_part = str(user_id) if user_id else "unknown_user"
    object_id = getattr(instance, "pk", None)
    object_part = str(object_id) if object_id else "temp"
    unique = uuid.uuid4().hex
    return f"assets/{model_name}/{user_part}/{object_part}/{unique}{ext}"

