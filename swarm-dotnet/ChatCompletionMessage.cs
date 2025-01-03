using System.Collections.Generic;

namespace SwarmDotNet
{
    public class ChatCompletionMessage
    {
        public string Role { get; set; }
        public string Content { get; set; }
        public List<ChatCompletionMessageToolCall> ToolCalls { get; set; }

        public ChatCompletionMessage()
        {
            ToolCalls = new List<ChatCompletionMessageToolCall>();
        }
    }
}
