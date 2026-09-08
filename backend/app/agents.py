from langgraph.prebuilt import create_react_agent
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.tools import web_search
from dotenv import load_dotenv
import os

load_dotenv()

# Separate LLM instances with independent API keys to split the rate-limit load
llm_search = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY_1", os.getenv("GROQ_API_KEY")),
)

llm_reader = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY_2", os.getenv("GROQ_API_KEY")),
)

llm_writer = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY_3", os.getenv("GROQ_API_KEY")),
)

llm_critic = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY_4", os.getenv("GROQ_API_KEY")),
)

# 1st agent: Search (Kept as a controlled ReAct agent)
def build_search_agent():
    return create_react_agent(
        model=llm_search,
        tools=[web_search]
    )

# 2nd step: Reader (Converted from an infinite-loop ReAct agent to a deterministic LCEL chain)
reader_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research assistant. Analyze the raw search results and extract deep, structured context relevant to the topic."),
    ("human", """Analyze the following search results about '{topic}' and extract key technical insights, metrics, and details.

Search Results:
{search_results}

Provide a comprehensive contextual breakdown of this data."""),
])

reader_chain = reader_prompt | llm_reader | StrOutputParser()

# writer chain (Uses Key 3)
writer_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research writer. Write clear, structured and insightful reports."),
    ("human", """Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion
- Sources (list all URLs found in the research)

Be detailed, factual and professional."""),
])

writer_chain = writer_prompt | llm_writer | StrOutputParser()

# critic_chain (Uses Key 4)
critic_prompt = ChatPromptTemplate.from_messages([
     ("system", "You are a sharp and constructive research critic. Be honest and specific."),
    ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ...
- ...

One line verdict:
..."""),
])

critic_chain = critic_prompt | llm_critic | StrOutputParser()