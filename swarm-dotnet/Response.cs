using System.Collections.Generic;

namespace SwarmDotNet
{
    public class Response
    {
        public List<Dictionary<string, object>> Messages { get; set; }
        public Agent Agent { get; set; }
        public Dictionary<string, object> ContextVariables { get; set; }

        public Response()
        {
            Messages = new List<Dictionary<string, object>>();
            ContextVariables = new Dictionary<string, object>();
        }
    }
}
