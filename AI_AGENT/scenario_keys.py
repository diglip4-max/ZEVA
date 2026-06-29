from enum import Enum

class ScenarioKey(str, Enum):
    GREETING = "greeting"
    IDENTITY = "identity"
    CAPABILITY = "capability"
    PRESENCE = "presence"
    BOOKING_OPENING = "booking_opening"
    BOOKING_FOLLOWUP = "booking_followup"
    BOOKING_CONFIRMATION = "booking_confirmation"
    BOOKING_SUCCESS = "booking_success"
    BOOKING_FAILED = "booking_failed"
    RESCHEDULE_OPENING = "reschedule_opening"
    RESCHEDULE_CONFIRMATION = "reschedule_confirmation"
    RESCHEDULE_SUCCESS = "reschedule_success"
    RESCHEDULE_FAILED = "reschedule_failed"
    APPOINTMENT_DETAILS = "appointment_details"
    FAQ_TIMINGS = "faq_timings"
    FAQ_SERVICES = "faq_services"
    DOCTOR_DISCOVERY = "doctor_discovery"
    DOCTOR_DISCOVERY_RESULT = "doctor_discovery_result"
    OFF_TOPIC = "off_topic"


SCENARIO_KEYS = [s.value for s in ScenarioKey]


class BehaviorStyle(str, Enum):
    DEFAULT = "default"
    PROFESSIONAL = "professional"
    POLITE = "polite"
    LUXURIOUS = "luxurious"


BEHAVIOR_STYLES = [b.value for b in BehaviorStyle]
DEFAULT_BEHAVIOR_STYLE = BehaviorStyle.DEFAULT.value
