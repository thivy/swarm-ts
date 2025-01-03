import { Swarm, Agent } from 'swarm';

const client = new Swarm();

const myAgent = new Agent({
    name: "Agent",
    instructions: "You are a helpful agent.",
});

function prettyPrintMessages(messages: { sender: string; content: string | null }[]): void {
    for (const message of messages) {
        if (message.content === null) {
            continue;
        }
        console.log(`${message.sender}: ${message.content}`);
    }
}

let messages: { role: string; content: string }[] = [];
let agent = myAgent;

while (true) {
    const userInput = prompt("> ");
    if (userInput === null) {
        break;
    }
    messages.push({ role: "user", content: userInput });

    const response = await client.run({
        agent: agent,
        messages: messages,
    });
    messages = response.messages;
    agent = response.agent;
    prettyPrintMessages(messages);
}
