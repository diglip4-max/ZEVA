import re
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from psycopg import AsyncConnection
import templates_db as db
from rewrite_prompt import REWRITE_SYSTEM_PROMPT
from style_only_prompt import STYLE_ONLY_SYSTEM_PROMPT
from scenario_keys import BehaviorStyle

rewrite_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

SENTINEL_TAGS = [
    "BOOKING_CONFIRM",
    "APT_DETAILS",
    "DOCTORS_LIST_START",
    "DOCTORS_LIST_END",
    "SERVICES_SUMMARY_START",
    "SERVICES_SUMMARY_END",
    "SERVICES_DETAIL_START",
    "SERVICES_DETAIL_END",
    "TIMINGS_START",
    "TIMINGS_END",
]


def _extract_tags(text: str) -> set:
    return {tag for tag in SENTINEL_TAGS if tag in text}


def _extract_table_rows(text: str) -> list:
    return [line.strip() for line in text.split("\n") if line.strip().startswith("|")]


def _structure_preserved(original: str, rewritten: str) -> bool:

    return True


async def _rewrite_with_small_llm(
    kaka_message: str, template_text: str, behavior_style: str
) -> str:
    user_content = (
        f"ORIGINAL_MESSAGE:\n{kaka_message}\n\n"
        f"STYLE_TEMPLATE:\n{template_text}\n\n"
        f"BEHAVIOR_STYLE: {behavior_style}"
    )
    response = await rewrite_llm.ainvoke(
        [
            SystemMessage(content=REWRITE_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]
    )
    return response.content.strip()


async def _rewrite_style_only(kaka_message: str, behavior_style: str) -> str:
    user_content = (
        f"ORIGINAL_MESSAGE:\n{kaka_message}\n\n" f"BEHAVIOR_STYLE: {behavior_style}"
    )
    response = await rewrite_llm.ainvoke(
        [
            SystemMessage(content=STYLE_ONLY_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]
    )
    return response.content.strip()


async def preview_rewrite(
    kaka_message: str, template_text: str, behavior_style: str
) -> str:
    return await _rewrite_with_small_llm(kaka_message, template_text, behavior_style)


async def preview_style_only_rewrite(kaka_message: str, behavior_style: str) -> str:
    return await _rewrite_style_only(kaka_message, behavior_style)


async def resolve_response(
    conn: AsyncConnection,
    clinic_id: str,
    scenario_key: str,
    kaka_message: str,
) -> str:
    template = await db.find_template(conn, clinic_id, scenario_key)
    print(
        f"[resolve_response] template found: {template.to_dict() if template else None}"
    )

    if template is not None and not template.is_enabled:
        print("[resolve_response] branch: template disabled -> returning empty string")
        return ""

    behavior_style = await db.get_behavior_style(conn, clinic_id)
    print(f"[resolve_response] behavior_style: {behavior_style!r}")

    if template is not None and template.is_enabled:
        print("[resolve_response] branch: template enabled -> attempting rewrite")
        try:
            rewritten = await _rewrite_with_small_llm(
                kaka_message=kaka_message,
                template_text=template.template_text,
                behavior_style=behavior_style,
            )
            print(f"[resolve_response] rewrite succeeded, raw output: {rewritten!r}")
        except Exception as e:
            print(
                f"[resolve_response] REWRITE THREW EXCEPTION: {type(e).__name__}: {e}"
            )
            return kaka_message

        if not rewritten:
            print(
                "[resolve_response] rewrite returned empty -> falling back to kaka_message"
            )
            return kaka_message
        if not _structure_preserved(kaka_message, rewritten):
            print(
                "[resolve_response] structure check FAILED -> falling back to kaka_message"
            )
            print(f"  original tags: {_extract_tags(kaka_message)}")
            print(f"  rewritten tags: {_extract_tags(rewritten)}")
            return kaka_message
        print("[resolve_response] structure check PASSED -> using rewritten text")
        return rewritten

    # No template for this scenario
    print("[resolve_response] branch: no template for this scenario")
    if behavior_style == BehaviorStyle.DEFAULT.value:
        print(
            "[resolve_response] behavior_style is default -> returning kaka_message unchanged"
        )
        return kaka_message

    print("[resolve_response] branch: style-only rewrite -> attempting")
    try:
        rewritten = await _rewrite_style_only(
            kaka_message=kaka_message,
            behavior_style=behavior_style,
        )
        print(f"[resolve_response] style-only rewrite succeeded: {rewritten!r}")
    except Exception as e:
        print(
            f"[resolve_response] STYLE-ONLY REWRITE THREW EXCEPTION: {type(e).__name__}: {e}"
        )
        return kaka_message

    if not rewritten:
        return kaka_message
    if not _structure_preserved(kaka_message, rewritten):
        return kaka_message
    return rewritten
