using System;
using System.IO;

namespace RvmDecklink
{
    public static class Logger
    {
        private static readonly string LogPath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "debug.log");
        private static readonly object _lock = new object();

        static Logger()
        {
            // Clear log on startup
            try
            {
                File.WriteAllText(LogPath, $"=== Log started at {DateTime.Now} ===\n");
            }
            catch { }
        }

        public static void Log(string message)
        {
            var logMessage = $"[{DateTime.Now:HH:mm:ss.fff}] {message}";

            lock (_lock)
            {
                try
                {
                    File.AppendAllText(LogPath, logMessage + "\n");
                    Console.WriteLine(logMessage);
                }
                catch { }
            }
        }

        public static string GetLogPath() => LogPath;
    }
}
