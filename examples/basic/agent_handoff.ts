import { Swarm, Agent } from 'swarm';

const client = new Swarm();

const englishAgent = new Agent({
    name: "English Agent",
    instructions: "You only speak English.",
});

const spanishAgent = new Agent({
    name: "Spanish Agent",
    instructions: "You only speak Spanish.",
});

function transferToSpanishAgent(): Agent {
    return spanishAgent;
}

englishAgent.functions.push(transferToSpanishAgent);

const messages = [{ role: "user", content: "Hola. ¿Como estás?" }];
const response = await client.run({
    agent: englishAgent,
    messages: messages,
});

console.log(response.messages[response.messages.length - 1].content);
