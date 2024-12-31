export function escalate_to_agent(reason?: string): string {
    return reason ? `Escalating to agent: ${reason}` : "Escalating to agent";
}

export function valid_to_change_flight(): string {
    return "Customer is eligible to change flight";
}

export function change_flight(): string {
    return "Flight was successfully changed!";
}

export function initiate_refund(): string {
    const status = "Refund initiated";
    return status;
}

export function initiate_flight_credits(): string {
    const status = "Successfully initiated flight credits";
    return status;
}

export function case_resolved(): string {
    return "Case resolved. No further questions.";
}

export function initiate_baggage_search(): string {
    return "Baggage was found!";
}
