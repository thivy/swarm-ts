import { inspect } from 'util';
import { format } from 'date-fns';

export function debugPrint(debug: boolean, ...args: string[]): void {
    if (!debug) return;
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const message = args.join(' ');
    console.log(`\x1b[97m[\x1b[90m${timestamp}\x1b[97m]\x1b[90m ${message}\x1b[0m`);
}

export function mergeFields(target: any, source: any): void {
    for (const key in source) {
        if (typeof source[key] === 'string') {
            target[key] += source[key];
        } else if (source[key] !== null && typeof source[key] === 'object') {
            mergeFields(target[key], source[key]);
        }
    }
}

export function mergeChunk(finalResponse: any, delta: any): void {
    delete delta.role;
    mergeFields(finalResponse, delta);

    const toolCalls = delta.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
        const index = toolCalls[0].index;
        delete toolCalls[0].index;
        mergeFields(finalResponse.tool_calls[index], toolCalls[0]);
    }
}

export function functionToJson(func: Function): any {
    const typeMap: Record<string, string> = {
        'string': 'string',
        'number': 'number',
        'boolean': 'boolean',
        'object': 'object',
        'undefined': 'null',
    };

    const signature = inspect(func);
    const parameters: Record<string, any> = {};
    const required: string[] = [];

    for (const param of signature.parameters) {
        const paramType = typeMap[param.type] || 'string';
        parameters[param.name] = { type: paramType };
        if (param.default === undefined) {
            required.push(param.name);
        }
    }

    return {
        type: 'function',
        function: {
            name: func.name,
            description: func.description || '',
            parameters: {
                type: 'object',
                properties: parameters,
                required: required,
            },
        },
    };
}
