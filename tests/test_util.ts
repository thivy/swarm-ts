import { functionToJson } from '../swarm/util';

describe('functionToJson', () => {
    test('basic function', () => {
        function basicFunction(arg1: string, arg2: string): string {
            return arg1 + arg2;
        }

        const result = functionToJson(basicFunction);
        expect(result).toEqual({
            type: "function",
            function: {
                name: "basicFunction",
                description: "",
                parameters: {
                    type: "object",
                    properties: {
                        arg1: { type: "string" },
                        arg2: { type: "string" },
                    },
                    required: ["arg1", "arg2"],
                },
            },
        });
    });

    test('complex function', () => {
        function complexFunctionWithTypesAndDescriptions(
            arg1: number,
            arg2: string,
            arg3: number = 3.14,
            arg4: boolean = false
        ): void {
            /** This is a complex function with a docstring. */
        }

        const result = functionToJson(complexFunctionWithTypesAndDescriptions);
        expect(result).toEqual({
            type: "function",
            function: {
                name: "complexFunctionWithTypesAndDescriptions",
                description: "This is a complex function with a docstring.",
                parameters: {
                    type: "object",
                    properties: {
                        arg1: { type: "integer" },
                        arg2: { type: "string" },
                        arg3: { type: "number" },
                        arg4: { type: "boolean" },
                    },
                    required: ["arg1", "arg2"],
                },
            },
        });
    });
});
