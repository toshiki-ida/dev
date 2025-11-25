using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace RvmDecklink
{
    /// <summary>
    /// High-performance 3-stage pipeline processor
    /// Stage 1: TensorRT Inference
    /// Stage 2: Post-processing (alpha application)
    /// Stage 3: SDI Output
    /// </summary>
    public class PipelineProcessor : IDisposable
    {
        private readonly TensorRTInference _inference;
        private readonly DeckLinkWrapper _deckLink;
        private readonly bool _enableOutput;

        // Pipeline queues
        private readonly BlockingCollection<FrameData> _inferenceQueue;
        private readonly BlockingCollection<ProcessedFrame> _postprocessQueue;

        // Event for processed frames (for UI preview)
        public event Action<byte[]>? OnProcessedFrame;

        // Pipeline threads
        private Thread? _inferenceThread;
        private Thread? _postprocessThread;

        // Control
        private CancellationTokenSource? _cts;
        private bool _running;

        // Performance stats
        public PipelineStats Stats { get; } = new PipelineStats();

        // Settings
        public bool AlphaOnly { get; set; } = true;  // Output alpha channel only

        private bool _disposed;

        public PipelineProcessor(TensorRTInference inference, DeckLinkWrapper deckLink, bool enableOutput = true)
        {
            _inference = inference;
            _deckLink = deckLink;
            _enableOutput = enableOutput;

            // Bounded queues to prevent memory buildup (drop frames if too slow)
            _inferenceQueue = new BlockingCollection<FrameData>(2);
            _postprocessQueue = new BlockingCollection<ProcessedFrame>(2);
        }

        /// <summary>
        /// Start pipeline processing
        /// </summary>
        public void Start()
        {
            if (_running) return;

            _cts = new CancellationTokenSource();
            _running = true;

            // Start pipeline threads (2 stages: Inference + Postprocess)
            // Output is done directly in PostprocessWorker to avoid COM threading issues
            _inferenceThread = new Thread(InferenceWorker) { Name = "InferenceThread", IsBackground = true };
            _postprocessThread = new Thread(PostprocessWorker) { Name = "PostprocessThread", IsBackground = true };

            _inferenceThread.Start();
            _postprocessThread.Start();

            Console.WriteLine("[PIPELINE] Started with 2 stages (output inline)");
        }

        /// <summary>
        /// Stop pipeline processing
        /// </summary>
        public void Stop()
        {
            if (!_running) return;

            _running = false;
            _cts?.Cancel();

            // Complete queues to unblock threads
            _inferenceQueue.CompleteAdding();
            _postprocessQueue.CompleteAdding();

            // Wait for threads to finish
            _inferenceThread?.Join(1000);
            _postprocessThread?.Join(1000);

            // Clear queues
            while (_inferenceQueue.TryTake(out _)) { }
            while (_postprocessQueue.TryTake(out _)) { }

            Console.WriteLine("[PIPELINE] Stopped");
        }

        /// <summary>
        /// Submit frame for processing (non-blocking)
        /// Drops frame if pipeline is full
        /// Input: YUV422 (UYVY) data from DeckLink (1920x1080x2 bytes)
        /// </summary>
        public bool SubmitFrame(byte[] yuvData)
        {
            if (!_running) return false;

            // Convert YUV422 to BGRA for inference
            byte[] bgraData = ConvertUyvyToBgra(yuvData, 1920, 1080);

            var frame = new FrameData
            {
                Data = bgraData,
                Timestamp = Stopwatch.GetTimestamp()
            };

            // Try to add without blocking (drop frame if full)
            return _inferenceQueue.TryAdd(frame);
        }

        /// <summary>
        /// Convert UYVY (YUV422) to BGRA
        /// </summary>
        private static byte[] ConvertUyvyToBgra(byte[] uyvy, int width, int height)
        {
            var bgra = new byte[width * height * 4];
            int uyvyIndex = 0;
            int bgraIndex = 0;

            for (int i = 0; i < width * height / 2; i++)
            {
                byte u = uyvy[uyvyIndex++];
                byte y0 = uyvy[uyvyIndex++];
                byte v = uyvy[uyvyIndex++];
                byte y1 = uyvy[uyvyIndex++];

                YuvToBgra(y0, u, v, bgra, bgraIndex);
                bgraIndex += 4;
                YuvToBgra(y1, u, v, bgra, bgraIndex);
                bgraIndex += 4;
            }

            return bgra;
        }

        private static void YuvToBgra(byte y, byte u, byte v, byte[] bgra, int index)
        {
            int c = y - 16;
            int d = u - 128;
            int e = v - 128;

            int r = (298 * c + 409 * e + 128) >> 8;
            int g = (298 * c - 100 * d - 208 * e + 128) >> 8;
            int b = (298 * c + 516 * d + 128) >> 8;

            bgra[index] = (byte)Math.Clamp(b, 0, 255);
            bgra[index + 1] = (byte)Math.Clamp(g, 0, 255);
            bgra[index + 2] = (byte)Math.Clamp(r, 0, 255);
            bgra[index + 3] = 255;
        }

        /// <summary>
        /// Stage 1: TensorRT Inference
        /// </summary>
        private void InferenceWorker()
        {
            Console.WriteLine("[PIPELINE] Inference worker started");

            try
            {
                foreach (var frame in _inferenceQueue.GetConsumingEnumerable(_cts!.Token))
                {
                    var sw = Stopwatch.StartNew();

                    // Run TensorRT inference
                    var alpha = _inference.Infer(frame.Data);

                    sw.Stop();
                    Stats.InferenceTimeMs = sw.Elapsed.TotalMilliseconds;

                    if (alpha != null)
                    {
                        var processed = new ProcessedFrame
                        {
                            OriginalData = frame.Data,
                            Alpha = alpha,
                            Timestamp = frame.Timestamp
                        };

                        // Try to pass to next stage
                        _postprocessQueue.TryAdd(processed);
                    }
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Console.WriteLine($"[PIPELINE ERROR] Inference: {ex.Message}");
            }

            Console.WriteLine("[PIPELINE] Inference worker stopped");
        }

        /// <summary>
        /// Stage 2: Post-processing
        /// </summary>
        private void PostprocessWorker()
        {
            Console.WriteLine("[PIPELINE] Postprocess worker started");

            var frameCount = 0;
            var fpsTimer = Stopwatch.StartNew();

            try
            {
                foreach (var frame in _postprocessQueue.GetConsumingEnumerable(_cts!.Token))
                {
                    var sw = Stopwatch.StartNew();

                    byte[] output;
                    if (AlphaOnly)
                    {
                        // Alpha channel only (black + alpha)
                        output = _inference.CreateAlphaOnlyOutput(frame.Alpha);
                    }
                    else
                    {
                        // Full BGRA with alpha
                        output = _inference.ApplyAlpha(frame.OriginalData, frame.Alpha);
                    }

                    sw.Stop();
                    Stats.PostprocessTimeMs = sw.Elapsed.TotalMilliseconds;

                    // Fire event for UI preview
                    OnProcessedFrame?.Invoke(output);

                    // Send to SDI output directly (avoid COM threading issues)
                    if (_enableOutput)
                    {
                        var swOutput = Stopwatch.StartNew();
                        _deckLink.SendFrame(output);
                        swOutput.Stop();
                        Stats.OutputTimeMs = swOutput.Elapsed.TotalMilliseconds;
                    }

                    // Calculate FPS
                    frameCount++;
                    if (fpsTimer.ElapsedMilliseconds >= 1000)
                    {
                        Stats.CurrentFps = frameCount;
                        frameCount = 0;
                        fpsTimer.Restart();
                    }

                    // Update stats
                    Stats.TotalFramesProcessed++;
                    Stats.TotalLatencyMs = (Stopwatch.GetTimestamp() - frame.Timestamp) * 1000.0 / Stopwatch.Frequency;
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Console.WriteLine($"[PIPELINE ERROR] Postprocess: {ex.Message}");
            }

            Console.WriteLine("[PIPELINE] Postprocess worker stopped");
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            Stop();

            _inferenceQueue.Dispose();
            _postprocessQueue.Dispose();
            _cts?.Dispose();

            GC.SuppressFinalize(this);
        }

        // Frame data structures
        private class FrameData
        {
            public byte[] Data { get; set; } = Array.Empty<byte>();
            public long Timestamp { get; set; }
        }

        private class ProcessedFrame
        {
            public byte[] OriginalData { get; set; } = Array.Empty<byte>();
            public float[] Alpha { get; set; } = Array.Empty<float>();
            public long Timestamp { get; set; }
        }
    }

    /// <summary>
    /// Pipeline performance statistics
    /// </summary>
    public class PipelineStats
    {
        public double InferenceTimeMs { get; set; }
        public double PostprocessTimeMs { get; set; }
        public double OutputTimeMs { get; set; }
        public double TotalLatencyMs { get; set; }
        public int CurrentFps { get; set; }
        public long TotalFramesProcessed { get; set; }

        public override string ToString()
        {
            return $"FPS: {CurrentFps}, Latency: {TotalLatencyMs:F1}ms " +
                   $"(Infer: {InferenceTimeMs:F1}ms, Post: {PostprocessTimeMs:F1}ms, Out: {OutputTimeMs:F1}ms)";
        }
    }
}
