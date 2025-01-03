import { Swarm, Agent } from 'swarm';

const client = new Swarm();

interface ContextVariables {
    name?: string;
    user_id?: number;
}

function instructions(context_variables: ContextVariables): string {
    const name = context_variables.name || 'User';
    return `You are a helpful agent. Greet the user by name (${name}).`;
}

function print_account_details(context_variables: ContextVariables): string {
    const user_id = context_variables.user_id || 'unknown';
    const name = context_variables.name || 'unknown';
    console.log(`Account Details: ${name} ${user_id}`);
    return "Success";
}

const agent = new Agent({
    name: "Agent",
    instructions: instructions,
    functions: [print_account_details],
});

const context_variables: ContextVariables = { name: "James", user_id: 123 };

let response = await client.run({
    messages: [{ role: "user", content: "Hi!" }],
    agent: agent,
    context_variables: context_variables,
});
console.log(response.messages[response.messages.length - 1].content);

response = await client.run({
    messages: [{ role: "user", content: "Print my account details!" }],
    agent: agent,
    context_variables: context_variables,
});
console.log(response.messages[response.messages.length - 1].content);
