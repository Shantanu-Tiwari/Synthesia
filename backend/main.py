from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from fastapi.responses import StreamingResponse
import json
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.agents import build_search_agent, build_reader_agent, writer_chain, critic_chain

app = FastAPI(
    title="Synthesia API",
    description="Backend API for Synthesia - Multi-Agent Research System",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_check():
    groq_key = os.getenv("GROQ_API_KEY", "")
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    if groq_key:
        logger.info(f"✅ GROQ_API_KEY loaded (starts with: {groq_key[:8]}...)")
    else:
        logger.error("❌ GROQ_API_KEY is NOT set — agents will fail")
    if tavily_key:
        logger.info(f"✅ TAVILY_API_KEY loaded (starts with: {tavily_key[:8]}...)")
    else:
        logger.error("❌ TAVILY_API_KEY is NOT set — search agent will fail")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    groq_key = os.getenv("GROQ_API_KEY", "")
    tavily_key = os.getenv("TAVILY_API_KEY", "")
    return {
        "status": "ok",
        "groq_key_set": bool(groq_key),
        "groq_key_preview": groq_key[:8] + "..." if groq_key else "NOT SET",
        "tavily_key_set": bool(tavily_key),
    }

class ResearchRequest(BaseModel):
    topic: str

@app.post("/api/research")
async def run_research(req: ResearchRequest):
    """
    Standard synchronous endpoint to run the full research pipeline.
    """
    topic = req.topic
    
    # 1. Search
    search_agent = build_search_agent()
    search_result = search_agent.invoke({
        "messages" : [("user", f"Find recent, reliable and detailed information about: {topic}")]
    })
    search_content = search_result['messages'][-1].content
    
    # 2. Reader
    reader_agent = build_reader_agent()
    reader_result = reader_agent.invoke({
        "messages": [("user",
            f"Based on the following search results about '{topic}', "
            f"pick the most relevant URL and scrape it for deeper content.\n\n"
            f"Search Results:\n{search_content[:800]}"
        )]
    })
    scraped_content = reader_result['messages'][-1].content
    
    # 3. Writer
    research_combined = (
        f"SEARCH RESULTS : \n {search_content} \n\n"
        f"DETAILED SCRAPED CONTENT : \n {scraped_content}"
    )
    report = writer_chain.invoke({
        "topic" : topic,
        "research" : research_combined
    })
    
    # 4. Critic
    feedback = critic_chain.invoke({
        "report": report
    })
    
    return {
        "topic": topic,
        "search_results": search_content,
        "scraped_content": scraped_content,
        "report": report,
        "feedback": feedback
    }

async def stream_research(topic: str):
    """Generator for streaming Server-Sent Events."""
    
    try:
        # Step 1: Search
        yield f"data: {json.dumps({'step': 'search', 'status': 'running'})}\n\n"
        await asyncio.sleep(0.1) # tiny sleep to allow flush
        search_agent = build_search_agent()
        search_result = search_agent.invoke({
            "messages" : [("user", f"Find recent, reliable and detailed information about: {topic}")]
        })
        search_content = search_result['messages'][-1].content
        yield f"data: {json.dumps({'step': 'search', 'status': 'done', 'result': search_content})}\n\n"
        
        # Step 2: Read
        yield f"data: {json.dumps({'step': 'reader', 'status': 'running'})}\n\n"
        await asyncio.sleep(0.1)
        reader_agent = build_reader_agent()
        reader_result = reader_agent.invoke({
            "messages": [("user",
                f"Based on the following search results about '{topic}', "
                f"pick the most relevant URL and scrape it for deeper content.\n\n"
                f"Search Results:\n{search_content[:800]}"
            )]
        })
        scraped_content = reader_result['messages'][-1].content
        yield f"data: {json.dumps({'step': 'reader', 'status': 'done', 'result': scraped_content})}\n\n"
        
        # Step 3: Write
        yield f"data: {json.dumps({'step': 'writer', 'status': 'running'})}\n\n"
        await asyncio.sleep(0.1)
        research_combined = (
            f"SEARCH RESULTS : \n {search_content} \n\n"
            f"DETAILED SCRAPED CONTENT : \n {scraped_content}"
        )
        report = writer_chain.invoke({
            "topic" : topic,
            "research" : research_combined
        })
        yield f"data: {json.dumps({'step': 'writer', 'status': 'done', 'result': report})}\n\n"
        
        # Step 4: Critic
        yield f"data: {json.dumps({'step': 'critic', 'status': 'running'})}\n\n"
        await asyncio.sleep(0.1)
        feedback = critic_chain.invoke({
            "report": report
        })
        yield f"data: {json.dumps({'step': 'critic', 'status': 'done', 'result': feedback})}\n\n"
        
        # Final End
        yield f"data: {json.dumps({'step': 'complete', 'status': 'done'})}\n\n"
        
    except Exception as e:
        yield f"data: {json.dumps({'step': 'error', 'status': 'failed', 'message': str(e)})}\n\n"

@app.get("/api/research/stream")
async def stream_research_endpoint(topic: str):
    return StreamingResponse(stream_research(topic), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
