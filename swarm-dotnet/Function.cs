using System;
using System.Collections.Generic;

namespace SwarmDotNet
{
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
