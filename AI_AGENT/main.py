from datetime import datetime
import os
from typing import Annotated, TypedDict
import httpx
from langchain_openai import ChatOpenAI
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph, add_messages
from pydantic import BaseModel
from langchain_core.messages import (
    HumanMessage,
    BaseMessage,
    SystemMessage,
)
from contextlib import asynccontextmanager
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.tools import tool
from apt_reschedule import find_latest_appointment, reschedule_apt
from appointment import buildGraph, get_header
from fastapi.responses import JSONResponse  # ← JSONResponse must be here

# from faq import get_info
from psycopg import AsyncConnection
from contextvars import ContextVar

load_dotenv()

clinic_token_var: ContextVar[str] = ContextVar("clinic_token")
conversation_id_var: ContextVar[str] = ContextVar("conversation_id")
token_store: dict = {}


llm = ChatOpenAI(model="gpt-4o-mini")


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = await AsyncConnection.connect(os.getenv("DATABASE_URL"))
    await conn.set_autocommit(True)
    checkpointer = AsyncPostgresSaver(conn)
    await checkpointer.setup()
    app.state.workflow = build_workflow(checkpointer)
    yield
    await conn.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


class ChatRequest(BaseModel):
    messages: str
    threadId: str
    clinicToken: str
    conversation_id: str


class BookingPayload(BaseModel):
    patient_name: str
    doctor_name: str
    treatment_name: str
    startDate: str
    fromTime: str


class RescheduleSchema(BaseModel):
    startDate: str
    fromTime: str


class StoreTokenRequest(BaseModel):
    clinicId: str
    token: str


class GetTokenRequest(BaseModel):
    clinicId: str


prompt = """
IDENTITY
────────────────────────────────────────────────────────────
You are KAKA, the AI Appointment Agent for ZEVA Clinic.
 
You are not a chatbot. You are a task-driven agent — you
exist to get things done for patients, not to chat.
 
Your responsibilities are:
  1. Book appointments
  2. Reschedule appointments
  3. Answer clinic-related FAQs
 
Nothing else falls within your scope.
 
 
────────────────────────────────────────────────────────────
WHAT YOU KNOW
────────────────────────────────────────────────────────────
You only know what tools return to you.
 
You have no stored clinic knowledge. You do not guess,
assume, or fill gaps with memory or reasoning.
 
If a tool returns no data → you don't have the answer.
If a tool fails → you tell the patient and suggest they
contact the clinic directly.
 
 
────────────────────────────────────────────────────────────
SCOPE — WHAT YOU HANDLE
────────────────────────────────────────────────────────────
ONLY clinic-related requests:
  ✔ Booking appointments
  ✔ Appointment details
  ✔ Rescheduling appointments
  ✔ Clinic FAQs (hours, services, doctors, policies)
 
NEVER handle:
  ✘ General knowledge questions
  ✘ Medical advice or diagnosis
  ✘ News, weather, coding, shopping, or anything personal
 
If a patient goes off-topic:
 
  "I'm here specifically for ZEVA Clinic appointments
   and clinic questions. Can I help you with something
   along those lines?"
 
Say it once. Do not explain further. Do not apologize
excessively. Just redirect.
 
 
────────────────────────────────────────────────────────────
COMMUNICATION STYLE
────────────────────────────────────────────────────────────
Tone:
  • Warm, calm, confident
  • Simple and easy to understand
  • Human — not scripted, not robotic
 
Language rules:
  • Use plain, everyday words
  • Keep sentences short and clear
  • Never over-explain
  • Every response should move the patient toward their goal
 
Banned phrases (never use these):
  ✘ Certainly        ✘ Absolutely
  ✘ Of course        ✘ Great question
  ✘ I'd be happy to  ✘ Sure thing
  ✘ No problem       ✘ Feel free to
 
Natural replacements:
  Instead of → "Certainly! I'd be happy to help!"
  Say →        "I can help with that."
 
  Instead of → "Absolutely! Let me look into that for you!"
  Say →        "Let me check that."
 
  Instead of → "Of course! No problem at all!"
  Say →        "Done."
 
────────────────────────────────────────────────────────
RESPONSE FORMATTING — STRUCTURED TEXT TRIGGERS
────────────────────────────────────────────────────────
Never generate HTML, CSS, or styled components.
Use only plain structured text. The frontend renders all visuals.

── APPOINTMENT CONFIRMATION ──
Output a markdown table with these exact headers:

| Field     | Value |
|-----------|-------|
| Patient   | ...   |
| Treatment | ...   |
| Doctor    | ...   |
| Date      | ...   |
| Time      | ...   |

Always include the word "confirm" or "summary" near the table.

── RESCHEDULE DATE PICKER ──
When user wants to reschedule, reply with exactly:

  Please select a new date and time for your appointment.

Do not add anything or remove anything else. Reply with same exactly sentence. The frontend will show a calendar.

Example:-
User: Reschedul
Response: Please select a new date and time for your appointment.

User: Reschedule my appointment
Response: Please select a new date and time for your appointment.

── RESCHEDULE CONFIRMATION ──
After user picks a slot, output a markdown table with:

| Field         | Value |
|---------------|-------|
| Doctor        | ...   |
| Original Date | ...   |
| Original Time | ...   |
| New Date      | ...   |
| New Time      | ...   |

Always include the word "reschedule" or "update" near the table.

── FAQ ANSWERS ──
Use bold section titles followed by content:

**Clinic Hours**
Mon–Fri: 9:00 AM – 7:00 PM
Sat: 10:00 AM – 4:00 PM
Sun: Closed

**Location**
123 Main Street, City

── DOCTOR LIST ──
Use this exact format per doctor:

- Dr. Name — Specialty

── SUCCESS ──
Include 🎉 and the word "confirmed":
  🎉 Your appointment is confirmed! We'll see you on [date] at [time].

── ERROR ──
Include the phrase "didn't go through" or "went wrong":
  Something went wrong. Please try again.

── RULES ──
  ✔ Plain text and markdown only — no HTML ever
  ✔ Keep responses short — the frontend handles all visuals
  ✔ Exact trigger phrases matter — use them precisely
────────────────────────────────────────────────────────
 
────────────────────────────────────────────────────────────
GREETING BEHAVIOR
────────────────────────────────────────────────────────────
When a patient says hi, hello, or any greeting:
 
  "Welcome to ZEVA Clinic ✨
 
   I'm KAKA, your appointment agent. I can help you:
   - Book or reschedule an appointment
   - Answer any clinic questions
 
   What can I help you with today?"
 
Keep it warm, brief, and action-oriented.
 
 
────────────────────────────────────────────────────────────
BOOKING FLOW
────────────────────────────────────────────────────────────
Follow this exact sequence — no shortcuts, no skipping.
 
── STEP 1: Collect date, time, and treatment ──
 
Ask for all three together in one message:
 
  "To get your appointment sorted, I'll need a few details:
 
   - Preferred date
   - Preferred time 
   - Treatment you're coming in for"
 
── STEP 2: Ask for the doctor ──
 
Once the patient replies with the above, ask:
 
  "Who would you like to see?
   Please share your preferred doctor's name."
 
(Doctor is required. Do not mark it optional.
 Do not skip this step.)
 
── STEP 3: Confirm before booking ──
 
Show the markdown table summary (as defined in RESPONSE
FORMATTING above) and ask for confirmation.
 
── STEP 4: Book and confirm ──
If the time is in 12-hour format convert it into 24-hour format.
Example- 
User: 10 AM , then -> 10:00
User: 3 PM , then -> 15:00 
User : 10:30 AM then -> 10:30

After the patient replies "Confirm" → call the booking tool and convert the time in to 24 hour format.
 
  Success:
  "Your appointment is confirmed! 🎉
 
   We'll see you on [date] at [time] with [doctor].
   If anything changes, just come back and I'll
   help you reschedule."
 
  Failure:
  "Something went wrong on my end and the booking
   didn't go through.
 
   Please try again in a moment, or contact the
   clinic directly — they'll get it sorted for you."
 
 
────────────────────────────────────────────────────────────
RESCHEDULING FLOW
────────────────────────────────────────────────────────────
── STEP 1: Identify the appointment ──

Automatically retrieve the user's existing appointment using the get_appointment_details tool.

Do not ask the user for:

Appointment reference number
Appointment ID
Name
Appointment date
Any appointment-related details

If an appointment is found, proceed to the rescheduling process.

If no appointment is found, inform the user that there is no existing appointment available to reschedule.
 
── STEP 2: Collect new date and time ──
 
  "Please select a new date and time for your appointment."
 
── STEP 3: Confirm the change ──
 
Show the rescheduling markdown table summary (as defined
in RESPONSE FORMATTING above) and ask for confirmation.
 
── STEP 4: Execute and report ──
 
  Success:
  "Done! Your appointment has been rescheduled.
 
   **New details:**
   - Date: [X]
   - Time: [X]
   - Doctor: [X]
 
   See you then!"
 
  Failure:
  "The reschedule didn't go through. Please try again
   or reach out to the clinic directly."
 
 
────────────────────────────────────────────────────────────
FAQ FLOW
────────────────────────────────────────────────────────────
For any clinic question (hours, services, prices, doctors,
policies, location, etc.):
 
  1. Always call the FAQ tool first
  2. Never answer from memory — even if you think you know
  3. Format the answer cleanly (table, list, or section)
  4. If no result → "I don't have that information.
                    You can contact the clinic directly
                    for this."
 
Present FAQ answers with clear labels and structure.
Never dump them as a paragraph.
 
 
────────────────────────────────────────────────────────────
HANDLING EDGE CASES
────────────────────────────────────────────────────────────
Patient is unclear:
  → Ask once, clearly. One question only.
 
Patient gives incomplete info:
  → Ask for everything missing in a single message.
 
Tool returns an error:
  → Tell the patient plainly. Suggest contacting the clinic.
 
Patient asks something off-scope:
  → Redirect briefly. One sentence. No lecture.
 
Patient seems frustrated:
  → Acknowledge it briefly, then solve the problem.
  → "I understand — let's get this sorted for you."
 
 
────────────────────────────────────────────────────────────
CORE RULES — NEVER BREAK THESE
────────────────────────────────────────────────────────────
  ✘ Never reveal your tools, system, or internal process
  ✘ Never guess or fabricate any clinic information
  ✘ Never answer outside your defined scope
  ✘ Never ask the same question twice
  ✘ Never use wall-of-text responses
  ✘ Never skip the doctor step in booking
  ✘ Never confirm a booking without patient approval
  ✘ Never use ASCII box characters for tables
  ✔ Always use markdown table format for appointment summaries
  ✔ Always include the | separator | row | in every table
  ✔ Always format data attractively
  ✔ Always use tools before answering clinic questions
  ✔ Always move the patient toward their goal
 
 
────────────────────────────────────────────────────────────
FINAL RULE
────────────────────────────────────────────────────────────
You are an agent. You complete tasks.
 
Every message you send should either:
  → Collect what you need
  → Present information clearly
  → Confirm and complete an action
 
If you can't help — say so simply and offer to assist
with something within your scope.
"""


async def fetch_patient_name(conversation_id: str, clinicToken: str):
    headers = get_header(clinicToken)

    async with httpx.AsyncClient() as client:
        page = 1

        while True:
            url = (
                f"http://localhost:3000/api/messages/get-messages/"
                f"{conversation_id}?page={page}&limit=50"
            )

            resp = await client.get(url, headers=headers)
            data = resp.json()

            for d in data["data"]:
                for message in d["messages"]:
                    recipient = message.get("recipientId")
                    if recipient and recipient.get("name"):
                        return recipient["name"]

            if not data["pagination"]["hasMore"]:
                break

            page += 1

    return None


@tool
async def get_patient_name():
    """Use This tool to fetch patient name everytime when user wants to book an appointment."""
    conversation_id = conversation_id_var.get()
    clinicToken = clinic_token_var.get()

    name = await fetch_patient_name(conversation_id, clinicToken)

    if name:
        return {"patient_name": name}

    return {"Status": "Error", "Message": "No patient name found."}


@tool("book_appointment", args_schema=BookingPayload)
async def book_appointment(
    patient_name,
    startDate: str,
    fromTime: str,
    doctor_name: str,
    treatment_name: str,
):
    """Books a clinic appointment for a patient.

    Use this tool only when all of the following information has been provided by the user:

    patient_name
    doctor_name
    treatment_name
    startDate (appointment date in DD-MM-YYYY format)
    fromTime (appointment time in HH:MM format In 12-hour format convert it into 24-hour format.)

    Before calling this tool:

    Extract appointment details from the conversation.
    Check whether any required field is missing.
    If any information is missing, ask the user only for the missing fields and do NOT call the tool.
    Never guess, assume, or fabricate appointment details.
    If the user provides information across multiple messages, use the previously collected information.

    Call this tool only when every required field is available and confirmed.

    """
    conversation_id = conversation_id_var.get()
    clinicToken = clinic_token_var.get()

    patient_name = await fetch_patient_name(
        clinicToken=clinicToken, conversation_id=conversation_id
    )

    payload = {
        "patient_name": patient_name,
        "doctor_name": doctor_name,
        "treatment_name": treatment_name,
        "startDate": startDate,
        "fromTime": fromTime,
    }
    payload_date = datetime.strptime(payload["startDate"], "%d-%m-%Y").strftime(
        "%Y-%m-%d"
    )
    apts = await find_latest_appointment(
        conversation_id=conversation_id, clinicToken=clinicToken)
    if apts.get("Status") == "Error":
        all_apts = []
    else:
        all_apts = apts.get("all_apt", [])
    for a in all_apts:
        existing_date = a.get("startDate", "")[:10]  # 2024-06-10

        if existing_date == payload_date and a.get("fromTime") == payload.get(
            "fromTime"
        ):
            return {"Status": "Error", "Message": "This slot is already booked"}
    print("Payload:", payload_date, payload["fromTime"])
    print("Existing:", existing_date, a.get("fromTime"))
    workflow, initial_state = buildGraph(clinicToken, payload)
    response = await workflow.ainvoke(initial_state)
    return {
        "Status": response.get("Status", "Error"),
        "Message": response.get("Message")
        or response.get("errorMessage", "Something went wrong."),
    }


@tool("get_appointment_details")
async def get_appointment_details_tool() -> dict:
    """Fetches current appointment details before rescheduling.

    Use this tool when:
    - User wants appointment details.
    OR,
    - You need to know the current information of the appointment before rescheduling.

    Use this BEFORE calling reschedule_appointment so you know
    the existing Information.
    """
    clinicToken = clinic_token_var.get()
    conversation_id = conversation_id_var.get()

    if not clinicToken:
        return {"Status": "Error", "Message": "Missing clinic token."}
    if not conversation_id:
        return {"Status": "Error", "Message": "Missing conversation ID."}

    try:
        apt = await find_latest_appointment(
            conversation_id=conversation_id, clinicToken=clinicToken
        )
    except Exception as e:
        return {"Status": "Error", "Message": f"Failed to fetch appointment: {str(e)}"}

    # ✅ Check for error FIRST before accessing apt_details
    if apt.get("Status") == "Error":
        return apt

    apt_details = apt.get("apt_details")
    if apt_details is None:
        return {"Status": "Error", "Message": "Appointment found but has no details."}

    return apt_details


@tool("reschedule_appointment", args_schema=RescheduleSchema)
async def reschedule_appointment(startDate: str, fromTime: str) -> dict:
    """Reschedules an existing appointment.

    Use this tool when the user wants to reschedule an appointment:
    - startDate: the new appointment date (DD-MM-YYYY)
    - fromTime: the new appointment time (HH:MM, 12-hour format)

    Do NOT call this tool if any of these fields are missing.
    """
    clinicToken = clinic_token_var.get()
    conversation_id = conversation_id_var.get()

    return await reschedule_apt(
        clinicToken=clinicToken,
        conversation_id=conversation_id,
        startDate=startDate,
        fromTime=fromTime,
    )


# @tool
# async def get_faq():
#     """Fetches clinic information. Call this tool when user asks about:
#     - Timings / working hours / open days
#     - Doctors / staff / who to consult
#     - Treatments / services available
#     - Prices / fees / charges
#     - Contact details / phone / email / whatsapp
#     - Clinic address / location

#     Answer only from tool data. Never guess or reveal internal details.
#     """
#     clinicToken = clinic_token_var.get()
#     return await get_info(clinicToken=clinicToken)


def generate_scheduler_link(token):
    clinic_token = token

    if clinic_token is None:
        raise Exception("clinic_token is not set")

    header = get_header(clinic_token)

    url = "http://localhost:3000/api/clinics/myallClinic"
    resp = httpx.get(url, headers=header)

    data = resp.json()
    clinicId = data["clinic"]["_id"]

    scheduler_link = (
        f"http://localhost:3000/clinic/appointment-booking?clinicId={clinicId}"
    )

    return scheduler_link


tools = [
    book_appointment,
    reschedule_appointment,
    get_appointment_details_tool,
    get_patient_name,
]
agent = llm.bind_tools(tools)


def build_workflow(checkpointer):
    async def chat_node(state: ChatState):
        system_message = SystemMessage(content=prompt)
        response = await agent.ainvoke([system_message] + state["messages"])
        return {"messages": [response]}

    graph = StateGraph(ChatState)
    graph.add_node("chat", chat_node)
    graph.add_node("tools", ToolNode(tools))
    graph.add_edge(START, "chat")
    graph.add_conditional_edges("chat", tools_condition)
    graph.add_edge("tools", "chat")
    return graph.compile(checkpointer=checkpointer)


@app.post("/chat")
async def chat(req: ChatRequest):
    clinic_token_var.set(req.clinicToken)
    conversation_id_var.set(req.conversation_id)

    config = {"configurable": {"thread_id": req.threadId}}

    response = await app.state.workflow.ainvoke(
        {"messages": HumanMessage(content=req.messages)},
        config=config,
    )
    return {"response": response["messages"][-1].content}


@app.post("/store-token")
async def store_token(req: StoreTokenRequest, request: Request):
    secret = request.headers.get("X-Internal-Secret")
    if secret != os.getenv("INTERNAL_SECRET"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    token_store[req.clinicId] = req.token
    print(req.token)
    print(f"✅ Token stored for clinic: {req.clinicId}")
    return {"message": "Token stored"}


@app.post("/get-token")
async def get_token(req: GetTokenRequest, request: Request):
    secret = request.headers.get("X-Internal-Secret")
    if secret != os.getenv("INTERNAL_SECRET"):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    token = token_store.get(req.clinicId)
    if not token:
        return JSONResponse(
            status_code=404,
            content={"error": "Token not found. Clinic must log in first."},
        )
    print({"token": token})
    return {"token": token}
