import { OpenAI } from 'openai';
import { functionToJson, debugPrint, mergeChunk } from './util';
import { Agent, AgentFunction, ChatCompletionMessage, ChatCompletionMessageToolCall, Function, Response, Result } from './types';

const __CTX_VARS_NAME__ = "context_variables";

class Swarm {
    client: OpenAI;

    constructor(client?: OpenAI) {
        this.client = client || new OpenAI();
    }

    async getChatCompletion(
        agent: Agent,
        history: ChatCompletionMessage[],
        contextVariables: Record<string, any>,
        modelOverride: string | null,
        stream: boolean,
        debug: boolean
    ): Promise<ChatCompletionMessage> {
        contextVariables = { ...contextVariables };
        const instructions = typeof agent.instructions === 'function'
            ? agent.instructions(contextVariables)
            : agent.instructions;
        const messages = [{ role: 'system', content: instructions }, ...history];
        debugPrint(debug, "Getting chat completion for...:", messages);

        const tools = agent.functions.map(functionToJson);
        // hide contextVariables from model
        for (const tool of tools) {
            const params = tool.function.parameters;
            delete params.properties[__CTX_VARS_NAME__];
            const requiredIndex = params.required.indexOf(__CTX_VARS_NAME__);
            if (requiredIndex !== -1) {
                params.required.splice(requiredIndex, 1);
            }
        }

        const createParams: any = {
            model: modelOverride || agent.model,
            messages: messages,
            tools: tools.length ? tools : undefined,
            tool_choice: agent.toolChoice,
            stream: stream,
        };

        if (tools.length) {
            createParams.parallel_tool_calls = agent.parallelToolCalls;
        }

        return this.client.chat.completions.create(createParams);
    }

    handleFunctionResult(result: any, debug: boolean): Result {
        if (result instanceof Result) {
            return result;
        } else if (result instanceof Agent) {
            return new Result({
                value: JSON.stringify({ assistant: result.name }),
                agent: result,
            });
        } else {
            try {
                return new Result({ value: String(result) });
            } catch (e) {
                const errorMessage = `Failed to cast response to string: ${result}. Make sure agent functions return a string or Result object. Error: ${String(e)}`;
                debugPrint(debug, errorMessage);
                throw new TypeError(errorMessage);
            }
        }
    }

    handleToolCalls(
        toolCalls: ChatCompletionMessageToolCall[],
        functions: AgentFunction[],
        contextVariables: Record<string, any>,
        debug: boolean
    ): Response {
        const functionMap = new Map(functions.map(f => [f.name, f]));
        const partialResponse = new Response({
            messages: [],
            agent: null,
            contextVariables: {},
        });

        for (const toolCall of toolCalls) {
            const name = toolCall.function.name;
            // handle missing tool case, skip to next tool
            if (!functionMap.has(name)) {
                debugPrint(debug, `Tool ${name} not found in function map.`);
                partialResponse.messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    tool_name: name,
                    content: `Error: Tool ${name} not found.`,
                });
                continue;
            }
            const args = JSON.parse(toolCall.function.arguments);
            debugPrint(debug, `Processing tool call: ${name} with arguments ${args}`);

            const func = functionMap.get(name)!;
            // pass contextVariables to agent functions
            if (__CTX_VARS_NAME__ in func) {
                args[__CTX_VARS_NAME__] = contextVariables;
            }
            const rawResult = func(args);

            const result: Result = this.handleFunctionResult(rawResult, debug);
            partialResponse.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                tool_name: name,
                content: result.value,
            });
            Object.assign(partialResponse.contextVariables, result.contextVariables);
            if (result.agent) {
                partialResponse.agent = result.agent;
            }
        }

        return partialResponse;
    }

    async *runAndStream(
        agent: Agent,
        messages: ChatCompletionMessage[],
        contextVariables: Record<string, any> = {},
        modelOverride: string | null = null,
        debug: boolean = false,
        maxTurns: number = Infinity,
        executeTools: boolean = true
    ): AsyncGenerator<any, void, unknown> {
        let activeAgent = agent;
        contextVariables = { ...contextVariables };
        const history = [...messages];
        const initLen = messages.length;

        while (history.length - initLen < maxTurns) {
            const message: any = {
                content: "",
                sender: agent.name,
                role: "assistant",
                function_call: null,
                tool_calls: [],
            };

            // get completion with current history, agent
            const completion = await this.getChatCompletion(
                agent,
                history,
                contextVariables,
                modelOverride,
                true,
                debug
            );

            yield { delim: "start" };
            for await (const chunk of completion) {
                const delta = JSON.parse(chunk.choices[0].delta.json());
                if (delta.role === "assistant") {
                    delta.sender = activeAgent.name;
                }
                yield delta;
                delete delta.role;
                delete delta.sender;
                mergeChunk(message, delta);
            }
            yield { delim: "end" };

            if (!message.tool_calls.length) {
                message.tool_calls = null;
            }
            debugPrint(debug, "Received completion:", message);
            history.push(message);

            if (!message.tool_calls || !executeTools) {
                debugPrint(debug, "Ending turn.");
                break;
            }

            // convert tool_calls to objects
            const toolCalls = message.tool_calls.map((toolCall: any) => {
                const func = new Function({
                    arguments: toolCall.function.arguments,
                    name: toolCall.function.name,
                });
                return new ChatCompletionMessageToolCall({
                    id: toolCall.id,
                    function: func,
                    type: toolCall.type,
                });
            });

            // handle function calls, updating contextVariables, and switching agents
            const partialResponse = this.handleToolCalls(
                toolCalls,
                activeAgent.functions,
                contextVariables,
                debug
            );
            history.push(...partialResponse.messages);
            Object.assign(contextVariables, partialResponse.contextVariables);
            if (partialResponse.agent) {
                activeAgent = partialResponse.agent;
            }
        }

        yield {
            response: new Response({
                messages: history.slice(initLen),
                agent: activeAgent,
                contextVariables: contextVariables,
            }),
        };
    }

    async run(
        agent: Agent,
        messages: ChatCompletionMessage[],
        contextVariables: Record<string, any> = {},
        modelOverride: string | null = null,
        stream: boolean = false,
        debug: boolean = false,
        maxTurns: number = Infinity,
        executeTools: boolean = true
    ): Promise<Response | AsyncGenerator<any, void, unknown>> {
        if (stream) {
            return this.runAndStream(
                agent,
                messages,
                contextVariables,
                modelOverride,
                debug,
                maxTurns,
                executeTools
            );
        }
        let activeAgent = agent;
        contextVariables = { ...contextVariables };
        const history = [...messages];
        const initLen = messages.length;

        while (history.length - initLen < maxTurns && activeAgent) {
            // get completion with current history, agent
            const completion = await this.getChatCompletion(
                activeAgent,
                history,
                contextVariables,
                modelOverride,
                stream,
                debug
            );
            const message = completion.choices[0].message;
            debugPrint(debug, "Received completion:", message);
            message.sender = activeAgent.name;
            history.push(JSON.parse(message.model_dump_json()));

            if (!message.tool_calls || !executeTools) {
                debugPrint(debug, "Ending turn.");
                break;
            }

            // handle function calls, updating contextVariables, and switching agents
            const partialResponse = this.handleToolCalls(
                message.tool_calls,
                activeAgent.functions,
                contextVariables,
                debug
            );
            history.push(...partialResponse.messages);
            Object.assign(contextVariables, partialResponse.contextVariables);
            if (partialResponse.agent) {
                activeAgent = partialResponse.agent;
            }
        }

        return new Response({
            messages: history.slice(initLen),
            agent: activeAgent,
            contextVariables: contextVariables,
        });
    }
}

export { Swarm };
