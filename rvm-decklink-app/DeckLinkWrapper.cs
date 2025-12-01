using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Threading;
using DeckLinkAPI;

namespace RvmDecklink
{
    /// <summary>
    /// DeckLink wrapper using official SDK COM API
    /// </summary>
    public class DeckLinkWrapper : IDisposable, IDeckLinkInputCallback, IDeckLinkVideoOutputCallback, IDeckLinkAudioOutputCallback
    {
        // DeckLink objects
        private IDeckLink? _deckLinkInput;
        private IDeckLink? _deckLinkOutput;
        private IDeckLinkInput? _input;
        private IDeckLinkOutput? _output;
        private IDeckLinkVideoConversion? _videoConversion;

        // Dispatcher for COM threading (must access _output from main thread)
        private Dispatcher? _dispatcher;

        // Video format settings (1080p60 BGRA)
        private readonly int _width = 1920;
        private readonly int _height = 1080;
        private readonly int _frameSize;

        // Events
        public event Action<byte[]>? OnFrameReceived;

        // Status
        public bool IsInputRunning { get; private set; }
        public bool IsOutputRunning { get; private set; }
        public string? InputDeviceName { get; private set; }
        public string? OutputDeviceName { get; private set; }

        // Output scheduling - Use consistent timescale like SignalGenCSharp
        private long _scheduledFrameCount = 0;
        private readonly long _timeScale = 60000; // Time scale matching SignalGenCSharp (60000 for 59.94fps)
        private readonly long _frameDuration = 1001; // Duration: 1001/60000 = ~16.68ms for 59.94fps

        // Preroll management (SignalGenCSharp pattern)
        private const int kVideoPrerollSize = 4; // Need 4 frames before starting playback
        private bool _prerollComplete = false;
        private int _prerollFramesSent = 0;

        // Timer-based output (since ScheduledFrameCompleted callback doesn't work in WPF)
        private System.Windows.Threading.DispatcherTimer? _outputTimer;

        // Audio output settings (required even for video-only output)
        private readonly _BMDAudioSampleRate _audioSampleRate = _BMDAudioSampleRate.bmdAudioSampleRate48kHz;
        private readonly _BMDAudioSampleType _audioSampleType = _BMDAudioSampleType.bmdAudioSampleType16bitInteger;
        private readonly uint _audioChannels = 2;
        private const uint kAudioSamplesPerFrame = 1600; // 48000 Hz / 30 fps = 1600 samples per frame (approximate)
        private const uint kAudioPrerollSize = 9600; // Buffer waterlevel: 1600 samples * 6 frames = 9600 samples
        private long _audioStreamTime = 0; // Audio sample timestamp counter
        private IntPtr _silentAudioBuffer = IntPtr.Zero; // Pre-allocated silent audio buffer

        private bool _disposed;

        public DeckLinkWrapper()
        {
            _frameSize = _width * _height * 4; // BGRA

            // Allocate silent audio buffer (16-bit stereo)
            int audioBufferSize = (int)(kAudioPrerollSize * _audioChannels * 2); // 2 bytes per 16-bit sample
            _silentAudioBuffer = Marshal.AllocHGlobal(audioBufferSize);
            // Zero the buffer (silent audio)
            for (int i = 0; i < audioBufferSize; i++)
            {
                Marshal.WriteByte(_silentAudioBuffer, i, 0);
            }
        }

        /// <summary>
        /// Initialize DeckLink devices
        /// </summary>
        public bool Initialize(int inputDeviceIndex = 0, int outputDeviceIndex = 0)
        {
            try
            {
                // Store dispatcher from current thread (must be UI thread)
                _dispatcher = Dispatcher.CurrentDispatcher;
                Logger.Log($"[INFO] DeckLink initialized on thread {Environment.CurrentManagedThreadId}");

                // Create iterator using CDeckLinkIterator class
                var iterator = new CDeckLinkIterator() as IDeckLinkIterator;
                if (iterator == null)
                {
                    Console.WriteLine("[ERROR] Failed to create DeckLink iterator");
                    return false;
                }

                int deviceCount = 0;
                IDeckLink? device;

                while (true)
                {
                    iterator.Next(out device);
                    if (device == null) break;

                    device.GetDisplayName(out string displayName);
                    Console.WriteLine($"[INFO] Found DeckLink device {deviceCount}: {displayName}");

                    if (deviceCount == inputDeviceIndex)
                    {
                        _deckLinkInput = device;
                        _input = device as IDeckLinkInput;
                        InputDeviceName = displayName;
                    }

                    if (deviceCount == outputDeviceIndex)
                    {
                        if (outputDeviceIndex != inputDeviceIndex)
                        {
                            _deckLinkOutput = device;
                        }
                        else
                        {
                            _deckLinkOutput = _deckLinkInput;
                        }
                        OutputDeviceName = displayName;

                        // Get IDeckLinkOutput via QueryInterface (explicit COM interface query)
                        IntPtr pUnk = Marshal.GetIUnknownForObject(_deckLinkOutput);
                        Guid iidOutput = typeof(IDeckLinkOutput).GUID;
                        int hr = Marshal.QueryInterface(pUnk, ref iidOutput, out IntPtr pOutput);
                        Marshal.Release(pUnk);

                        if (hr == 0 && pOutput != IntPtr.Zero)
                        {
                            _output = (IDeckLinkOutput)Marshal.GetObjectForIUnknown(pOutput);
                            Marshal.Release(pOutput);
                            Console.WriteLine($"[INFO] IDeckLinkOutput obtained via QueryInterface");
                        }
                        else
                        {
                            Console.WriteLine($"[WARN] QueryInterface for IDeckLinkOutput failed: hr=0x{hr:X8}");
                        }
                    }

                    deviceCount++;
                }

                Marshal.ReleaseComObject(iterator);

                if (_deckLinkInput == null)
                {
                    Console.WriteLine("[ERROR] No DeckLink device found");
                    return false;
                }

                Logger.Log($"[INFO] Initialize complete: Input={InputDeviceName}, Output={OutputDeviceName}");
                Logger.Log($"[INFO] _input is null: {_input == null}, _output is null: {_output == null}");

                // Create video conversion for frame copying
                _videoConversion = new CDeckLinkVideoConversion() as IDeckLinkVideoConversion;

                Logger.Log($"[INFO] DeckLink initialized: Input={InputDeviceName}, Output={OutputDeviceName}");
                return true;
            }
            catch (COMException ex)
            {
                Console.WriteLine($"[ERROR] DeckLink COM error: 0x{ex.HResult:X8} - {ex.Message}");
                Console.WriteLine("[INFO] Please ensure DeckLink drivers are installed");
                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] DeckLink initialization failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Start SDI input capture with optional screen preview callback
        /// </summary>
        public bool StartInput(IDeckLinkScreenPreviewCallback? screenPreviewCallback = null, bool enableFrameCallback = true)
        {
            if (_input == null) return false;

            try
            {
                // Set screen preview callback if provided
                if (screenPreviewCallback != null)
                {
                    _input.SetScreenPreviewCallback(screenPreviewCallback);
                }

                // Set input callback only if needed (for frame data processing)
                // Preview-only mode doesn't need the callback which causes E_ACCESSDENIED
                if (enableFrameCallback)
                {
                    _input.SetCallback(this);
                }

                // Enable video input - use native YUV422 format, no format detection
                _input.EnableVideoInput(
                    _BMDDisplayMode.bmdModeHD1080i5994,
                    _BMDPixelFormat.bmdFormat8BitYUV,
                    _BMDVideoInputFlags.bmdVideoInputFlagDefault);

                // Start streams
                _input.StartStreams();

                IsInputRunning = true;
                Console.WriteLine("[INFO] DeckLink input started (1080i59.94 YUV422)");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to start input: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Stop SDI input
        /// </summary>
        public void StopInput()
        {
            if (_input == null || !IsInputRunning) return;

            try
            {
                _input.StopStreams();
                _input.DisableVideoInput();
                _input.SetCallback(null);
                IsInputRunning = false;
                Console.WriteLine("[INFO] DeckLink input stopped");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to stop input: {ex.Message}");
            }
        }

        /// <summary>
        /// Start SDI output with specified display mode
        /// </summary>
        public bool StartOutput(_BMDDisplayMode displayMode = _BMDDisplayMode.bmdModeHD1080i5994)
        {
            if (_output == null) return false;

            try
            {
                // Set callbacks for frame completion and audio (CRITICAL!)
                // Note: 'this' implements both IDeckLinkVideoOutputCallback and IDeckLinkAudioOutputCallback
                Logger.Log($"[INFO] Setting callbacks, this type: {this.GetType().Name}");
                Logger.Log($"[INFO] Implements IDeckLinkVideoOutputCallback: {this is IDeckLinkVideoOutputCallback}");
                Logger.Log($"[INFO] Implements IDeckLinkAudioOutputCallback: {this is IDeckLinkAudioOutputCallback}");

                _output.SetScheduledFrameCompletionCallback(this);
                Logger.Log("[INFO] SetScheduledFrameCompletionCallback succeeded");

                _output.SetAudioCallback(this);
                Logger.Log("[INFO] SetAudioCallback succeeded");

                // Enable video output with selected format
                _output.EnableVideoOutput(
                    displayMode,
                    _BMDVideoOutputFlags.bmdVideoOutputFlagDefault);

                // Enable audio output (REQUIRED even for video-only output!)
                // DeckLink requires audio pipeline to be enabled for scheduled playback to work
                _output.EnableAudioOutput(
                    _audioSampleRate,
                    _audioSampleType,
                    _audioChannels,
                    _BMDAudioOutputStreamType.bmdAudioOutputStreamContinuous);
                Logger.Log("[INFO] Audio output enabled (silent audio for sync)");

                // Begin audio preroll (CRITICAL!)
                _output.BeginAudioPreroll();
                Logger.Log("[INFO] Audio preroll begun");

                // Reset frame and audio counters
                _scheduledFrameCount = 0;
                _prerollComplete = false;
                _prerollFramesSent = 0;
                _audioStreamTime = 0;
                _useExternalFrames = false;
                _completedFrameCount = 0;

                IsOutputRunning = true;

                // Complete preroll with black frames BEFORE returning
                // This ensures preroll is done on UI thread and SendFrame can always buffer frames
                Logger.Log("[INFO] Starting video preroll with black frames...");
                for (int i = 0; i < kVideoPrerollSize; i++)
                {
                    ScheduleBlackFrameForPreroll();
                    _prerollFramesSent++;
                    Logger.Log($"[SDI] Preroll black frame {_prerollFramesSent}/{kVideoPrerollSize} scheduled");
                }

                // Check buffer status
                _output.GetBufferedVideoFrameCount(out uint bufferedFrames);
                Logger.Log($"[SDI] Buffered frames before playback: {bufferedFrames}");

                // End audio preroll
                _output.EndAudioPreroll();
                Logger.Log("[SDI] Audio preroll ended");

                // Start playback
                _output.StartScheduledPlayback(0, _timeScale, 1.0);
                _prerollComplete = true;
                Logger.Log($"[SDI] Preroll complete, playback started with timescale={_timeScale}!");

                // Start timer to continuously schedule frames
                // ScheduledFrameCompleted callback doesn't work reliably in WPF, so use timer instead
                _outputTimer = new System.Windows.Threading.DispatcherTimer();
                _outputTimer.Interval = TimeSpan.FromMilliseconds(8); // ~120 fps check rate
                _outputTimer.Tick += OutputTimer_Tick;
                _outputTimer.Start();
                Logger.Log("[SDI] Output timer started");

                Logger.Log($"[INFO] DeckLink output initialized (mode: {displayMode})");
                return true;
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] Failed to start output: {ex.Message}");
                Logger.Log($"[ERROR] Stack trace: {ex.StackTrace}");
                return false;
            }
        }

        /// <summary>
        /// Get list of common display modes for SDI output
        /// </summary>
        public static List<(string Name, _BMDDisplayMode Mode)> GetOutputDisplayModes()
        {
            return new List<(string, _BMDDisplayMode)>
            {
                ("1080i 59.94", _BMDDisplayMode.bmdModeHD1080i5994),
                ("1080i 50", _BMDDisplayMode.bmdModeHD1080i50),
                ("1080p 59.94", _BMDDisplayMode.bmdModeHD1080p5994),
                ("1080p 50", _BMDDisplayMode.bmdModeHD1080p50),
                ("1080p 60", _BMDDisplayMode.bmdModeHD1080p6000),
                ("1080p 30", _BMDDisplayMode.bmdModeHD1080p30),
                ("1080p 29.97", _BMDDisplayMode.bmdModeHD1080p2997),
                ("1080p 25", _BMDDisplayMode.bmdModeHD1080p25),
                ("1080p 24", _BMDDisplayMode.bmdModeHD1080p24),
                ("1080p 23.98", _BMDDisplayMode.bmdModeHD1080p2398),
                ("720p 59.94", _BMDDisplayMode.bmdModeHD720p5994),
                ("720p 50", _BMDDisplayMode.bmdModeHD720p50),
                ("720p 60", _BMDDisplayMode.bmdModeHD720p60),
            };
        }

        /// <summary>
        /// Stop SDI output
        /// </summary>
        public void StopOutput()
        {
            if (_output == null) return;

            // Set flag FIRST to stop callbacks from processing
            bool wasRunning = IsOutputRunning;
            IsOutputRunning = false;

            if (!wasRunning)
            {
                Logger.Log("[INFO] StopOutput called but output was not running");
                return;
            }

            try
            {
                Logger.Log("[INFO] Stopping DeckLink output...");

                // 1. Stop timer FIRST
                if (_outputTimer != null)
                {
                    var timer = _outputTimer;
                    _outputTimer = null;

                    if (_dispatcher != null && _dispatcher.CheckAccess())
                    {
                        // Already on UI thread
                        timer.Stop();
                        timer.Tick -= OutputTimer_Tick;
                    }
                    else
                    {
                        // Not on UI thread - just stop, don't wait
                        try
                        {
                            timer.Stop();
                        }
                        catch { }
                    }
                    Logger.Log("[INFO] Output timer stopped");
                }

                // 2. DeckLink COM calls - must be in correct order
                if (_output != null)
                {
                    // 2a. Stop playback first
                    try
                    {
                        _output.StopScheduledPlayback(0, out long actualStopTime, _timeScale);
                        Logger.Log("[INFO] Playback stopped");
                    }
                    catch (Exception ex)
                    {
                        Logger.Log($"[WARNING] StopScheduledPlayback failed: {ex.Message}");
                    }

                    // 2b. Clear callbacks
                    try
                    {
                        _output.SetScheduledFrameCompletionCallback(null);
                        _output.SetAudioCallback(null);
                        Logger.Log("[INFO] Callbacks cleared");
                    }
                    catch (Exception ex)
                    {
                        Logger.Log($"[WARNING] Clear callbacks failed: {ex.Message}");
                    }

                    // 2c. Disable outputs
                    try
                    {
                        _output.DisableAudioOutput();
                        Logger.Log("[INFO] Audio output disabled");
                    }
                    catch (Exception ex)
                    {
                        Logger.Log($"[WARNING] DisableAudioOutput failed: {ex.Message}");
                    }

                    try
                    {
                        _output.DisableVideoOutput();
                        Logger.Log("[INFO] Video output disabled");
                    }
                    catch (Exception ex)
                    {
                        Logger.Log($"[WARNING] DisableVideoOutput failed: {ex.Message}");
                    }
                }

                // Reset index for next StartOutput
                _currentFrameIndex = 0;

                // Reset counters for next start
                _scheduledFrameCount = 0;
                _prerollComplete = false;
                _prerollFramesSent = 0;
                _audioStreamTime = 0;
                _audioCallbackCount = 0;
                _completedFrameCount = 0;
                _sendFrameCount = 0;

                // Clear latest frame buffer
                lock (_latestFrameLock)
                {
                    _latestFrame = null;
                    _hasNewFrame = false;
                }

                _useExternalFrames = false;

                // Release frame pool
                foreach (var frame in _outputFramePool)
                {
                    try
                    {
                        Marshal.ReleaseComObject(frame);
                    }
                    catch { }
                }
                _outputFramePool.Clear();

                Logger.Log("[INFO] DeckLink output stopped successfully");
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] Failed to stop output: {ex.Message}");
            }
        }

        // Frame send counter for logging
        private int _sendFrameCount = 0;

        // Frame pool for output (create multiple frames to avoid reusing scheduled frames)
        private const int kFramePoolSize = 8;
        private List<IDeckLinkMutableVideoFrame> _outputFramePool = new List<IDeckLinkMutableVideoFrame>();
        private int _currentFrameIndex = 0;

        // Latest frame buffer for output (written by pipeline, read by callback)
        private byte[]? _latestFrame = null;
        private readonly object _latestFrameLock = new object();
        private bool _hasNewFrame = false;

        /// <summary>
        /// Send frame to SDI output (can be called from any thread)
        /// Preroll is completed in StartOutput, so this always just stores frame in buffer
        /// for ScheduledFrameCompleted callback to send on its thread
        /// </summary>
        public void SendFrame(byte[] frameData)
        {
            _sendFrameCount++;
            if (_sendFrameCount == 1)
            {
                Logger.Log($"[SDI] SendFrame called for first time from thread {Environment.CurrentManagedThreadId}");
            }

            if (_output == null || !IsOutputRunning)
            {
                if (_sendFrameCount % 60 == 1)
                    Logger.Log($"[WARN] SendFrame called but output not running (output={_output != null}, running={IsOutputRunning})");
                return;
            }

            if (frameData.Length != _frameSize)
            {
                Logger.Log($"[ERROR] SendFrame: Invalid frame size {frameData.Length}, expected {_frameSize}");
                return;
            }

            // Always store in buffer for callback to process
            // Preroll is completed in StartOutput, so we don't need to check _prerollComplete
            lock (_latestFrameLock)
            {
                if (_latestFrame == null || _latestFrame.Length != frameData.Length)
                {
                    _latestFrame = new byte[frameData.Length];
                }
                Buffer.BlockCopy(frameData, 0, _latestFrame, 0, frameData.Length);
                _hasNewFrame = true;
            }

            if (_sendFrameCount <= 5 || _sendFrameCount % 120 == 0)
            {
                Logger.Log($"[SDI] SendFrame #{_sendFrameCount}: stored in buffer from thread {Environment.CurrentManagedThreadId}");
            }
        }

        // Pre-allocated buffer for frame output
        private byte[]? _outputFrameBuffer;

        /// <summary>
        /// Get the latest frame for output (called from ScheduledFrameCompleted callback)
        /// Returns null if no new frame is available
        /// </summary>
        private byte[]? GetLatestFrameForOutput()
        {
            lock (_latestFrameLock)
            {
                if (_latestFrame == null) return null;

                // Allocate output buffer once
                if (_outputFrameBuffer == null || _outputFrameBuffer.Length != _latestFrame.Length)
                {
                    _outputFrameBuffer = new byte[_latestFrame.Length];
                }

                if (_hasNewFrame)
                {
                    _hasNewFrame = false;
                }

                // Copy to pre-allocated buffer
                Buffer.BlockCopy(_latestFrame, 0, _outputFrameBuffer, 0, _latestFrame.Length);
                return _outputFrameBuffer;
            }
        }

        private readonly object _frameLock = new object();

        /// <summary>
        /// Internal SendFrame implementation (must run on UI thread)
        /// Based on Blackmagic SignalGenCSharp sample
        /// </summary>
        private void SendFrameInternal(byte[] frameData)
        {
            try
            {
                // Create frame pool on first call
                if (_outputFramePool.Count == 0)
                {
                    // Calculate row bytes for BGRA format
                    _output!.RowBytesForPixelFormat(_BMDPixelFormat.bmdFormat8BitBGRA, _width, out int rowBytes);

                    // Create multiple frames to avoid reusing scheduled frames
                    for (int i = 0; i < kFramePoolSize; i++)
                    {
                        _output.CreateVideoFrame(_width, _height, rowBytes,
                            _BMDPixelFormat.bmdFormat8BitBGRA,
                            _BMDFrameFlags.bmdFrameFlagDefault,
                            out IDeckLinkMutableVideoFrame frame);

                        if (frame == null)
                        {
                            Logger.Log($"[ERROR] Failed to create output frame #{i} via DeckLink API");
                            return;
                        }

                        _outputFramePool.Add(frame);
                    }

                    Logger.Log($"[SDI] Created {kFramePoolSize} DeckLink output frames: {_width}x{_height}, rowBytes={rowBytes}");
                }

                // Get next frame from pool (rotate through frames)
                var outputFrame = _outputFramePool[_currentFrameIndex];
                _currentFrameIndex = (_currentFrameIndex + 1) % kFramePoolSize;

                // Access buffer with StartAccess/EndAccess pattern (SignalGenCSharp BufferAccess pattern)
                var buffer = outputFrame as IDeckLinkVideoBuffer;
                if (buffer == null)
                {
                    Logger.Log($"[ERROR] Cannot cast to IDeckLinkVideoBuffer");
                    return;
                }

                // Start write access
                buffer.StartAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                try
                {
                    // Get buffer pointer and copy data
                    buffer.GetBytes(out IntPtr frameBytes);
                    if (frameBytes != IntPtr.Zero)
                    {
                        Marshal.Copy(frameData, 0, frameBytes, _frameSize);
                    }
                    else
                    {
                        Logger.Log($"[ERROR] GetBytes returned null pointer");
                        return;
                    }
                }
                finally
                {
                    // End write access
                    buffer.EndAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                }

                // Schedule frame for output (SignalGenCSharp pattern)
                long displayTime = _scheduledFrameCount * _frameDuration;
                _output!.ScheduleVideoFrame(outputFrame, displayTime, _frameDuration, _timeScale);
                _scheduledFrameCount++;

                // Preroll management: Start playback after sending preroll frames
                if (!_prerollComplete)
                {
                    _prerollFramesSent++;
                    Logger.Log($"[SDI] Preroll frame {_prerollFramesSent}/{kVideoPrerollSize} scheduled");

                    if (_prerollFramesSent >= kVideoPrerollSize)
                    {
                        // Check buffer status before starting playback
                        _output.GetBufferedVideoFrameCount(out uint bufferedFrames);
                        Logger.Log($"[SDI] Buffered frames before playback: {bufferedFrames}");

                        // End audio preroll (CRITICAL!)
                        _output.EndAudioPreroll();
                        Logger.Log("[SDI] Audio preroll ended");

                        // Start playback now that we have enough frames buffered
                        // IMPORTANT: Use same timescale as ScheduleVideoFrame for consistency
                        _output.StartScheduledPlayback(0, _timeScale, 1.0);
                        _prerollComplete = true;
                        Logger.Log($"[SDI] Preroll complete, playback started with timescale={_timeScale}!");
                    }
                }
                else if (_sendFrameCount % 60 == 1)
                {
                    // Check buffer status periodically
                    _output.GetBufferedVideoFrameCount(out uint bufferedFrames);
                    Logger.Log($"[SDI] Scheduled frame #{_sendFrameCount}, time: {displayTime}, buffered: {bufferedFrames}");
                }
            }
            catch (Exception ex)
            {
                if (_sendFrameCount <= 3 || _sendFrameCount % 60 == 1)
                {
                    Logger.Log($"[ERROR] SendFrameInternal failed: {ex.Message}");
                    Logger.Log($"[ERROR] HResult: 0x{ex.HResult:X8}");
                    if (_sendFrameCount <= 3)
                    {
                        Logger.Log($"[ERROR] StackTrace: {ex.StackTrace}");
                    }
                }
            }
        }

        /// <summary>
        /// Timer tick handler - schedules frames based on buffer status
        /// </summary>
        private void OutputTimer_Tick(object? sender, EventArgs e)
        {
            if (!IsOutputRunning || _output == null) return;

            try
            {
                // Check how many frames are buffered
                _output.GetBufferedVideoFrameCount(out uint bufferedFrames);

                // Keep buffer filled with at least 4 frames
                while (bufferedFrames < 6)
                {
                    if (_useExternalFrames)
                    {
                        // Get frame from pipeline buffer
                        var frameData = GetLatestFrameForOutput();
                        if (frameData != null)
                        {
                            SendFrameInternal(frameData);
                        }
                        else
                        {
                            // No frame available, schedule black
                            ScheduleBlackFrame();
                        }
                    }
                    else
                    {
                        // Test mode: schedule green test frame
                        ScheduleTestFrame();
                    }

                    _output.GetBufferedVideoFrameCount(out bufferedFrames);
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] OutputTimer_Tick: {ex.Message}");
            }
        }

        /// <summary>
        /// Schedule a green test frame
        /// </summary>
        private void ScheduleTestFrame()
        {
            if (_outputFramePool.Count == 0 || _output == null) return;

            try
            {
                var outputFrame = _outputFramePool[_currentFrameIndex];
                _currentFrameIndex = (_currentFrameIndex + 1) % kFramePoolSize;

                var buffer = outputFrame as IDeckLinkVideoBuffer;
                if (buffer == null) return;

                buffer.StartAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                try
                {
                    buffer.GetBytes(out IntPtr frameBytes);
                    if (frameBytes != IntPtr.Zero)
                    {
                        unsafe
                        {
                            byte* ptr = (byte*)frameBytes;
                            for (int i = 0; i < _width * _height; i++)
                            {
                                *ptr++ = 0;   // B
                                *ptr++ = 255; // G (green)
                                *ptr++ = 0;   // R
                                *ptr++ = 255; // A
                            }
                        }
                    }
                }
                finally
                {
                    buffer.EndAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                }

                long displayTime = _scheduledFrameCount * _frameDuration;
                _output.ScheduleVideoFrame(outputFrame, displayTime, _frameDuration, _timeScale);
                _scheduledFrameCount++;

                if (_scheduledFrameCount <= 10 || _scheduledFrameCount % 60 == 0)
                {
                    Logger.Log($"[SDI] Scheduled test frame #{_scheduledFrameCount}");
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] ScheduleTestFrame: {ex.Message}");
            }
        }

        /// <summary>
        /// Schedule a black frame during preroll (creates frame pool if needed)
        /// Called from StartOutput on UI thread
        /// </summary>
        private void ScheduleBlackFrameForPreroll()
        {
            try
            {
                // Create frame pool on first call
                if (_outputFramePool.Count == 0)
                {
                    _output!.RowBytesForPixelFormat(_BMDPixelFormat.bmdFormat8BitBGRA, _width, out int rowBytes);

                    for (int i = 0; i < kFramePoolSize; i++)
                    {
                        _output.CreateVideoFrame(_width, _height, rowBytes,
                            _BMDPixelFormat.bmdFormat8BitBGRA,
                            _BMDFrameFlags.bmdFrameFlagDefault,
                            out IDeckLinkMutableVideoFrame frame);

                        if (frame == null)
                        {
                            Logger.Log($"[ERROR] Failed to create preroll frame #{i}");
                            return;
                        }

                        _outputFramePool.Add(frame);
                    }

                    Logger.Log($"[SDI] Created {kFramePoolSize} DeckLink output frames for preroll");
                }

                // Get next frame from pool
                var outputFrame = _outputFramePool[_currentFrameIndex];
                _currentFrameIndex = (_currentFrameIndex + 1) % kFramePoolSize;

                // Fill with black
                var buffer = outputFrame as IDeckLinkVideoBuffer;
                if (buffer == null) return;

                buffer.StartAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                try
                {
                    buffer.GetBytes(out IntPtr frameBytes);
                    if (frameBytes != IntPtr.Zero)
                    {
                        unsafe
                        {
                            byte* ptr = (byte*)frameBytes;
                            for (int i = 0; i < _width * _height; i++)
                            {
                                *ptr++ = 0;   // B
                                *ptr++ = 0;   // G
                                *ptr++ = 0;   // R
                                *ptr++ = 255; // A
                            }
                        }
                    }
                }
                finally
                {
                    buffer.EndAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                }

                // Schedule the frame
                long displayTime = _scheduledFrameCount * _frameDuration;
                _output!.ScheduleVideoFrame(outputFrame, displayTime, _frameDuration, _timeScale);
                _scheduledFrameCount++;
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] ScheduleBlackFrameForPreroll failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Schedule a black frame (used for keeping buffer filled)
        /// </summary>
        private void ScheduleBlackFrame()
        {
            if (_outputFramePool.Count == 0 || _output == null) return;

            try
            {
                // Get next frame from pool
                var outputFrame = _outputFramePool[_currentFrameIndex];
                _currentFrameIndex = (_currentFrameIndex + 1) % kFramePoolSize;

                // Clear frame to black (BGRA = 0,0,0,255)
                var buffer = outputFrame as IDeckLinkVideoBuffer;
                if (buffer == null) return;

                buffer.StartAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                try
                {
                    buffer.GetBytes(out IntPtr frameBytes);
                    if (frameBytes != IntPtr.Zero)
                    {
                        // Fill with black (B=0, G=0, R=0, A=255)
                        unsafe
                        {
                            byte* ptr = (byte*)frameBytes;
                            for (int i = 0; i < _width * _height; i++)
                            {
                                *ptr++ = 0;   // B
                                *ptr++ = 0;   // G
                                *ptr++ = 0;   // R
                                *ptr++ = 255; // A
                            }
                        }
                    }
                }
                finally
                {
                    buffer.EndAccess(_BMDBufferAccessFlags.bmdBufferAccessWrite);
                }

                // Schedule the frame
                long displayTime = _scheduledFrameCount * _frameDuration;
                _output.ScheduleVideoFrame(outputFrame, displayTime, _frameDuration, _timeScale);
                _scheduledFrameCount++;
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] ScheduleBlackFrame failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Get list of available DeckLink devices
        /// </summary>
        public static List<string> GetDeviceList()
        {
            var devices = new List<string>();

            try
            {
                var iterator = new CDeckLinkIterator() as IDeckLinkIterator;
                if (iterator == null) return devices;

                IDeckLink? device;
                while (true)
                {
                    iterator.Next(out device);
                    if (device == null) break;

                    device.GetDisplayName(out string name);
                    devices.Add(name);
                    Marshal.ReleaseComObject(device);
                }

                Marshal.ReleaseComObject(iterator);
            }
            catch
            {
                // DeckLink not available
            }

            return devices;
        }

        #region IDeckLinkInputCallback

        public void VideoInputFormatChanged(
            _BMDVideoInputFormatChangedEvents notificationEvents,
            IDeckLinkDisplayMode newDisplayMode,
            _BMDDetectedVideoInputFormatFlags detectedSignalFlags)
        {
            newDisplayMode.GetName(out string modeName);
            Console.WriteLine($"[INFO] Input format changed to: {modeName}, flags: {detectedSignalFlags}");
            // Note: Not switching format dynamically to avoid COM issues
        }

        private int _frameCount = 0;
        private int _noSignalCount = 0;

        // IDeckLinkVideoOutputCallback implementation
        private int _completedFrameCount = 0;
        private bool _useExternalFrames = false; // Set to true when pipeline is providing frames

        /// <summary>
        /// Enable external frame mode (frames come from pipeline via SendFrame)
        /// </summary>
        public void SetExternalFrameMode(bool enabled)
        {
            _useExternalFrames = enabled;
            Logger.Log($"[SDI] External frame mode: {enabled}");
        }

        public void ScheduledFrameCompleted(IDeckLinkVideoFrame completedFrame, _BMDOutputFrameCompletionResult result)
        {
            try
            {
                if (!IsOutputRunning) return;

                _completedFrameCount++;

                // Always log first few callbacks to confirm callback is working
                if (_completedFrameCount <= 20 || _completedFrameCount % 120 == 0)
                {
                    Logger.Log($"[SDI CALLBACK] Frame completed: #{_completedFrameCount}, result={result}, thread={Environment.CurrentManagedThreadId}");
                }

                // COM access must be on UI thread - dispatch the actual frame scheduling
                if (_dispatcher != null && !_dispatcher.CheckAccess())
                {
                    _dispatcher.BeginInvoke(new Action(() =>
                    {
                        if (IsOutputRunning)
                        {
                            ScheduleNextFrameFromCallback();
                        }
                    }));
                }
                else
                {
                    ScheduleNextFrameFromCallback();
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"[SDI CALLBACK ERROR] {ex.Message}");
            }
        }

        /// <summary>
        /// Schedule next frame - called from ScheduledFrameCompleted via dispatcher
        /// </summary>
        private void ScheduleNextFrameFromCallback()
        {
            try
            {
                if (!IsOutputRunning) return;

                // Schedule next frame from the buffer (if external frames are being used)
                // or schedule a test pattern (for TestSDI mode)
                if (_useExternalFrames)
                {
                    // Get the latest frame from the pipeline
                    var frameData = GetLatestFrameForOutput();
                    if (frameData != null)
                    {
                        SendFrameInternal(frameData);
                    }
                    else
                    {
                        // No frame available yet, schedule black frame to keep output running
                        if (_completedFrameCount <= 10)
                        {
                            Logger.Log($"[SDI] No frame available yet, scheduling black frame");
                        }
                        ScheduleBlackFrame();
                    }
                }
                else
                {
                    // Test mode: schedule next test frame
                    ScheduleNextFrame();
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"[SDI] ScheduleNextFrameFromCallback error: {ex.Message}");
            }
        }

        private void ScheduleNextFrame()
        {
            if (_completedFrameCount <= 10 || _completedFrameCount % 60 == 0)
            {
                Logger.Log($"[SCHEDULE] ScheduleNextFrame called from thread {Environment.CurrentManagedThreadId}");
            }

            if (_output == null)
            {
                Logger.Log($"[ERROR] ScheduleNextFrame: _output is null");
                return;
            }

            if (!IsOutputRunning)
            {
                Logger.Log($"[ERROR] ScheduleNextFrame: IsOutputRunning is false");
                return;
            }

            try
            {
                // Create a test pattern frame (green screen)
                byte[] testFrame = new byte[_frameSize];
                unsafe
                {
                    fixed (byte* ptr = testFrame)
                    {
                        byte* p = ptr;
                        for (int i = 0; i < _width * _height; i++)
                        {
                            *p++ = 0;    // B
                            *p++ = 255;  // G (green)
                            *p++ = 0;    // R
                            *p++ = 255;  // A
                        }
                    }
                }

                if (_completedFrameCount <= 10)
                {
                    Logger.Log($"[SCHEDULE] Calling SendFrame with green test pattern");
                }
                SendFrame(testFrame);
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] ScheduleNextFrame failed: {ex.Message}\nStackTrace: {ex.StackTrace}");
            }
        }

        public void ScheduledPlaybackHasStopped()
        {
            Logger.Log("[INFO] Scheduled playback has stopped");
        }

        // IDeckLinkAudioOutputCallback implementation
        private int _audioCallbackCount = 0;
        public void RenderAudioSamples(int preroll)
        {
            // This callback is called by DeckLink when it needs audio samples
            // Following SignalGenCSharp pattern: use ScheduleAudioSamples with timestamps, not WriteAudioSamplesSync

            _audioCallbackCount++;
            if (_audioCallbackCount <= 5 || _audioCallbackCount % 120 == 0)
            {
                Logger.Log($"[AUDIO CALLBACK] RenderAudioSamples called: preroll={preroll}, count={_audioCallbackCount}, thread={Environment.CurrentManagedThreadId}");
            }

            if (_output == null) return;

            try
            {
                // Check if still running before processing
                if (!IsOutputRunning) return;

                // CRITICAL: ALL COM access must be on UI thread
                // Use BeginInvoke (async) instead of Invoke (sync) to prevent deadlock on stop
                if (_dispatcher != null && !_dispatcher.CheckAccess())
                {
                    // We're on DeckLink's thread, marshal EVERYTHING to UI thread
                    _dispatcher.BeginInvoke(new Action(() =>
                    {
                        if (IsOutputRunning) // Double-check after dispatch
                        {
                            RenderAudioSamplesInternal();
                        }
                    }));
                }
                else
                {
                    // Already on UI thread
                    RenderAudioSamplesInternal();
                }
            }
            catch (Exception ex)
            {
                if (_audioCallbackCount <= 5)
                {
                    Logger.Log($"[ERROR] Audio callback failed: {ex.Message}");
                }
            }
        }

        private void RenderAudioSamplesInternal()
        {
            if (_output == null || !IsOutputRunning) return;

            try
            {
                // Check how many audio samples are currently buffered
                _output.GetBufferedAudioSampleFrameCount(out uint bufferedAudioSamples);

                // Log buffer status for debugging (more frequently during initial phase)
                if (_audioCallbackCount <= 10 || _audioCallbackCount % 60 == 0)
                {
                    Logger.Log($"[AUDIO DEBUG] Callback #{_audioCallbackCount}: buffered={bufferedAudioSamples}, waterlevel={kAudioPrerollSize}");
                }

                // Maintain audio buffer at specified waterlevel (SignalGenCSharp pattern)
                // ALWAYS fill buffer when below waterlevel
                if (bufferedAudioSamples < kAudioPrerollSize)
                {
                    uint samplesToWrite = kAudioPrerollSize - bufferedAudioSamples;

                    // Use ScheduleAudioSamples with timestamp (NOT WriteAudioSamplesSync)
                    _output.ScheduleAudioSamples(_silentAudioBuffer, samplesToWrite,
                        _audioStreamTime, 48000, out uint samplesWritten);
                    _audioStreamTime += samplesWritten;

                    if (_audioCallbackCount <= 10)
                    {
                        Logger.Log($"[AUDIO] Scheduled {samplesWritten}/{samplesToWrite} silent audio samples, time={_audioStreamTime}");
                    }
                }
            }
            catch (Exception ex)
            {
                if (_audioCallbackCount <= 10)
                {
                    Logger.Log($"[ERROR] RenderAudioSamplesInternal failed: {ex.Message}");
                }
            }
        }

        // IDeckLinkInputCallback implementation
        public void VideoInputFrameArrived(
            IDeckLinkVideoInputFrame? videoFrame,
            IDeckLinkAudioInputPacket? audioPacket)
        {
            if (videoFrame == null) return;

            try
            {
                _frameCount++;

                // Get frame dimensions and check for valid signal
                int width = videoFrame.GetWidth();
                int height = videoFrame.GetHeight();
                int rowBytes = videoFrame.GetRowBytes();

                // Check for no input source flag
                var flags = videoFrame.GetFlags();
                bool hasNoInputSource = flags.HasFlag(_BMDFrameFlags.bmdFrameHasNoInputSource);

                if (_frameCount % 60 == 1)
                {
                    Console.WriteLine($"[INFO] Frame {_frameCount}: {width}x{height}, rowBytes={rowBytes}, flags={flags}, noInput={hasNoInputSource}");
                }

                // Skip frames with no input source
                if (hasNoInputSource)
                {
                    _noSignalCount++;
                    return;
                }

                // Get frame bytes using QueryInterface for IDeckLinkVideoBuffer
                IntPtr pUnk = Marshal.GetIUnknownForObject(videoFrame);
                Guid iidVideoBuffer = typeof(IDeckLinkVideoBuffer).GUID;
                int hr = Marshal.QueryInterface(pUnk, ref iidVideoBuffer, out IntPtr pBuffer);
                Marshal.Release(pUnk);

                if (hr == 0 && pBuffer != IntPtr.Zero)
                {
                    try
                    {
                        var buffer = (IDeckLinkVideoBuffer)Marshal.GetObjectForIUnknown(pBuffer);

                        // Start read access before getting bytes
                        buffer.StartAccess(_BMDBufferAccessFlags.bmdBufferAccessRead);
                        try
                        {
                            buffer.GetBytes(out IntPtr frameBytes);

                            if (frameBytes != IntPtr.Zero)
                            {
                                int frameSize = rowBytes * height;
                                var frameData = new byte[frameSize];
                                Marshal.Copy(frameBytes, frameData, 0, frameSize);

                                if (_frameCount % 60 == 1)
                                {
                                    Console.WriteLine($"[DEBUG] Frame data: size={frameSize}, first bytes: {frameData[0]:X2} {frameData[1]:X2} {frameData[2]:X2} {frameData[3]:X2}");
                                }

                                OnFrameReceived?.Invoke(frameData);
                            }
                        }
                        finally
                        {
                            // End read access
                            buffer.EndAccess(_BMDBufferAccessFlags.bmdBufferAccessRead);
                        }
                    }
                    finally
                    {
                        Marshal.Release(pBuffer);
                    }
                }
                else
                {
                    if (_frameCount <= 3)
                        Console.WriteLine($"[WARN] QueryInterface failed: hr=0x{hr:X8}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Frame callback error: {ex.Message}");
            }
        }

        #endregion

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            Logger.Log("[DISPOSE] DeckLinkWrapper.Dispose() called");

            // Stop input first
            StopInput();

            // Stop output properly (this handles timer, callbacks, etc.)
            StopOutput();

            // Free silent audio buffer
            if (_silentAudioBuffer != IntPtr.Zero)
            {
                Marshal.FreeHGlobal(_silentAudioBuffer);
                _silentAudioBuffer = IntPtr.Zero;
            }

            // Brief wait for any pending operations
            Thread.Sleep(20);

            // Release COM objects in reverse order of creation
            if (_videoConversion != null)
            {
                try { Marshal.ReleaseComObject(_videoConversion); } catch { }
                _videoConversion = null;
            }

            if (_output != null)
            {
                try { Marshal.ReleaseComObject(_output); } catch { }
                _output = null;
            }

            if (_input != null)
            {
                try { Marshal.ReleaseComObject(_input); } catch { }
                _input = null;
            }

            if (_deckLinkOutput != null && _deckLinkOutput != _deckLinkInput)
            {
                try { Marshal.ReleaseComObject(_deckLinkOutput); } catch { }
                _deckLinkOutput = null;
            }

            if (_deckLinkInput != null)
            {
                try { Marshal.ReleaseComObject(_deckLinkInput); } catch { }
                _deckLinkInput = null;
            }

            Logger.Log("[DISPOSE] DeckLinkWrapper.Dispose() completed");
            GC.SuppressFinalize(this);
        }
    }

    /// <summary>
    /// Managed video frame for DeckLink output
    /// Implements IDeckLinkMutableVideoFrame instead of IDeckLinkVideoFrame
    /// </summary>
    [System.Runtime.InteropServices.ComVisible(true)]
    internal class ManagedVideoFrame : IDeckLinkMutableVideoFrame
    {
        private readonly int _width;
        private readonly int _height;
        private readonly int _rowBytes;
        private readonly _BMDPixelFormat _pixelFormat;
        private readonly byte[] _data;
        private GCHandle _handle;
        private IntPtr _dataPtr;

        public ManagedVideoFrame(int width, int height, _BMDPixelFormat pixelFormat)
        {
            _width = width;
            _height = height;
            _pixelFormat = pixelFormat;

            // Calculate row bytes based on pixel format
            int bytesPerPixel = pixelFormat == _BMDPixelFormat.bmdFormat8BitBGRA ? 4 : 2;
            _rowBytes = width * bytesPerPixel;

            _data = new byte[_rowBytes * height];
            _handle = GCHandle.Alloc(_data, GCHandleType.Pinned);
            _dataPtr = _handle.AddrOfPinnedObject();
        }

        // IDeckLinkVideoFrame methods
        public int GetWidth() => _width;
        public int GetHeight() => _height;
        public int GetRowBytes() => _rowBytes;
        public _BMDPixelFormat GetPixelFormat() => _pixelFormat;
        public _BMDFrameFlags GetFlags() => _BMDFrameFlags.bmdFrameFlagDefault;

        public void GetBytes(out IntPtr buffer)
        {
            buffer = _dataPtr;
        }

        public void GetTimecode(_BMDTimecodeFormat format, out IDeckLinkTimecode timecode)
        {
            timecode = null!;
        }

        public void GetAncillaryData(out IDeckLinkVideoFrameAncillary ancillary)
        {
            ancillary = null!;
        }

        // IDeckLinkMutableVideoFrame methods
        public void SetFlags(_BMDFrameFlags newFlags)
        {
            // Not implemented - flags are fixed
        }

        public void SetTimecode(_BMDTimecodeFormat format, IDeckLinkTimecode timecode)
        {
            // Not implemented
        }

        public void SetTimecodeFromComponents(_BMDTimecodeFormat format, byte hours, byte minutes, byte seconds, byte frames, _BMDTimecodeFlags flags)
        {
            // Not implemented
        }

        public void SetAncillaryData(IDeckLinkVideoFrameAncillary ancillary)
        {
            // Not implemented
        }

        public void SetTimecodeUserBits(_BMDTimecodeFormat format, uint userBits)
        {
            // Not implemented
        }

        public void SetInterfaceProvider(ref Guid riid, object provider)
        {
            // Not implemented
        }

        public byte[] GetData()
        {
            return _data;
        }

        ~ManagedVideoFrame()
        {
            if (_handle.IsAllocated)
                _handle.Free();
        }
    }
}
