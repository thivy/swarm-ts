import { Swarm, Agent } from '../swarm/core';
import { MockOpenAIClient, createMockResponse } from './mock_client';
import { jest } from '@jest/globals';

const DEFAULT_RESPONSE_CONTENT = "sample response content";

describe('Swarm', () => {
    let mockOpenAIClient: MockOpenAIClient;

    beforeEach(() => {
        mockOpenAIClient = new MockOpenAIClient();
        mockOpenAIClient.setResponse(
            createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT })
        );
    });

    test('run with simple message', async () => {
        const agent = new Agent();
        const client = new Swarm(mockOpenAIClient);
        const messages = [{ role: "user", content: "Hello, how are you?" }];
        const response = await client.run(agent, messages);

        expect(response.messages[response.messages.length - 1].role).toBe("assistant");
        expect(response.messages[response.messages.length - 1].content).toBe(DEFAULT_RESPONSE_CONTENT);
    });

    test('tool call', async () => {
        const expectedLocation = "San Francisco";
        const getWeatherMock = jest.fn();

        const getWeather = (location: string) => {
            getWeatherMock(location);
            return "It's sunny today.";
        };

        const agent = new Agent({ name: "Test Agent", functions: [getWeather] });
        const messages = [{ role: "user", content: "What's the weather like in San Francisco?" }];

        mockOpenAIClient.setSequentialResponses([
            createMockResponse(
                { role: "assistant", content: "" },
                [{ name: "get_weather", args: { location: expectedLocation } }]
            ),
            createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT })
        ]);

        const client = new Swarm(mockOpenAIClient);
        const response = await client.run(agent, messages);

        expect(getWeatherMock).toHaveBeenCalledWith(expectedLocation);
        expect(response.messages[response.messages.length - 1].role).toBe("assistant");
        expect(response.messages[response.messages.length - 1].content).toBe(DEFAULT_RESPONSE_CONTENT);
    });

    test('execute tools false', async () => {
        const expectedLocation = "San Francisco";
        const getWeatherMock = jest.fn();

        const getWeather = (location: string) => {
            getWeatherMock(location);
            return "It's sunny today.";
        };

        const agent = new Agent({ name: "Test Agent", functions: [getWeather] });
        const messages = [{ role: "user", content: "What's the weather like in San Francisco?" }];

        mockOpenAIClient.setSequentialResponses([
            createMockResponse(
                { role: "assistant", content: "" },
                [{ name: "get_weather", args: { location: expectedLocation } }]
            ),
            createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT })
        ]);

        const client = new Swarm(mockOpenAIClient);
        const response = await client.run(agent, messages, {}, null, false, false, Infinity, false);

        expect(getWeatherMock).not.toHaveBeenCalled();

        const toolCalls = response.messages[response.messages.length - 1].tool_calls;
        expect(toolCalls).not.toBeNull();
        expect(toolCalls.length).toBe(1);
        const toolCall = toolCalls[0];
        expect(toolCall.function.name).toBe("get_weather");
        expect(JSON.parse(toolCall.function.arguments)).toEqual({ location: expectedLocation });
    });

    test('handoff', async () => {
        const transferToAgent2 = () => agent2;

        const agent1 = new Agent({ name: "Test Agent 1", functions: [transferToAgent2] });
        const agent2 = new Agent({ name: "Test Agent 2" });

        mockOpenAIClient.setSequentialResponses([
            createMockResponse(
                { role: "assistant", content: "" },
                [{ name: "transfer_to_agent2" }]
            ),
            createMockResponse({ role: "assistant", content: DEFAULT_RESPONSE_CONTENT })
        ]);

        const client = new Swarm(mockOpenAIClient);
        const messages = [{ role: "user", content: "I want to talk to agent 2" }];
        const response = await client.run(agent1, messages);

        expect(response.agent).toBe(agent2);
        expect(response.messages[response.messages.length - 1].role).toBe("assistant");
        expect(response.messages[response.messages.length - 1].content).toBe(DEFAULT_RESPONSE_CONTENT);
    });
});
