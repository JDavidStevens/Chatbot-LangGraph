import warnings 
warnings.filterwarnings("ignore", category=UserWarning, module="langchain_tavily")

from typing import TypedDict, Annotated
from langgraph.graph import add_messages, StateGraph, START, END
from langchain_core.messages import AnyMessage, ToolMessage
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_tavily import TavilySearch
from langgraph.checkpoint.sqlite import SqliteSaver
import sqlite3
from langchain_anthropic import ChatAnthropic

load_dotenv()

tavily_search_tool = TavilySearch(max_results=1,safe_search=True,country="united states", topic="finance")

@tool
def add(numbers: list[float]) -> float:
    """
    Add all the numbers in the provided list
    """
    return sum(numbers)

@tool("subtract",
      description="Subtract each number after the first from the first number, from left to right.")
def sub(numbers: list[float]) -> float:
    """Subtract a list of numbers from left to right"""
    if len(numbers) < 2:
        raise ValueError("Provide at least two numbers to subtract")

    result = numbers[0]
    for number in numbers[1:]:
        result -= number
    return result

llm = ChatAnthropic(model="claude-sonnet-4-6")

tools = [tavily_search_tool, add, sub]
llm_with_tools = llm.bind_tools(tools)

tools_by_name = {tool.name: tool for tool in tools}

class ChatState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]

def chatbot(state: ChatState):
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": response}

def should_continue(state: ChatState): 
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "invoke tools"
    return "end"

def tool_node(state:ChatState):
    result = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        tool_output = tool.invoke(tool_call["args"])
        result.append(ToolMessage(content=tool_output,
        tool_call_id=tool_call["id"]))
    return {"messages": result}

graph_builder = StateGraph(ChatState)

graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("tool_node", tool_node)

graph_builder.add_edge(START, "chatbot")
graph_builder.add_conditional_edges(
    "chatbot",
    should_continue,
     {
        "invoke tools": "tool_node",
        "end": END,
    }
)

graph_builder.add_edge("tool_node", "chatbot")

#SQLiteSaver Checkpointer
connection = sqlite3.connect("chatbot.squlite", check_same_thread=False)
checkpointer = SqliteSaver(connection)
graph = graph_builder.compile(checkpointer=checkpointer)


