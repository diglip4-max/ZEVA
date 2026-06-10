from apt_reschedule import find_latest_appointment
import asyncio


async def main():
    resp=await find_latest_appointment(
    conversation_id="6a214c1f4b60d8e80d546c54",
    clinicToken="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODkwOWIzMGZhYTk4ZjYzZTk3ZTNkMTciLCJyb2xlIjoiY2xpbmljIiwiZW1haWwiOiI0NGR3aXZlZGlzYXJ0aGFrQGdtYWlsLmNvbSIsImlhdCI6MTc4MTA5ODc4OCwiZXhwIjoxNzgxMTg1MTg4fQ.GUtwqI5HtCtwD499ZP8svRYEmMnrN9UCSboYz5izW8w",
)
    print(resp["all_apt"])

if __name__=="__main__":
    asyncio.run(main())