from collections.abc import Iterator

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage

from graph_backend import graph

app = FastAPI()


class ChatRequest(BaseModel):
    message: str
    thread_id: str


def message_text(content: object) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        return "".join(
            block if isinstance(block, str) else block.get("text", "")
            for block in content
            if isinstance(block, str)
            or (isinstance(block, dict) and block.get("type") == "text")
        )

    return ""


@app.post("/api/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    config = {"configurable": {"thread_id": request.thread_id}}

    def tokens() -> Iterator[str]:
        for chunk, _metadata in graph.stream(
            {"messages": [HumanMessage(content=request.message)]},
            config=config,
            stream_mode="messages",
        ):
            if isinstance(chunk, (AIMessage, AIMessageChunk)):
                text = message_text(chunk.content)
                if text:
                    yield text

    return StreamingResponse(tokens(), media_type="text/plain; charset=utf-8")