using System.Collections.Generic;

namespace SwarmDotNet
{
    public class Result
    {
        public string Value { get; set; }
        public Dictionary<string, object> ContextVariables { get; set; }
        public Agent Agent { get; set; }

        public Result()
        {
            ContextVariables = new Dictionary<string, object>();
        }
    }
}
