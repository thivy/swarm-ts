![Swarm Logo](assets/logo.png)

# Swarm (experimental, educational)

An educational framework exploring ergonomic, lightweight multi-agent orchestration.

> [!WARNING]
> Swarm is currently an experimental sample framework intended to explore ergonomic interfaces for multi-agent systems. It is not intended to be used in production, and therefore has no official support. (This also means we will not be reviewing PRs or issues!)
>
> The primary goal of Swarm is to showcase the handoff & routines patterns explored in the [Orchestrating Agents: Handoffs & Routines](https://cookbook.openai.com/examples/orchestrating_agents) cookbook. It is not meant as a standalone library, and is primarily for educational purposes.

## Install

Requires Node.js 14+

```shell
npm install git+ssh://git@github.com/openai/swarm.git
```

or

```shell
npm install git+https://github.com/openai/swarm.git
```

## Usage

```typescript
import { Swarm, Agent } from 'swarm';

const client = new Swarm();

function transferToAgentB(): Agent {
    return agentB;
}

const agentA = new Agent({
    name: "Agent A",
    instructions: "You are a helpful agent.",
    functions: [transferToAgentB],
});

const agentB = new Agent({
    name: "Agent B",
    instructions: "Only speak in Haikus.",
});

const response = await client.run({
    agent: agentA,
    messages: [{ role: "user", content: "I want to talk to agent B." }],
});

console.log(response.messages[response.messages.length - 1].content);
```

```
Hope glimmers brightly,
New paths converge gracefully,
What can I assist?
```

## Table of Contents

- [Overview](#overview)
- [Examples](#examples)
- [Documentation](#documentation)
  - [Running Swarm](#running-swarm)
  - [Agents](#agents)
  - [Functions](#functions)
  - [Streaming](#streaming)
- [Evaluations](#evaluations)
- [Utils](#utils)

# Overview

Swarm focuses on making agent **coordination** and **execution** lightweight, highly controllable, and easily testable.

It accomplishes this through two primitive abstractions: `Agent`s and **handoffs**. An `Agent` encompasses `instructions` and `tools`, and can at any point choose to hand off a conversation to another `Agent`.

These primitives are powerful enough to express rich dynamics between tools and networks of agents, allowing you to build scalable, real-world solutions while avoiding a steep learning curve.

> [!NOTE]
> Swarm Agents are not related to Assistants in the Assistants API. They are named similarly for convenience, but are otherwise completely unrelated. Swarm is entirely powered by the Chat Completions API and is hence stateless between calls.

## Why Swarm

Swarm explores patterns that are lightweight, scalable, and highly customizable by design. Approaches similar to Swarm are best suited for situations dealing with a large number of independent capabilities and instructions that are difficult to encode into a single prompt.

The Assistants API is a great option for developers looking for fully-hosted threads and built in memory management and retrieval. However, Swarm is an educational resource for developers curious to learn about multi-agent orchestration. Swarm runs (almost) entirely on the client and, much like the Chat Completions API, does not store state between calls.

# Examples

Check out `/examples` for inspiration! Learn more about each one in its README.

- [`basic`](examples/basic): Simple examples of fundamentals like setup, function calling, handoffs, and context variables
- [`triage_agent`](examples/triage_agent): Simple example of setting up a basic triage step to hand off to the right agent
- [`weather_agent`](examples/weather_agent): Simple example of function calling
- [`airline`](examples/airline): A multi-agent setup for handling different customer service requests in an airline context.
- [`support_bot`](examples/support_bot): A customer service bot which includes a user interface agent and a help center agent with several tools
- [`personal_shopper`](examples/personal_shopper): A personal shopping agent that can help with making sales and refunding orders

# Documentation

![Swarm Diagram](assets/swarm_diagram.png)

## Running Swarm

Start by instantiating a Swarm client (which internally just instantiates an `OpenAI` client).

```typescript
import { Swarm } from 'swarm';

const client = new Swarm();
```

### `client.run()`

Swarm's `run()` function is analogous to the `chat.completions.create()` function in the Chat Completions API – it takes `messages` and returns `messages` and saves no state between calls. Importantly, however, it also handles Agent function execution, hand-offs, context variable references, and can take multiple turns before returning to the user.

At its core, Swarm's `client.run()` implements the following loop:

1. Get a completion from the current Agent
2. Execute tool calls and append results
3. Switch Agent if necessary
4. Update context variables, if necessary
5. If no new function calls, return

#### Arguments

| Argument              | Type    | Description                                                                                                                                            | Default        |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| **agent**             | `Agent` | The (initial) agent to be called.                                                                                                                      | (required)     |
| **messages**          | `List`  | A list of message objects, identical to [Chat Completions `messages`](https://platform.openai.com/docs/api-reference/chat/create#chat-create-messages) | (required)     |
| **context_variables** | `dict`  | A dictionary of additional context variables, available to functions and Agent instructions                                                            | `{}`           |
| **max_turns**         | `int`   | The maximum number of conversational turns allowed                                                                                                     | `Infinity`     |
| **model_override**    | `str`   | An optional string to override the model being used by an Agent                                                                                        | `null`         |
| **execute_tools**     | `bool`  | If `False`, interrupt execution and immediately returns `tool_calls` message when an Agent tries to call a function                                    | `true`         |
| **stream**            | `bool`  | If `True`, enables streaming responses                                                                                                                 | `false`        |
| **debug**             | `bool`  | If `True`, enables debug logging                                                                                                                       | `false`        |

Once `client.run()` is finished (after potentially multiple calls to agents and tools) it will return a `Response` containing all the relevant updated state. Specifically, the new `messages`, the last `Agent` to be called, and the most up-to-date `context_variables`. You can pass these values (plus new user messages) in to your next execution of `client.run()` to continue the interaction where it left off – much like `chat.completions.create()`. (The `runDemoLoop` function implements an example of a full execution loop in `/swarm/repl/repl.ts`.)

#### `Response` Fields

| Field                 | Type    | Description                                                                                                                                                                                                                                                                  |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **messages**          | `List`  | A list of message objects generated during the conversation. Very similar to [Chat Completions `messages`](https://platform.openai.com/docs/api-reference/chat/create#chat-create-messages), but with a `sender` field indicating which `Agent` the message originated from. |
| **agent**             | `Agent` | The last agent to handle a message.                                                                                                                                                                                                                                          |
| **context_variables** | `dict`  | The same as the input variables, plus any changes.                                                                                                                                                                                                                           |

## Agents

An `Agent` simply encapsulates a set of `instructions` with a set of `functions` (plus some additional settings below), and has the capability to hand off execution to another `Agent`.

While it's tempting to personify an `Agent` as "someone who does X", it can also be used to represent a very specific workflow or step defined by a set of `instructions` and `functions` (e.g. a set of steps, a complex retrieval, single step of data transformation, etc). This allows `Agent`s to be composed into a network of "agents", "workflows", and "tasks", all represented by the same primitive.

## `Agent` Fields

| Field            | Type                     | Description                                                                   | Default                      |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------- | ---------------------------- |
| **name**         | `string`                 | The name of the agent.                                                        | `"Agent"`                    |
| **model**        | `string`                 | The model to be used by the agent.                                            | `"gpt-4o"`                   |
| **instructions** | `string` or `() => string` | Instructions for the agent, can be a string or a callable returning a string. | `"You are a helpful agent."` |
| **functions**    | `AgentFunction[]`        | A list of functions that the agent can call.                                  | `[]`                         |
| **tool_choice**  | `string`                 | The tool choice for the agent, if any.                                        | `null`                       |

### Instructions

`Agent` `instructions` are directly converted into the `system` prompt of a conversation (as the first message). Only the `instructions` of the active `Agent` will be present at any given time (e.g. if there is an `Agent` handoff, the `system` prompt will change, but the chat history will not.)

```typescript
const agent = new Agent({
   instructions: "You are a helpful agent."
});
```

The `instructions` can either be a regular `string`, or a function that returns a `string`. The function can optionally receive a `context_variables` parameter, which will be populated by the `context_variables` passed into `client.run()`.

```typescript
function instructions(contextVariables: Record<string, any>): string {
   const userName = contextVariables["user_name"];
   return `Help the user, ${userName}, do whatever they want.`;
}

const agent = new Agent({
   instructions: instructions
});

const response = await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Hi!" }],
   context_variables: { user_name: "John" }
});
console.log(response.messages[response.messages.length - 1].content);
```

```
Hi John, how can I assist you today?
```

## Functions

- Swarm `Agent`s can call TypeScript functions directly.
- Function should usually return a `string` (values will be attempted to be cast as a `string`).
- If a function returns an `Agent`, execution will be transferred to that `Agent`.
- If a function defines a `context_variables` parameter, it will be populated by the `context_variables` passed into `client.run()`.

```typescript
function greet(contextVariables: Record<string, any>, language: string): string {
   const userName = contextVariables["user_name"];
   const greeting = language.toLowerCase() === "spanish" ? "Hola" : "Hello";
   console.log(`${greeting}, ${userName}!`);
   return "Done";
}

const agent = new Agent({
   functions: [greet]
});

await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Usa greet() por favor." }],
   context_variables: { user_name: "John" }
});
```

```
Hola, John!
```

- If an `Agent` function call has an error (missing function, wrong argument, error) an error response will be appended to the chat so the `Agent` can recover gracefully.
- If multiple functions are called by the `Agent`, they will be executed in that order.

### Handoffs and Updating Context Variables

An `Agent` can hand off to another `Agent` by returning it in a `function`.

```typescript
const salesAgent = new Agent({ name: "Sales Agent" });

function transferToSales(): Agent {
   return salesAgent;
}

const agent = new Agent({
   functions: [transferToSales]
});

const response = await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Transfer me to sales." }]
});
console.log(response.agent.name);
```

```
Sales Agent
```

It can also update the `context_variables` by returning a more complete `Result` object. This can also contain a `value` and an `agent`, in case you want a single function to return a value, update the agent, and update the context variables (or any subset of the three).

```typescript
const salesAgent = new Agent({ name: "Sales Agent" });

function talkToSales(): Result {
   console.log("Hello, World!");
   return new Result({
       value: "Done",
       agent: salesAgent,
       context_variables: { department: "sales" }
   });
}

const agent = new Agent({
   functions: [talkToSales]
});

const response = await client.run({
   agent: agent,
   messages: [{ role: "user", content: "Transfer me to sales" }],
   context_variables: { user_name: "John" }
});
console.log(response.agent.name);
console.log(response.context_variables);
```

```
Sales Agent
{ department: 'sales', user_name: 'John' }
```

> [!NOTE]
> If an `Agent` calls multiple functions to hand-off to an `Agent`, only the last handoff function will be used.

### Function Schemas

Swarm automatically converts functions into a JSON Schema that is passed into Chat Completions `tools`.

- Docstrings are turned into the function `description`.
- Parameters without default values are set to `required`.
- Type hints are mapped to the parameter's `type` (and default to `string`).
- Per-parameter descriptions are not explicitly supported, but should work similarly if just added in the docstring. (In the future docstring argument parsing may be added.)

```typescript
function greet(name: string, age: number, location: string = "New York"): string {
   /** Greets the user. Make sure to get their name and age before calling.
    *
    * @param name - Name of the user.
    * @param age - Age of the user.
    * @param location - Best place on earth.
    */
   console.log(`Hello ${name}, glad you are ${age} in ${location}!`);
   return "Done";
}
```

```javascript
{
   "type": "function",
   "function": {
      "name": "greet",
      "description": "Greets the user. Make sure to get their name and age before calling.\n\nArgs:\n   name: Name of the user.\n   age: Age of the user.\n   location: Best place on earth.",
      "parameters": {
         "type": "object",
         "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer"},
            "location": {"type": "string"}
         },
         "required": ["name", "age"]
      }
   }
}
```

## Streaming

```typescript
const stream = client.run(agent, messages, { stream: true });
for await (const chunk of stream) {
   console.log(chunk);
}
```

Uses the same events as [Chat Completions API streaming](https://platform.openai.com/docs/api-reference/streaming). See `processAndPrintStreamingResponse` in `/swarm/repl/repl.ts` as an example.

Two new event types have been added:

- `{"delim":"start"}` and `{"delim":"end"}`, to signal each time an `Agent` handles a single message (response or function call). This helps identify switches between `Agent`s.
- `{"response": Response}` will return a `Response` object at the end of a stream with the aggregated (complete) response, for convenience.

# Evaluations

Evaluations are crucial to any project, and we encourage developers to bring their own eval suites to test the performance of their swarms. For reference, we have some examples for how to eval swarm in the `airline`, `weather_agent` and `triage_agent` quickstart examples. See the READMEs for more details.

# Utils

Use the `runDemoLoop` to test out your swarm! This will run a REPL on your command line. Supports streaming.

```typescript
import { runDemoLoop } from 'swarm/repl';
...
runDemoLoop(agent, { stream: true });
```

# Core Contributors

- Ilan Bigio - [ibigio](https://github.com/ibigio)
- James Hills - [jhills20](https://github.com/jhills20)
- Shyamal Anadkat - [shyamal-anadkat](https://github.com/shyamal-anadkat)
- Charu Jaiswal - [charuj](https://github.com/charuj)
- Colin Jarvis - [colin-openai](https://github.com/colin-openai)
- Katia Gil Guzman - [katia-openai](https://github.com/katia-openai)
