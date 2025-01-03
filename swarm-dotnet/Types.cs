namespace SwarmDotNet
{
    public class ChatCompletionMessage
    {
        public string Role { get; set; }
        public string Content { get; set; }
        public List<ChatCompletionMessageToolCall> ToolCalls { get; set; }

        public ChatCompletionMessage(string role, string content, List<ChatCompletionMessageToolCall> toolCalls = null)
        {
            Role = role;
            Content = content;
            ToolCalls = toolCalls ?? new List<ChatCompletionMessageToolCall>();
        }
    }

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

    public class Function
    {
        public string Name { get; set; }
        public string Arguments { get; set; }

        public Function(string name, string arguments)
        {
            Name = name;
            Arguments = arguments;
        }
    }
}
