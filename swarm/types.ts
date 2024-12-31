import { ChatCompletionMessage, ChatCompletionMessageToolCall, Function } from 'openai';
import { BaseModel } from 'pydantic';

type AgentFunction = () => string | Agent | Record<string, unknown>;

class Agent extends BaseModel {
    name: string = "Agent";
    model: string = "gpt-4o";
    instructions: string | (() => string) = "You are a helpful agent.";
    functions: AgentFunction[] = [];
    tool_choice: string | null = null;
    parallel_tool_calls: boolean = true;
}

class Response extends BaseModel {
    messages: any[] = [];
    agent: Agent | null = null;
    context_variables: Record<string, unknown> = {};
}

class Result extends BaseModel {
    value: string = "";
    agent: Agent | null = null;
    context_variables: Record<string, unknown> = {};
}

export { Agent, Response, Result, AgentFunction };
