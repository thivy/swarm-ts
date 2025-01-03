using System;

namespace SwarmDotNet
{
    public class ChatCompletionMessageToolCall
    {
        public string Id { get; set; }
        public Function Function { get; set; }
        public string Type { get; set; }

        public ChatCompletionMessageToolCall(string id, Function function, string type)
        {
            Id = id;
            Function = function;
            Type = type;
        }
    }
}
