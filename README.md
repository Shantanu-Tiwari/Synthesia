# Synthesia: Autonomous Research Synthesis

**Authored by Shantanu Tiwari**

Synthesia is a production-grade, multi-agent AI system designed to autonomously aggregate, analyze, and synthesize complex research topics into perfectly structured markdown reports.

## Architecture

This project is built using a modern full-stack architecture separated into distinct services:

1. **Frontend (Next.js & React)**
   - Minimalist, monochrome design system (avoiding "AI-generated" aesthetics).
   - Real-time Server-Sent Events (SSE) streaming to track agent progress.
   - Tailwind CSS for responsive styling.
2. **Backend (FastAPI)**
   - High-performance asynchronous API.
   - LangChain integration for agentic workflows (Search Agent, Reader Agent, Writer Chain, Critic Chain).
   - Robust logging and error handling.
3. **DevOps**
   - Fully containerized using Docker and Docker Compose.
   - Automated CI/CD pipeline via GitHub Actions.
   - Comprehensive unit testing with Pytest.

## Multi-Agent Flow

1. **Search Agent**: Navigates the web to find the most recent and reliable information on a given topic using the Tavily API.
2. **Reader Agent**: Scrapes and extracts deep content from the most relevant sources found.
3. **Writer Chain**: Synthesizes the raw data into a structured markdown report (Introduction, Findings, Conclusion, Sources).
4. **Critic Chain**: Reviews the generated report, scores it, and provides constructive feedback.

## Getting Started

### Prerequisites

- Docker & Docker Compose
- API Keys for OpenAI and Tavily

### Installation

1. Clone the repository.
2. Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   TAVILY_API_KEY=your_tavily_api_key
   ```
3. Run the stack using Docker Compose:
   ```bash
   docker-compose up --build
   ```
4. Access the web interface at `http://localhost:3000`.

## Testing

To run the backend tests:
```bash
cd backend
pip install -r requirements.txt
pytest
```
