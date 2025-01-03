using System;
using System.Collections.Generic;

namespace SwarmDotNet
{
    public class Agent
    {
        public string Name { get; set; }
        public string Model { get; set; }
        public string Instructions { get; set; }
        public List<Func<Dictionary<string, object>, string>> Functions { get; set; }
        public string ToolChoice { get; set; }
        public bool ParallelToolCalls { get; set; }

        public Agent(string name, string model, string instructions, List<Func<Dictionary<string, object>, string>> functions, string toolChoice = null, bool parallelToolCalls = true)
        {
            Name = name;
            Model = model;
            Instructions = instructions;
            Functions = functions;
            ToolChoice = toolChoice;
            ParallelToolCalls = parallelToolCalls;
        }
    }
}
