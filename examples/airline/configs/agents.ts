import { Agent } from 'swarm';
import { 
  escalate_to_agent, 
  initiate_refund, 
  initiate_flight_credits, 
  transfer_to_triage, 
  case_resolved, 
  change_flight, 
  valid_to_change_flight, 
  initiate_baggage_search 
} from './tools';
import { 
  FLIGHT_CANCELLATION_POLICY, 
  FLIGHT_CHANGE_POLICY, 
  LOST_BAGGAGE_POLICY 
} from '../data/routines/baggage/policies';
import { STARTER_PROMPT } from '../data/routines/prompts';

interface ContextVariables {
  customer_context?: string;
  flight_context?: string;
}

function transfer_to_flight_modification(): Agent {
  return flight_modification;
}

function transfer_to_flight_cancel(): Agent {
  return flight_cancel;
}

function transfer_to_flight_change(): Agent {
  return flight_change;
}

function transfer_to_lost_baggage(): Agent {
  return lost_baggage;
}

function transfer_to_triage(): Agent {
  return triage_agent;
}

function triage_instructions(context_variables: ContextVariables): string {
  const customer_context = context_variables.customer_context || '';
  const flight_context = context_variables.flight_context || '';
  return `You are to triage a users request, and call a tool to transfer to the right intent.
  Once you are ready to transfer to the right intent, call the tool to transfer to the right intent.
  You dont need to know specifics, just the topic of the request.
  When you need more information to triage the request to an agent, ask a direct question without explaining why you're asking it.
  Do not share your thought process with the user! Do not make unreasonable assumptions on behalf of user.
  The customer context is here: ${customer_context}, and flight context is here: ${flight_context}`;
}

const triage_agent = new Agent({
  name: "Triage Agent",
  instructions: triage_instructions,
  functions: [transfer_to_flight_modification, transfer_to_lost_baggage],
});

const flight_modification = new Agent({
  name: "Flight Modification Agent",
  instructions: `You are a Flight Modification Agent for a customer service airlines company.
    You are an expert customer service agent deciding which sub intent the user should be referred to.
    You already know the intent is for flight modification related question. First, look at message history and see if you can determine if the user wants to cancel or change their flight.
    Ask user clarifying questions until you know whether or not it is a cancel request or change flight request. Once you know, call the appropriate transfer function. Either ask clarifying questions, or call one of your functions, every time.`,
  functions: [transfer_to_flight_cancel, transfer_to_flight_change],
  parallel_tool_calls: false,
});

const flight_cancel = new Agent({
  name: "Flight cancel traversal",
  instructions: STARTER_PROMPT + FLIGHT_CANCELLATION_POLICY,
  functions: [
    escalate_to_agent,
    initiate_refund,
    initiate_flight_credits,
    transfer_to_triage,
    case_resolved,
  ],
});

const flight_change = new Agent({
  name: "Flight change traversal",
  instructions: STARTER_PROMPT + FLIGHT_CHANGE_POLICY,
  functions: [
    escalate_to_agent,
    change_flight,
    valid_to_change_flight,
    transfer_to_triage,
    case_resolved,
  ],
});

const lost_baggage = new Agent({
  name: "Lost baggage traversal",
  instructions: STARTER_PROMPT + LOST_BAGGAGE_POLICY,
  functions: [
    escalate_to_agent,
    initiate_baggage_search,
    transfer_to_triage,
    case_resolved,
  ],
});
