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
        private readonly RvmSettings _settings;

        // Pipeline queues
        private BlockingCollection<FrameData> _inferenceQueue;
        private BlockingCollection<ProcessedFrame> _postprocessQueue;

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

        // Pre-allocated buffers to reduce GC pressure
        private byte[]? _bgraBuffer;

        // Temporal smoothing buffer
        private float[]? _prevAlpha;

        public PipelineProcessor(TensorRTInference inference, DeckLinkWrapper deckLink, RvmSettings settings, bool enableOutput = true)
        {
            _inference = inference;
            _deckLink = deckLink;
            _settings = settings;
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

            // Recreate queues if they were completed
            if (_inferenceQueue.IsAddingCompleted)
            {
                _inferenceQueue.Dispose();
                _inferenceQueue = new BlockingCollection<FrameData>(2);
            }
            if (_postprocessQueue.IsAddingCompleted)
            {
                _postprocessQueue.Dispose();
                _postprocessQueue = new BlockingCollection<ProcessedFrame>(2);
            }

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
            if (!_running || _inferenceQueue.IsAddingCompleted) return false;

            // Allocate BGRA buffer once
            const int width = 1920;
            const int height = 1080;
            int bgraSize = width * height * 4;

            if (_bgraBuffer == null || _bgraBuffer.Length != bgraSize)
            {
                _bgraBuffer = new byte[bgraSize];
            }

            // Convert YUV422 to BGRA for inference (reuse buffer)
            ConvertUyvyToBgraInPlace(yuvData, _bgraBuffer, width, height);

            // Create frame with copy of data (since we reuse buffer)
            var frameData = new byte[bgraSize];
            Buffer.BlockCopy(_bgraBuffer, 0, frameData, 0, bgraSize);

            var frame = new FrameData
            {
                Data = frameData,
                Timestamp = Stopwatch.GetTimestamp()
            };

            // Try to add without blocking (drop frame if full)
            try
            {
                return _inferenceQueue.TryAdd(frame);
            }
            catch (InvalidOperationException)
            {
                // Collection was completed between check and add
                return false;
            }
        }

        /// <summary>
        /// Convert UYVY (YUV422) to BGRA in-place (no allocation)
        /// </summary>
        private static void ConvertUyvyToBgraInPlace(byte[] uyvy, byte[] bgra, int width, int height)
        {
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

                    if (alpha != null && !_postprocessQueue.IsAddingCompleted)
                    {
                        var processed = new ProcessedFrame
                        {
                            OriginalData = frame.Data,
                            Alpha = alpha,
                            Timestamp = frame.Timestamp
                        };

                        // Try to pass to next stage
                        try
                        {
                            _postprocessQueue.TryAdd(processed);
                        }
                        catch (InvalidOperationException)
                        {
                            // Collection was completed
                        }
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
        /// Stage 2: Post-processing with RVM settings applied
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

                    // Apply RVM settings to alpha
                    var processedAlpha = ApplyAlphaSettings(frame.Alpha);

                    byte[] output;
                    if (AlphaOnly)
                    {
                        // Alpha channel only (black + alpha)
                        output = CreateAlphaOnlyOutputWithSettings(processedAlpha);
                    }
                    else
                    {
                        // Full BGRA with alpha
                        output = _inference.ApplyAlpha(frame.OriginalData, processedAlpha);
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

        /// <summary>
        /// Apply RVM settings to alpha values
        /// </summary>
        private float[] ApplyAlphaSettings(float[] alpha)
        {
            int pixelCount = alpha.Length;
            var result = new float[pixelCount];

            // Read settings (thread-safe read of current values)
            float minClamp = _settings.MinAlphaClamp;
            float maxClamp = _settings.MaxAlphaClamp;
            float gamma = _settings.GammaCorrection;
            float contrast = _settings.AlphaContrast;
            bool useSoftAlpha = _settings.UseSoftAlpha;
            float threshold = _settings.AlphaThreshold;
            bool temporalSmoothing = _settings.TemporalSmoothing;
            float smoothingStrength = _settings.SmoothingStrength;

            for (int i = 0; i < pixelCount; i++)
            {
                float a = alpha[i];

                // Min/Max clamp with re-normalization
                if (minClamp > 0f || maxClamp < 1f)
                {
                    a = Math.Clamp(a, minClamp, maxClamp);
                    a = (a - minClamp) / (maxClamp - minClamp);
                }

                // Gamma correction
                if (gamma != 1.0f)
                {
                    a = MathF.Pow(a, gamma);
                }

                // Contrast (for soft alpha mode)
                if (useSoftAlpha && contrast != 1.0f)
                {
                    a = Math.Clamp(a * contrast, 0f, 1f);
                }

                // Binary threshold (for hard edge mode)
                if (!useSoftAlpha)
                {
                    a = a > threshold ? 1f : 0f;
                }

                result[i] = a;
            }

            // Temporal smoothing (EMA)
            if (temporalSmoothing && _prevAlpha != null && _prevAlpha.Length == pixelCount)
            {
                for (int i = 0; i < pixelCount; i++)
                {
                    result[i] = smoothingStrength * result[i] + (1f - smoothingStrength) * _prevAlpha[i];
                }
            }

            // Store for next frame
            _prevAlpha = (float[])result.Clone();

            return result;
        }

        /// <summary>
        /// Create alpha-only output with morphological and edge processing
        /// </summary>
        private byte[] CreateAlphaOnlyOutputWithSettings(float[] alpha)
        {
            const int width = 1920;
            const int height = 1080;
            int pixelCount = width * height;

            // Convert float to byte
            var alphaBytes = new byte[pixelCount];
            for (int i = 0; i < pixelCount; i++)
            {
                alphaBytes[i] = (byte)(Math.Clamp(alpha[i], 0f, 1f) * 255f);
            }

            // Apply morphological operations using OpenCV-style processing
            // (simplified without actual OpenCV dependency)
            int erosion = _settings.ErosionSize;
            int dilation = _settings.DilationSize;
            int feather = _settings.FeatherAmount;
            bool edgeRefine = _settings.EdgeRefinement;
            int edgeKernel = _settings.EdgeKernelSize;

            // Apply erosion (shrink)
            if (erosion > 0)
            {
                alphaBytes = ApplyMorphology(alphaBytes, width, height, erosion, false);
            }

            // Apply dilation (expand)
            if (dilation > 0)
            {
                alphaBytes = ApplyMorphology(alphaBytes, width, height, dilation, true);
            }

            // Apply edge refinement (blur)
            if (edgeRefine && edgeKernel > 1)
            {
                alphaBytes = ApplyGaussianBlur(alphaBytes, width, height, edgeKernel);
            }

            // Apply feathering
            if (feather > 0)
            {
                int featherKernel = feather * 2 + 1;
                alphaBytes = ApplyGaussianBlur(alphaBytes, width, height, featherKernel);
            }

            // Create BGRA output
            var output = new byte[pixelCount * 4];
            for (int i = 0; i < pixelCount; i++)
            {
                int idx = i * 4;
                byte a = alphaBytes[i];
                output[idx] = a;     // B
                output[idx + 1] = a; // G
                output[idx + 2] = a; // R
                output[idx + 3] = 255; // A
            }

            return output;
        }

        /// <summary>
        /// Simple box blur (approximation of Gaussian blur)
        /// </summary>
        private static byte[] ApplyGaussianBlur(byte[] data, int width, int height, int kernelSize)
        {
            if (kernelSize < 3) return data;
            int radius = kernelSize / 2;

            var result = new byte[data.Length];

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int sum = 0;
                    int count = 0;

                    for (int ky = -radius; ky <= radius; ky++)
                    {
                        for (int kx = -radius; kx <= radius; kx++)
                        {
                            int nx = x + kx;
                            int ny = y + ky;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height)
                            {
                                sum += data[ny * width + nx];
                                count++;
                            }
                        }
                    }

                    result[y * width + x] = (byte)(sum / count);
                }
            }

            return result;
        }

        /// <summary>
        /// Simple morphology (erosion/dilation)
        /// </summary>
        private static byte[] ApplyMorphology(byte[] data, int width, int height, int size, bool dilate)
        {
            int radius = size;
            var result = new byte[data.Length];

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    byte val = dilate ? (byte)0 : (byte)255;

                    for (int ky = -radius; ky <= radius; ky++)
                    {
                        for (int kx = -radius; kx <= radius; kx++)
                        {
                            int nx = x + kx;
                            int ny = y + ky;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height)
                            {
                                byte sample = data[ny * width + nx];
                                if (dilate)
                                    val = Math.Max(val, sample);
                                else
                                    val = Math.Min(val, sample);
                            }
                        }
                    }

                    result[y * width + x] = val;
                }
            }

            return result;
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
