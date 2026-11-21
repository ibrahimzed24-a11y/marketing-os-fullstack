"""
Helm Coordinator Agent runner powered by Google Antigravity Python SDK
Connected to local Ollama engine & n8n pipeline workflow execution.
"""
import asyncio
import os
import sys
from google.antigravity import (
    Agent,
    LocalOpenAIAgentConfig,
    CapabilitiesConfig,
)

async def main():
    # Use environment or fallback to system's active Ollama setup
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    instructions = os.getenv(
        "COORDINATOR_INSTRUCTIONS",
        "Execute helm pipelines from /uploads harness."
    )

    print(f"🚀 Initializing helm_coordinator with model '{model}' at '{base_url}'...")
    config = LocalOpenAIAgentConfig(
        model=model,
        base_url=base_url,
        system_instructions=instructions,
        capabilities=CapabilitiesConfig(),
    )

    prompt = sys.argv[1] if len(sys.argv) > 1 else "Review pending tasks in the harness and plan execution pipeline."
    async with Agent(config) as agent:
        print(f"📋 Dispatching to helm_coordinator: {prompt}\n")
        response = await agent.chat(prompt)
        async for token in response:
            sys.stdout.write(token)
            sys.stdout.flush()
        print("\n\n✅ helm_coordinator pipeline execution complete.")

if __name__ == "__main__":
    asyncio.run(main())
