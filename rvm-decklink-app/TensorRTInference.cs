using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace RvmDecklink
{
    /// <summary>
    /// TensorRT inference engine using ONNX Runtime
    /// Uses stateless RVM model for optimal TensorRT performance
    /// </summary>
    public class TensorRTInference : IDisposable
    {
        // Use Logger for file logging
        private static void Log(string message) => Logger.Log(message);
        private InferenceSession? _session;
        private readonly string _modelPath;
        private readonly string _cacheDir;

        // Model input/output names
        private const string InputName = "src";
        private const string OutputName = "pha";

        // Expected dimensions
        private readonly int _width = 1920;
        private readonly int _height = 1080;

        // Performance stats
        public double LastInferenceTimeMs { get; private set; }
        public bool IsInitialized => _session != null;

        private bool _disposed;

        // Pre-allocated buffers to reduce GC pressure
        private float[]? _rgbBuffer;
        private byte[]? _alphaOutputBuffer;

        public TensorRTInference(string modelPath, string? cacheDir = null)
        {
            _modelPath = modelPath;
            _cacheDir = cacheDir ?? Path.Combine(Path.GetDirectoryName(modelPath) ?? ".", "trt_cache");
        }

        /// <summary>
        /// Initialize TensorRT inference session
        /// First run will compile the TensorRT engine (takes 5-10 minutes)
        /// Subsequent runs use cached engine (fast startup)
        /// </summary>
        public bool Initialize()
        {
            try
            {
                Log($"[INFO] TensorRT Initialize() starting...");
                Log($"[INFO] Model path: {_modelPath}");
                Log($"[INFO] Cache directory: {_cacheDir}");

                // Check if model exists
                if (!File.Exists(_modelPath))
                {
                    Log($"[ERROR] Model not found: {_modelPath}");
                    Log($"[ERROR] Current directory: {Environment.CurrentDirectory}");
                    Log($"[ERROR] App base directory: {AppDomain.CurrentDomain.BaseDirectory}");
                    return false;
                }

                var modelFileInfo = new FileInfo(_modelPath);
                Log($"[INFO] Model file size: {modelFileInfo.Length / 1024.0 / 1024.0:F2} MB");

                // Create cache directory
                Directory.CreateDirectory(_cacheDir);
                Log($"[INFO] TensorRT cache directory created/verified: {_cacheDir}");

                // Configure TensorRT Execution Provider
                var sessionOptions = new SessionOptions();

                // TensorRT provider options for maximum performance
                var tensorrtOptions = new Dictionary<string, string>
                {
                    { "device_id", "0" },
                    { "trt_max_workspace_size", "4294967296" },  // 4GB
                    { "trt_fp16_enable", "1" },                  // Enable FP16 for speed
                    { "trt_engine_cache_enable", "1" },          // Enable engine caching
                    { "trt_engine_cache_path", _cacheDir },      // Cache directory
                    { "trt_max_partition_iterations", "1000" },
                    { "trt_min_subgraph_size", "1" },
                    { "trt_builder_optimization_level", "3" }    // Maximum optimization
                };

                // Add TensorRT provider (falls back to CUDA if TensorRT fails)
                bool tensorrtConfigured = false;
                try
                {
                    Log("[INFO] Attempting to configure TensorRT Execution Provider...");
                    // TensorRT provider with options
                    var trtProviderOptions = new OrtTensorRTProviderOptions();
                    trtProviderOptions.UpdateOptions(tensorrtOptions);
                    sessionOptions.AppendExecutionProvider_Tensorrt(trtProviderOptions);
                    Log("[INFO] TensorRT Execution Provider configured successfully");
                    tensorrtConfigured = true;
                }
                catch (Exception ex)
                {
                    Log($"[WARNING] TensorRT EP not available: {ex.Message}");
                    if (ex.InnerException != null)
                    {
                        Log($"[WARNING] Inner exception: {ex.InnerException.Message}");
                    }
                    Log("[INFO] Will fall back to CUDA Execution Provider");
                }

                // Add CUDA as fallback
                try
                {
                    Log("[INFO] Configuring CUDA Execution Provider...");
                    sessionOptions.AppendExecutionProvider_CUDA();
                    Log("[INFO] CUDA Execution Provider configured successfully");
                }
                catch (Exception ex)
                {
                    Log($"[WARNING] CUDA EP configuration failed: {ex.Message}");
                    if (ex.InnerException != null)
                    {
                        Log($"[WARNING] Inner exception: {ex.InnerException.Message}");
                    }
                }

                // Add CPU as final fallback
                Log("[INFO] Adding CPU Execution Provider as final fallback");
                sessionOptions.AppendExecutionProvider_CPU(0);

                // Performance optimizations
                sessionOptions.EnableMemoryPattern = true;
                sessionOptions.EnableCpuMemArena = true;
                sessionOptions.GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL;
                sessionOptions.ExecutionMode = ExecutionMode.ORT_PARALLEL;
                sessionOptions.InterOpNumThreads = Environment.ProcessorCount;
                sessionOptions.IntraOpNumThreads = Environment.ProcessorCount;

                // Check for cached engine
                bool hasCachedEngine = Directory.GetFiles(_cacheDir, "*.engine").Length > 0;
                if (hasCachedEngine)
                {
                    Log("[INFO] Found cached TensorRT engine - fast startup expected");
                }
                else
                {
                    Log("[INFO] No cached engine found - first run will compile TensorRT engine");
                    Log("[INFO] This may take 5-10 minutes. Please wait...");
                }

                // Create session (this triggers TensorRT compilation on first run)
                var startTime = DateTime.Now;
                _session = new InferenceSession(_modelPath, sessionOptions);
                var loadTime = (DateTime.Now - startTime).TotalSeconds;

                Log($"[INFO] Model loaded in {loadTime:F2} seconds");

                // Log session info
                Log($"[INFO] Input: {_session.InputNames[0]}");
                Log($"[INFO] Output: {_session.OutputNames[0]}");

                // Warmup run
                Log("[INFO] Running warmup inference...");
                WarmUp();
                Log("[INFO] TensorRT inference engine ready");

                return true;
            }
            catch (Exception ex)
            {
                Log($"[ERROR] Failed to initialize TensorRT: {ex.Message}");
                Log($"[ERROR] Exception type: {ex.GetType().FullName}");
                if (ex.InnerException != null)
                {
                    Log($"[ERROR] Inner exception: {ex.InnerException.Message}");
                    Log($"[ERROR] Inner exception type: {ex.InnerException.GetType().FullName}");
                }
                Log($"[ERROR] Stack trace: {ex.StackTrace}");
                return false;
            }
        }

        /// <summary>
        /// Warmup run to trigger TensorRT compilation
        /// </summary>
        private void WarmUp()
        {
            Log("[INFO] Creating warmup tensor...");
            var dummyInput = new float[1 * 3 * _height * _width];
            var tensor = new DenseTensor<float>(dummyInput, new[] { 1, 3, _height, _width });

            var inputs = new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor(InputName, tensor)
            };

            Log("[INFO] Starting warmup inference run...");
            var startTime = DateTime.Now;
            try
            {
                using var results = _session!.Run(inputs);
                LastInferenceTimeMs = (DateTime.Now - startTime).TotalMilliseconds;
                Log($"[INFO] Warmup inference completed: {LastInferenceTimeMs:F2}ms");
            }
            catch (Exception ex)
            {
                Log($"[ERROR] Warmup inference failed: {ex.Message}");
                Log($"[ERROR] Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        /// <summary>
        /// Run inference on input frame
        /// </summary>
        /// <param name="inputBgra">BGRA frame data (1920x1080x4)</param>
        /// <returns>Alpha mask (1920x1080) as float array [0-1]</returns>
        public float[]? Infer(byte[] inputBgra)
        {
            if (_session == null) return null;

            try
            {
                var startTime = DateTime.Now;

                // Convert BGRA to RGB float tensor
                var inputTensor = PreprocessFrame(inputBgra);

                // Create input
                var inputs = new List<NamedOnnxValue>
                {
                    NamedOnnxValue.CreateFromTensor(InputName, inputTensor)
                };

                // Run inference
                using var results = _session.Run(inputs);

                // Get output
                var outputTensor = results.First().AsTensor<float>();
                var output = outputTensor.ToArray();

                LastInferenceTimeMs = (DateTime.Now - startTime).TotalMilliseconds;

                return output;
            }
            catch (Exception ex)
            {
                Log($"[ERROR] Inference failed: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Run inference and return alpha as byte array
        /// </summary>
        public byte[]? InferAlpha(byte[] inputBgra)
        {
            var alphaFloat = Infer(inputBgra);
            if (alphaFloat == null) return null;

            // Convert float [0-1] to byte [0-255]
            var alphaBytes = new byte[alphaFloat.Length];
            for (int i = 0; i < alphaFloat.Length; i++)
            {
                alphaBytes[i] = (byte)(Math.Clamp(alphaFloat[i], 0f, 1f) * 255f);
            }

            return alphaBytes;
        }

        /// <summary>
        /// Preprocess frame: BGRA -> RGB float tensor [0-1]
        /// </summary>
        private DenseTensor<float> PreprocessFrame(byte[] bgra)
        {
            int rgbSize = 3 * _height * _width;

            // Allocate buffer once
            if (_rgbBuffer == null || _rgbBuffer.Length != rgbSize)
            {
                _rgbBuffer = new float[rgbSize];
            }

            // Convert BGRA to RGB and normalize to [0-1]
            // Layout: NCHW (batch, channel, height, width)
            int pixelCount = _height * _width;

            for (int i = 0; i < pixelCount; i++)
            {
                int bgraIdx = i * 4;
                // BGRA -> RGB
                _rgbBuffer[i] = bgra[bgraIdx + 2] / 255f;                    // R channel
                _rgbBuffer[pixelCount + i] = bgra[bgraIdx + 1] / 255f;      // G channel
                _rgbBuffer[2 * pixelCount + i] = bgra[bgraIdx] / 255f;      // B channel
            }

            return new DenseTensor<float>(_rgbBuffer, new[] { 1, 3, _height, _width });
        }

        /// <summary>
        /// Apply alpha to create BGRA output with alpha channel
        /// </summary>
        public byte[] ApplyAlpha(byte[] inputBgra, float[] alpha)
        {
            var output = new byte[_width * _height * 4];
            int pixelCount = _width * _height;

            for (int i = 0; i < pixelCount; i++)
            {
                int idx = i * 4;
                byte a = (byte)(Math.Clamp(alpha[i], 0f, 1f) * 255f);

                // Copy BGR from input, set alpha
                output[idx] = inputBgra[idx];         // B
                output[idx + 1] = inputBgra[idx + 1]; // G
                output[idx + 2] = inputBgra[idx + 2]; // R
                output[idx + 3] = a;                   // A
            }

            return output;
        }

        /// <summary>
        /// Create output with only alpha channel (black + alpha)
        /// </summary>
        public byte[] CreateAlphaOnlyOutput(float[] alpha)
        {
            int outputSize = _width * _height * 4;

            // Allocate buffer once
            if (_alphaOutputBuffer == null || _alphaOutputBuffer.Length != outputSize)
            {
                _alphaOutputBuffer = new byte[outputSize];
            }

            int pixelCount = _width * _height;

            for (int i = 0; i < pixelCount; i++)
            {
                int idx = i * 4;
                byte a = (byte)(Math.Clamp(alpha[i], 0f, 1f) * 255f);

                // White silhouette on black background (for SDI output)
                // Alpha value determines grayscale: person=white, background=black
                _alphaOutputBuffer[idx] = a;     // B = alpha (white where person is)
                _alphaOutputBuffer[idx + 1] = a; // G = alpha
                _alphaOutputBuffer[idx + 2] = a; // R = alpha
                _alphaOutputBuffer[idx + 3] = 255; // A = full opacity
            }

            return _alphaOutputBuffer;
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            _session?.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}
