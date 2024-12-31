import { Swarm } from 'swarm';
import { v4 as uuidv4 } from 'uuid';

interface TestCase {
    conversation: string[];
    function: string;
}

interface CaseResults {
    messages: string[];
    expected_function: string;
    actual_function: string[];
    actual_message: string[];
    case_accuracy?: string;
}

interface FinalResult {
    id: string;
    timestamp: string;
    results: CaseResults[];
    correct_evals: number;
    total_evals: number;
    overall_accuracy_percent: string;
}

export async function runFunctionEvals(agent: any, testCases: TestCase[], n = 1, evalPath: string | null = null): Promise<number> {
    let correctFunction = 0;
    const results: CaseResults[] = [];
    const evalId = uuidv4();
    const evalTimestamp = new Date().toISOString();
    const client = new Swarm();

    for (const testCase of testCases) {
        let caseCorrect = 0;
        const caseResults: CaseResults = {
            messages: testCase.conversation,
            expected_function: testCase.function,
            actual_function: [],
            actual_message: [],
        };
        console.log('--------------------------------------------------');
        console.log(`\x1b[94mConversation: \x1b[0m${testCase.conversation}\n`);
        for (let i = 0; i < n; i++) {
            console.log(`\x1b[90mIteration: ${i + 1}/${n}\x1b[0m`);
            const response = await client.run({
                agent: agent,
                messages: testCase.conversation,
                max_turns: 1,
            });
            const output = extractResponseInfo(response);
            const actualFunction = output.tool_calls || 'None';
            const actualMessage = output.message || 'None';

            caseResults.actual_function.push(actualFunction);
            caseResults.actual_message.push(actualMessage);

            if (output.tool_calls) {
                console.log(`\x1b[95mExpected function: \x1b[0m ${testCase.function}, \x1b[95mGot: \x1b[0m${output.tool_calls}\n`);
                if (output.tool_calls === testCase.function) {
                    caseCorrect += 1;
                    correctFunction += 1;
                }
            } else if (output.message) {
                console.log(`\x1b[95mExpected function: \x1b[0m ${testCase.function}, \x1b[95mGot: \x1b[0mNone`);
                console.log(`\x1b[90mMessage: ${output.message}\x1b[0m\n`);
                if (testCase.function === 'None') {
                    caseCorrect += 1;
                    correctFunction += 1;
                }
            }
        }

        const caseAccuracy = (caseCorrect / n) * 100;
        caseResults.case_accuracy = `${caseAccuracy.toFixed(2)}%`;
        results.push(caseResults);

        console.log(`\x1b[92mCorrect functions for this case: ${caseCorrect} out of ${n}\x1b[0m`);
        console.log(`\x1b[93mAccuracy for this case: ${caseAccuracy.toFixed(2)}%\x1b[0m`);
    }

    const overallAccuracy = (correctFunction / (testCases.length * n)) * 100;
    console.log('**************************************************');
    console.log(`\n\x1b[92mOVERALL: Correct functions selected: ${correctFunction} out of ${testCases.length * n}\x1b[0m`);
    console.log(`\x1b[93mOVERALL: Accuracy: ${overallAccuracy.toFixed(2)}%\x1b[0m`);

    const finalResult: FinalResult = {
        id: evalId,
        timestamp: evalTimestamp,
        results: results,
        correct_evals: correctFunction,
        total_evals: testCases.length * n,
        overall_accuracy_percent: `${overallAccuracy.toFixed(2)}%`,
    };

    if (evalPath) {
        try {
            const existingData = require(evalPath);
            const data = Array.isArray(existingData) ? existingData : [existingData];
            data.push(finalResult);
            const fs = require('fs');
            fs.writeFileSync(evalPath, JSON.stringify(data, null, 4));
        } catch (error) {
            console.error('Error reading or writing eval file:', error);
        }
    }

    return overallAccuracy;
}

function extractResponseInfo(response: any): { tool_calls?: string; message?: string } {
    const results: { tool_calls?: string; message?: string } = {};
    for (const message of response.messages) {
        if (message.role === 'tool') {
            results.tool_calls = message.tool_name;
            break;
        } else if (!message.tool_calls) {
            results.message = message.content;
        }
    }
    return results;
}
