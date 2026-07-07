from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
import os   
load_dotenv()
llm=ChatOpenAI(model_name="gpt-4o-mini")
messages=[]
user_query=input("Enter a message: ")
prompt=""
messages.append(prompt+user_query)
response=llm.invoke(messages)
print(response.content)