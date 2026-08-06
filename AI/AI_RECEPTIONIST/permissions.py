import os
import logging
import functools
from typing import Optional

import httpx
from dotenv import load_dotenv
from langchain_core.runnables import RunnableConfig

load_dotenv()

logger = logging.getLogger(__name__)

AGENT_URL = os.getenv("NEXT_PUBLIC_BASE_URL")

# ─── Tool → required (module, action) ──────────────────────────────────────

TOOL_PERMISSION_MAP: dict[str, tuple[str, str]] = {
    "get_clinic_services_tool": ("clinic_Appointment", "read"),
    "find_doctors_for_treatment_tool": ("clinic_Appointment", "read"),
    "get_appointments_tool": ("clinic_Appointment", "read"),
    "book_appointment_tool": ("clinic_Appointment", "create"),
    "reschedule_appointment_tool": ("clinic_Appointment", "update"),
    "search_patient_tool": ("clinic_patient_registration", "read"),
    "register_patient_tool": ("clinic_patient_registration", "create"),
    "fetch_billings_tool": ("clinic_invoices", "read"),
    "fetch_packages_tool": ("Clinic_user_package", "read"),
}


# ─── Tool → other tools it HARD-depends on to safely complete its action ───
# A tool listed here cannot be attempted unless every one of its dependencies
# is also present in the allowed-tool set for this turn. This is orthogonal
# to TOOL_PERMISSION_MAP: a tool can be individually permitted (its own
# module/action granted) yet still be functionally unusable because a tool
# it must call first is not granted. Without this map, an agent that has
# reschedule_appointment_tool but not get_appointments_tool has no legal way
# to identify which appointment to reschedule, and (absent explicit
# guidance) may substitute an unrelated bound tool or loop indefinitely.
TOOL_DEPENDENCY_MAP: dict[str, set[str]] = {
    "reschedule_appointment_tool": {"get_appointments_tool"},
    "book_appointment_tool": {
        "get_clinic_services_tool",
        "find_doctors_for_treatment_tool",
        "register_patient_tool",
    },
}


def get_missing_dependencies(tool_name: str, allowed_tool_names: set[str]) -> set[str]:
    """Returns the subset of tool_name's hard dependencies that are NOT in
    allowed_tool_names. An empty set means tool_name's dependencies (if any)
    are fully satisfied and it's safe to attempt standalone."""
    required = TOOL_DEPENDENCY_MAP.get(tool_name, set())
    return required - allowed_tool_names


def get_fully_usable_tool_names(allowed_tool_names: set[str]) -> set[str]:
    """Returns the subset of allowed_tool_names whose hard dependencies (if
    any) are ALSO fully satisfied within allowed_tool_names. A tool that is
    individually permitted but missing a required dependency is excluded:
    it must not be presented to the LLM as a capability it can complete
    this turn, since attempting it would leave it stuck mid-flow with no
    legal tool call to finish the job."""
    return {
        name
        for name in allowed_tool_names
        if not get_missing_dependencies(name, allowed_tool_names)
    }


async def fetch_agent_permissions(agent_id: str, clinic_token: str) -> dict:

    url = f"{AGENT_URL}/api/agent/permissions"
    headers = {"Authorization": f"Bearer {clinic_token}"} if clinic_token else {}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(url, params={"agentId": agent_id}, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        logger.warning(f"[permissions] fetch failed for agent {agent_id}: {e}")
        return {}

    if not payload.get("success") or not isinstance(payload.get("data"), dict):
        logger.warning(f"[permissions] malformed payload for agent {agent_id}")
        return {}

    raw_permissions = payload["data"].get("permissions", [])
    if not isinstance(raw_permissions, list):
        return {}

    by_module = {
        entry["module"]: entry
        for entry in raw_permissions
        if isinstance(entry, dict) and "module" in entry
    }

    return by_module


def _is_action_allowed(permissions: dict, module: str, action: str) -> bool:

    entry = permissions.get(module)
    if not isinstance(entry, dict):
        return False

    actions = entry.get("actions")
    if not isinstance(actions, dict):
        return False

    return bool(actions.get(action)) or bool(actions.get("all"))


async def get_allowed_tool_names(
    agent_id: Optional[str], clinic_token: str
) -> set[str]:

    if not agent_id:
        logger.warning("[permissions] no agentId provided — binding zero tools.")
        return set()

    permissions = await fetch_agent_permissions(agent_id, clinic_token)
    if not permissions:
        return set()

    allowed = {
        tool_name
        for tool_name, (module, action) in TOOL_PERMISSION_MAP.items()
        if _is_action_allowed(permissions, module, action)
    }
    return allowed


def filter_tools_by_permission(all_tools: list, allowed_tool_names: set[str]) -> list:

    return [t for t in all_tools if getattr(t, "name", None) in allowed_tool_names]


def _extract_context_values(config: Optional[RunnableConfig]) -> tuple[str, str]:
    configurable = config.get("configurable", {}) if config else {}

    clinic_token = configurable.get("clinic_token", "")
    agent_id = configurable.get("agent_id", "")

    return clinic_token, agent_id


def require_permission(module: str, action: str):

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            config = kwargs.get("config")
            if config is None:

                for a in reversed(args):
                    if isinstance(a, dict) and "configurable" in a:
                        config = a
                        break

            clinic_token, agent_id = _extract_context_values(config)

            if not agent_id:
                logger.warning(
                    f"[permissions] {func.__name__}: no agentId in context — denying."
                )
                return {
                    "Status": "Forbidden",
                    "Message": (
                        "This action could not be authorized — missing agent "
                        "context. Contact your clinic admin."
                    ),
                }

            configurable = config.get("configurable", {}) if config else {}
            allowed_tool_names = configurable.get("_allowed_tool_names")

            if allowed_tool_names is None:
                # No value set this turn (e.g. tool invoked outside the
                # normal graph flow) — fetch fresh rather than assume denied.
                permissions = await fetch_agent_permissions(agent_id, clinic_token)
                allowed = _is_action_allowed(permissions, module, action)
                allowed_tool_names = set()
            else:
                # tools_node just fetched this immediately before invoking
                # ToolNode — reuse it rather than issuing a third redundant
                # live call in the same turn.
                tool_name = getattr(func, "name", None) or func.__name__
                allowed = tool_name in allowed_tool_names

            if not allowed:
                logger.info(
                    f"[permissions] {func.__name__}: denied "
                    f"(agent={agent_id}, module={module}, action={action})."
                )
                return {
                    "Status": "Forbidden",
                    "Message": (
                        "You don't have permission to perform this action. "
                        "Contact your clinic admin to request access."
                    ),
                }

            # Even when the tool's own module/action is allowed, block it
            # if a hard dependency it needs to complete safely is missing
            # from this turn's allowed set. This is a defense-in-depth
            # backstop behind the prompt-level guidance — it guarantees
            # the tool itself refuses to run standalone even if the LLM
            # somehow calls it anyway (e.g. skipping the discovery step).
            tool_name = getattr(func, "name", None) or func.__name__
            missing_deps = get_missing_dependencies(tool_name, allowed_tool_names)
            if missing_deps:
                logger.info(
                    f"[permissions] {func.__name__}: blocked — missing "
                    f"dependency tool(s) {sorted(missing_deps)} "
                    f"(agent={agent_id})."
                )
                return {
                    "Status": "MissingDependency",
                    "Message": (
                        "This action requires additional permissions that "
                        "aren't currently granted, so it can't be completed "
                        "safely. Contact your clinic admin to request "
                        "access to the missing permission(s)."
                    ),
                    "missingDependencies": sorted(missing_deps),
                }

            return await func(*args, **kwargs)

        return wrapper

    return decorator
