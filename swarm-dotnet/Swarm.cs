using System;
using System.Collections.Generic;
using System.Linq;

namespace SwarmDotNet
{
    public class Swarm
    {
        private readonly OpenAIClient _client;

        public Swarm(OpenAIClient client = null)
        {
            _client = client ?? new OpenAIClient();
        }

        public ChatCompletionMessage GetChatCompletion(
            Agent agent,
            List<Dictionary<string, object>> history,
            Dictionary<string, object> contextVariables,
            string modelOverride,
            bool stream,
            bool debug)
        {
            contextVariables = contextVariables ?? new Dictionary<string, object>();
            var instructions = agent.Instructions;
            var messages = new List<Dictionary<string, object>> { new Dictionary<string, object> { { "role", "system" }, { "content", instructions } } };
            messages.AddRange(history);

            var tools = agent.Functions.Select(function => Util.FunctionToJson(function)).ToList();

            foreach (var tool in tools)
            {
                var parameters = (Dictionary<string, object>)tool["function"]["parameters"];
                parameters.Remove("context_variables");
                if (((List<string>)parameters["required"]).Contains("context_variables"))
                {
                    ((List<string>)parameters["required"]).Remove("context_variables");
                }
            }

            var createParams = new Dictionary<string, object>
            {
                { "model", modelOverride ?? agent.Model },
                { "messages", messages },
                { "tools", tools.Any() ? tools : null },
                { "tool_choice", agent.ToolChoice },
                { "stream", stream }
            };

            if (tools.Any())
            {
                createParams["parallel_tool_calls"] = agent.ParallelToolCalls;
            }

            return _client.ChatCompletions.Create(createParams);
        }

        public Result HandleFunctionResult(object result, bool debug)
        {
            switch (result)
            {
                case Result res:
                    return res;
                case Agent agent:
                    return new Result
                    {
                        Value = Newtonsoft.Json.JsonConvert.SerializeObject(new { assistant = agent.Name }),
                        Agent = agent
                    };
                default:
                    try
                    {
                        return new Result { Value = result.ToString() };
                    }
                    catch (Exception e)
                    {
                        var errorMessage = $"Failed to cast response to string: {result}. Make sure agent functions return a string or Result object. Error: {e.Message}";
                        if (debug)
                        {
                            Console.WriteLine(errorMessage);
                        }
                        throw new InvalidCastException(errorMessage);
                    }
            }
        }

        public Response HandleToolCalls(
            List<ChatCompletionMessageToolCall> toolCalls,
            List<Func<Dictionary<string, object>, string>> functions,
            Dictionary<string, object> contextVariables,
            bool debug)
        {
            var functionMap = functions.ToDictionary(f => f.Method.Name, f => f);
            var partialResponse = new Response
            {
                Messages = new List<Dictionary<string, object>>(),
                Agent = null,
                ContextVariables = new Dictionary<string, object>()
            };

            foreach (var toolCall in toolCalls)
            {
                var name = toolCall.Function.Name;
                if (!functionMap.ContainsKey(name))
                {
                    if (debug)
                    {
                        Console.WriteLine($"Tool {name} not found in function map.");
                    }
                    partialResponse.Messages.Add(new Dictionary<string, object>
                    {
                        { "role", "tool" },
                        { "tool_call_id", toolCall.Id },
                        { "tool_name", name },
                        { "content", $"Error: Tool {name} not found." }
                    });
                    continue;
                }

                var args = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(toolCall.Function.Arguments);
                if (debug)
                {
                    Console.WriteLine($"Processing tool call: {name} with arguments {args}");
                }

                var func = functionMap[name];
                if (func.Method.GetParameters().Any(p => p.Name == "context_variables"))
                {
                    args["context_variables"] = contextVariables;
                }

                var rawResult = func(args);
                var result = HandleFunctionResult(rawResult, debug);

                partialResponse.Messages.Add(new Dictionary<string, object>
                {
                    { "role", "tool" },
                    { "tool_call_id", toolCall.Id },
                    { "tool_name", name },
                    { "content", result.Value }
                });

                foreach (var kvp in result.ContextVariables)
                {
                    partialResponse.ContextVariables[kvp.Key] = kvp.Value;
                }

                if (result.Agent != null)
                {
                    partialResponse.Agent = result.Agent;
                }
            }

            return partialResponse;
        }

        public IEnumerable<object> RunAndStream(
            Agent agent,
            List<Dictionary<string, object>> messages,
            Dictionary<string, object> contextVariables = null,
            string modelOverride = null,
            bool debug = false,
            int maxTurns = int.MaxValue,
            bool executeTools = true)
        {
            var activeAgent = agent;
            contextVariables = contextVariables ?? new Dictionary<string, object>();
            var history = new List<Dictionary<string, object>>(messages);
            var initLen = messages.Count;

            while (history.Count - initLen < maxTurns)
            {
                var message = new Dictionary<string, object>
                {
                    { "content", "" },
                    { "sender", agent.Name },
                    { "role", "assistant" },
                    { "function_call", null },
                    { "tool_calls", new Dictionary<string, object>() }
                };

                var completion = GetChatCompletion(
                    agent: activeAgent,
                    history: history,
                    contextVariables: contextVariables,
                    modelOverride: modelOverride,
                    stream: true,
                    debug: debug
                );

                yield return new { delim = "start" };
                foreach (var chunk in completion)
                {
                    var delta = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(chunk.Choices[0].Delta.ToString());
                    if (delta["role"].ToString() == "assistant")
                    {
                        delta["sender"] = activeAgent.Name;
                    }
                    yield return delta;
                    delta.Remove("role");
                    delta.Remove("sender");
                    Util.MergeChunk(message, delta);
                }
                yield return new { delim = "end" };

                message["tool_calls"] = ((Dictionary<string, object>)message["tool_calls"]).Values.ToList();
                if (!((List<object>)message["tool_calls"]).Any())
                {
                    message["tool_calls"] = null;
                }
                if (debug)
                {
                    Console.WriteLine("Received completion:", message);
                }
                history.Add(message);

                if (message["tool_calls"] == null || !executeTools)
                {
                    if (debug)
                    {
                        Console.WriteLine("Ending turn.");
                    }
                    break;
                }

                var toolCalls = ((List<object>)message["tool_calls"]).Select(tc =>
                {
                    var toolCallDict = (Dictionary<string, object>)tc;
                    var function = new Function
                    {
                        Arguments = toolCallDict["function"]["arguments"].ToString(),
                        Name = toolCallDict["function"]["name"].ToString()
                    };
                    return new ChatCompletionMessageToolCall
                    {
                        Id = toolCallDict["id"].ToString(),
                        Function = function,
                        Type = toolCallDict["type"].ToString()
                    };
                }).ToList();

                var partialResponse = HandleToolCalls(toolCalls, activeAgent.Functions, contextVariables, debug);
                history.AddRange(partialResponse.Messages);
                foreach (var kvp in partialResponse.ContextVariables)
                {
                    contextVariables[kvp.Key] = kvp.Value;
                }
                if (partialResponse.Agent != null)
                {
                    activeAgent = partialResponse.Agent;
                }
            }

            yield return new
            {
                response = new Response
                {
                    Messages = history.Skip(initLen).ToList(),
                    Agent = activeAgent,
                    ContextVariables = contextVariables
                }
            };
        }

        public Response Run(
            Agent agent,
            List<Dictionary<string, object>> messages,
            Dictionary<string, object> contextVariables = null,
            string modelOverride = null,
            bool stream = false,
            bool debug = false,
            int maxTurns = int.MaxValue,
            bool executeTools = true)
        {
            if (stream)
            {
                return RunAndStream(
                    agent: agent,
                    messages: messages,
                    contextVariables: contextVariables,
                    modelOverride: modelOverride,
                    debug: debug,
                    maxTurns: maxTurns,
                    executeTools: executeTools
                ).Cast<Response>().FirstOrDefault();
            }

            var activeAgent = agent;
            contextVariables = contextVariables ?? new Dictionary<string, object>();
            var history = new List<Dictionary<string, object>>(messages);
            var initLen = messages.Count;

            while (history.Count - initLen < maxTurns && activeAgent != null)
            {
                var completion = GetChatCompletion(
                    agent: activeAgent,
                    history: history,
                    contextVariables: contextVariables,
                    modelOverride: modelOverride,
                    stream: stream,
                    debug: debug
                );
                var message = completion.Choices[0].Message;
                if (debug)
                {
                    Console.WriteLine("Received completion:", message);
                }
                message.Sender = activeAgent.Name;
                history.Add(Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object>>(message.ToString()));

                if (message.ToolCalls == null || !executeTools)
                {
                    if (debug)
                    {
                        Console.WriteLine("Ending turn.");
                    }
                    break;
                }

                var partialResponse = HandleToolCalls(message.ToolCalls, activeAgent.Functions, contextVariables, debug);
                history.AddRange(partialResponse.Messages);
                foreach (var kvp in partialResponse.ContextVariables)
                {
                    contextVariables[kvp.Key] = kvp.Value;
                }
                if (partialResponse.Agent != null)
                {
                    activeAgent = partialResponse.Agent;
                }
            }

            return new Response
            {
                Messages = history.Skip(initLen).ToList(),
                Agent = activeAgent,
                ContextVariables = contextVariables
            };
        }
    }
}
