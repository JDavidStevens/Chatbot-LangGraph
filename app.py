import streamlit as sl
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from graph_backend import graph, config
# import uuid

# Page Config
sl.set_page_config(
    page_title="LangGraph Chatbot",
    page_icon="🦜",
    layout="centered"
)

# if "thread_id" not in sl.session_state:
#     sl.session_state["thread_id"] = uuid.uuid4().hex

# chat_config = {
#     "configurable": {"thread_id": sl.session_state["thread_id"]}
# }

sl.title("🦜 LangGraph Chatbot")
sl.caption("A Streamlit UI on top of a LangGraph chatbot with tools and memory")

# Session State (UI Chat History)
if "messages" not in sl.session_state:
    sl.session_state.messages = []

# Display previous messages
for msg in sl.session_state.messages:
    with sl.chat_message(msg["role"]):
        sl.markdown(msg["content"])

# Chat Input
user_input = sl.chat_input("Ask me anything...")

if user_input:
    # User message
    sl.session_state.messages.append({"role": "user", "content": user_input} )
    
    with sl.chat_message("user"):
        sl.markdown(user_input)

    # Assistant response (streaming using a placeholder)
    with sl.chat_message("assistant"):
        # Create an empty space in the UI
        placeholder = sl.empty()
        full_response = ""

        # Stream output from LangGraph
        for message_chunk, metadata in graph.stream(
            {"messages": [HumanMessage(content=user_input)]},
            config=config,
            stream_mode="messages"
         ):
            if isinstance(message_chunk, (AIMessage, AIMessageChunk)):
                content = message_chunk.content
                if isinstance(content, str):
                    text = content
                elif isinstance(content, list):
                    text = "".join(
                        block if isinstance(block, str)
                        else block.get("text", "")
                        for block in content
                        if isinstance(block, str)
                        or (isinstance(block, dict) and block.get("type") == "text")
                    )
                else:
                    text = ""

                if text:
                    full_response += text
                    placeholder.markdown(full_response)

    # Save assistant message to UI history
    sl.session_state.messages.append({"role": "assistant", "content": full_response})
