using System;
using System.Collections.Generic;

namespace SwarmDotNet
{
    public static class Util
    {
        public static Dictionary<string, object> FunctionToJson(Func<Dictionary<string, object>, string> function)
        {
            return new Dictionary<string, object>
            {
                { "type", "function" },
                { "function", new Dictionary<string, object>
                    {
                        { "name", function.Method.Name },
                        { "description", "" },
                        { "parameters", new Dictionary<string, object>
                            {
                                { "type", "object" },
                                { "properties", new Dictionary<string, object>() },
                                { "required", new List<string>() }
                            }
                        }
                    }
                }
            };
        }

        public static void MergeChunk(Dictionary<string, object> message, Dictionary<string, object> delta)
        {
            foreach (var kvp in delta)
            {
                if (kvp.Value is Dictionary<string, object> dictValue)
                {
                    if (!message.ContainsKey(kvp.Key))
                    {
                        message[kvp.Key] = new Dictionary<string, object>();
                    }
                    MergeChunk((Dictionary<string, object>)message[kvp.Key], dictValue);
                }
                else if (kvp.Value is List<object> listValue)
                {
                    if (!message.ContainsKey(kvp.Key))
                    {
                        message[kvp.Key] = new List<object>();
                    }
                    ((List<object>)message[kvp.Key]).AddRange(listValue);
                }
                else
                {
                    message[kvp.Key] = kvp.Value;
                }
            }
        }
    }
}
