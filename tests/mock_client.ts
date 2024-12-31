import { OpenAI } from 'openai';
import { ChatCompletion, ChatCompletionMessage, ChatCompletionMessageToolCall, Function, Choice } from 'openai';
import { AgentFunction } from '../swarm/types';

function createMockResponse(message: any, functionCalls: any[] = [], model: string = "gpt-4o"): ChatCompletion {
    const role = message.role || "assistant";
    const content = message.content || "";
    const toolCalls = functionCalls.length > 0 ? functionCalls.map(call => new ChatCompletionMessageToolCall({
        id: "mock_tc_id",
        type: "function",
        function: new Function({
            name: call.name || "",
            arguments: JSON.stringify(call.args || {}),
        }),
    })) : null;

    return new ChatCompletion({
        id: "mock_cc_id",
        created: 1234567890,
        model: model,
        object: "chat.completion",
        choices: [
            new Choice({
                message: new ChatCompletionMessage({
                    role: role,
                    content: content,
                    tool_calls: toolCalls,
                }),
                finish_reason: "stop",
                index: 0,
            }),
        ],
    });
}

class MockOpenAIClient {
    chat: any;

    constructor() {
        this.chat = {
            completions: {
                create: jest.fn(),
            },
        };
    }

    setResponse(response: ChatCompletion) {
        this.chat.completions.create.mockReturnValue(response);
    }

    setSequentialResponses(responses: ChatCompletion[]) {
        this.chat.completions.create.mockImplementationOnce(() => responses.shift());
    }

    assertCreateCalledWith(params: any) {
        expect(this.chat.completions.create).toHaveBeenCalledWith(params);
    }
}

// Initialize the mock client
const client = new MockOpenAIClient();

// Set a sequence of mock responses
client.setSequentialResponses([
    createMockResponse(
        { role: "assistant", content: "First response" },
        [
            {
                name: "process_refund",
                args: { item_id: "item_123", reason: "too expensive" },
            },
        ]
    ),
    createMockResponse({ role: "assistant", content: "Second" }),
]);

// This should return the first mock response
const firstResponse = client.chat.completions.create();
console.log(firstResponse.choices[0].message); // Outputs: role='agent' content='First response'

// This should return the second mock response
const secondResponse = client.chat.completions.create();
console.log(secondResponse.choices[0].message); // Outputs: role='agent' content='Second response'
