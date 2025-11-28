from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        owner = getattr(obj, "user", None)
        return owner == request.user or request.user.is_staff


class HasRole(BasePermission):
    required_roles: list[str] = []

    def has_permission(self, request, view) -> bool:
        # Allow views to specify required roles via attribute on the view
        view_required_roles = getattr(view, "required_roles", None)
        required_roles = view_required_roles if view_required_roles is not None else self.required_roles
        if not required_roles:
            return True
        user_roles = set(
            request.user.user_roles.select_related("role").values_list("role__name", flat=True)
        )
        return any(role in user_roles for role in required_roles) or request.user.is_staff

