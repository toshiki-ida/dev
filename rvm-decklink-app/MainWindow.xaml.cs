using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using DeckLinkAPI;

namespace RvmDecklink
{
    public partial class MainWindow : Window
    {
        // Components
        private DeckLinkWrapper? _deckLink;
        private TensorRTInference? _inference;
        private PipelineProcessor? _pipeline;

        // State
        private bool _isProcessing;
        private bool _isPreviewing;

        // Output format list
        private List<(string Name, _BMDDisplayMode Mode)> _outputFormats = new();

        // UI update timer
        private DispatcherTimer? _statsTimer;

        // Model path
        private readonly string _modelPath;

        // WriteableBitmap for preview
        private WriteableBitmap? _previewBitmap;

        // RVM Settings
        public RvmSettings Settings { get; } = new RvmSettings();
        private SettingsWindow? _settingsWindow;

        public MainWindow()
        {
            InitializeComponent();

            // Set model path
            var appDir = AppDomain.CurrentDomain.BaseDirectory;
            _modelPath = Path.Combine(appDir, "Models", "rvm_mobilenetv3_stateless.onnx");

            // Load saved settings
            Settings.Load();

            // Initialize
            Loaded += MainWindow_Loaded;
            Closing += MainWindow_Closing;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            Logger.Log("=== Application Started ===");
            Logger.Log($"Log file: {Logger.GetLogPath()}");

            // Get GPU info
            try
            {
                var gpuName = GetGpuName();
                GpuInfoText.Text = $"GPU: {gpuName}";
                Logger.Log($"GPU: {gpuName}");
            }
            catch
            {
                GpuInfoText.Text = "GPU: Unknown";
                Logger.Log("GPU: Unknown");
            }

            // Refresh device list
            RefreshDevices_Click(null, null);

            // Setup stats update timer
            _statsTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(100)
            };
            _statsTimer.Tick += StatsTimer_Tick;
        }

        private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            StopProcessing();
            _inference?.Dispose();
            _deckLink?.Dispose();
        }

        private string GetGpuName()
        {
            try
            {
                using var process = new System.Diagnostics.Process();
                process.StartInfo.FileName = "nvidia-smi";
                process.StartInfo.Arguments = "--query-gpu=name --format=csv,noheader";
                process.StartInfo.RedirectStandardOutput = true;
                process.StartInfo.UseShellExecute = false;
                process.StartInfo.CreateNoWindow = true;
                process.Start();
                var output = process.StandardOutput.ReadToEnd().Trim();
                process.WaitForExit();
                return output;
            }
            catch
            {
                return "NVIDIA GPU";
            }
        }

        private void RefreshDevices_Click(object? sender, RoutedEventArgs? e)
        {
            InputDeviceCombo.Items.Clear();
            OutputDeviceCombo.Items.Clear();

            var devices = DeckLinkWrapper.GetDeviceList();

            if (devices.Count == 0)
            {
                InputDeviceCombo.Items.Add("No DeckLink devices found");
                OutputDeviceCombo.Items.Add("No DeckLink devices found");
                StatusText.Text = "No DeckLink devices found - please install drivers";
                return;
            }

            foreach (var device in devices)
            {
                InputDeviceCombo.Items.Add(device);
                OutputDeviceCombo.Items.Add(device);
            }

            InputDeviceCombo.SelectedIndex = 0;
            OutputDeviceCombo.SelectedIndex = devices.Count > 1 ? 1 : 0;

            // Populate output format combo
            OutputFormatCombo.Items.Clear();
            _outputFormats = DeckLinkWrapper.GetOutputDisplayModes();
            foreach (var format in _outputFormats)
            {
                OutputFormatCombo.Items.Add(format.Name);
            }
            OutputFormatCombo.SelectedIndex = 0; // Default to 1080i 59.94

            StatusText.Text = $"Found {devices.Count} DeckLink device(s)";

            // Start preview automatically
            StartPreview();
        }

        private void InputDeviceCombo_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
        {
            if (!_isProcessing && InputDeviceCombo.SelectedIndex >= 0)
            {
                StartPreview();
            }
        }

        private void StartPreview()
        {
            // Stop existing preview
            StopPreview();

            if (InputDeviceCombo.SelectedIndex < 0) return;

            try
            {
                _deckLink = new DeckLinkWrapper();
                if (!_deckLink.Initialize(InputDeviceCombo.SelectedIndex, OutputDeviceCombo.SelectedIndex))
                {
                    StatusText.Text = "Failed to initialize DeckLink for preview";
                    return;
                }

                // Subscribe to frame events for preview
                _deckLink.OnFrameReceived += OnPreviewFrameFromInput;

                // Start input with frame callback enabled (no preview callback)
                if (!_deckLink.StartInput(null, enableFrameCallback: true))
                {
                    StatusText.Text = "Failed to start DeckLink input for preview";
                    return;
                }

                _isPreviewing = true;
                StatusText.Text = "Preview active - select model and click Start to process";
            }
            catch (Exception ex)
            {
                StatusText.Text = $"Preview error: {ex.Message}";
                Console.WriteLine($"[ERROR] Preview error: {ex}");
            }
        }

        private void StopPreview()
        {
            if (_deckLink != null && _isPreviewing && !_isProcessing)
            {
                _deckLink.OnFrameReceived -= OnPreviewFrameFromInput;
                _deckLink.StopInput();
                _deckLink.Dispose();
                _deckLink = null;
                _isPreviewing = false;
            }
        }

        // Preview using IDeckLinkInputCallback frame data
        private int _previewFrameCount = 0;

        private void OnPreviewFrameFromInput(byte[] frameData)
        {
            if (!_isPreviewing) return;

            _previewFrameCount++;

            // 1080i frame size: 1920 * 1080 * 2 (YUV422)
            int width = 1920;
            int height = 1080;
            int expectedSize = width * height * 2;

            if (_previewFrameCount % 60 == 1)
            {
                Console.WriteLine($"[PREVIEW] Frame {_previewFrameCount}: size={frameData.Length}, expected={expectedSize}");
            }

            // Convert YUV422 (UYVY) to BGRA and display
            Dispatcher.BeginInvoke(() =>
            {
                try
                {
                    // Create or resize bitmap if needed
                    if (_previewBitmap == null || _previewBitmap.PixelWidth != width || _previewBitmap.PixelHeight != height)
                    {
                        _previewBitmap = new WriteableBitmap(width, height, 96, 96, PixelFormats.Bgra32, null);
                        InputPreview.Source = _previewBitmap;
                    }

                    // Convert UYVY to BGRA
                    byte[] bgraData = ConvertUyvyToBgra(frameData, width, height);

                    // Write to bitmap
                    _previewBitmap.Lock();
                    _previewBitmap.WritePixels(new Int32Rect(0, 0, width, height), bgraData, width * 4, 0);
                    _previewBitmap.Unlock();
                }
                catch (Exception ex)
                {
                    if (_previewFrameCount % 60 == 1)
                        Console.WriteLine($"[ERROR] OnPreviewFrameFromInput: {ex.Message}");
                }
            });
        }

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

        private async void LoadModel_Click(object sender, RoutedEventArgs e)
        {
            LoadModelBtn.IsEnabled = false;
            ModelStatusText.Text = "Loading...";
            StatusText.Text = "Loading TensorRT model (first run may take 5-10 minutes)...";

            try
            {
                await Task.Run(() =>
                {
                    _inference = new TensorRTInference(_modelPath);

                    if (!_inference.Initialize())
                    {
                        throw new Exception("Failed to initialize TensorRT inference");
                    }
                });

                ModelStatusText.Text = "Loaded (TensorRT)";
                ModelStatusText.Foreground = new SolidColorBrush(Color.FromRgb(76, 175, 80));
                StatusText.Text = "TensorRT model loaded successfully";
                StartBtn.IsEnabled = true;
            }
            catch (Exception ex)
            {
                ModelStatusText.Text = $"Error: {ex.Message}";
                ModelStatusText.Foreground = new SolidColorBrush(Color.FromRgb(244, 67, 54));
                StatusText.Text = $"Failed to load model: {ex.Message}";
                LoadModelBtn.IsEnabled = true;
            }
        }

        private void Start_Click(object sender, RoutedEventArgs e)
        {
            if (_inference == null)
            {
                MessageBox.Show("Please load the model first", "Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (InputDeviceCombo.SelectedIndex < 0 || OutputDeviceCombo.SelectedIndex < 0)
            {
                MessageBox.Show("Please select input and output devices", "Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                // Stop preview mode and reuse existing deckLink
                if (_isPreviewing && _deckLink != null)
                {
                    // Unsubscribe preview handler
                    _deckLink.OnFrameReceived -= OnPreviewFrameFromInput;
                    _isPreviewing = false;
                }
                else
                {
                    _deckLink = new DeckLinkWrapper();
                    if (!_deckLink.Initialize(InputDeviceCombo.SelectedIndex, OutputDeviceCombo.SelectedIndex))
                    {
                        MessageBox.Show("Failed to initialize DeckLink", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                        return;
                    }

                    if (!_deckLink.StartInput())
                    {
                        MessageBox.Show("Failed to start DeckLink input", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                        return;
                    }
                }

                // Start SDI output with selected format
                var selectedMode = _outputFormats[OutputFormatCombo.SelectedIndex].Mode;
                Logger.Log($"[MAIN] Attempting to start SDI output with format: {_outputFormats[OutputFormatCombo.SelectedIndex].Name} (mode: {selectedMode})");
                Logger.Log($"[MAIN] _deckLink is null: {_deckLink == null}");

                bool outputStarted = _deckLink.StartOutput(selectedMode);
                Logger.Log($"[MAIN] StartOutput returned: {outputStarted}");
                Logger.Log($"[MAIN] IsOutputRunning: {_deckLink.IsOutputRunning}");

                if (!outputStarted)
                {
                    Logger.Log($"[WARN] Failed to start DeckLink output, continuing without SDI output");
                }

                // Create pipeline processor (enable output if SDI output started successfully)
                _pipeline = new PipelineProcessor(_inference, _deckLink, Settings, enableOutput: _deckLink.IsOutputRunning);
                Logger.Log($"[MAIN] PipelineProcessor created with enableOutput={_deckLink.IsOutputRunning}");
                _pipeline.AlphaOnly = true;
                _pipeline.OnProcessedFrame += OnProcessedFrameForPreview;

                // Setup input callback
                _deckLink.OnFrameReceived += OnFrameReceived;

                // Start pipeline
                _pipeline.Start();
                _isProcessing = true;

                // Enable external frame mode after pipeline is started
                // This tells DeckLink to use frames from the pipeline instead of test patterns
                if (_deckLink.IsOutputRunning)
                {
                    _deckLink.SetExternalFrameMode(true);
                    Logger.Log("[MAIN] External frame mode enabled");
                }

                // Start stats timer
                _statsTimer?.Start();

                // Update UI
                StartBtn.IsEnabled = false;
                StopBtn.IsEnabled = true;
                LoadModelBtn.IsEnabled = false;
                RefreshDevicesBtn.IsEnabled = false;
                InputDeviceCombo.IsEnabled = false;
                OutputDeviceCombo.IsEnabled = false;
                OutputFormatCombo.IsEnabled = false;

                StatusText.Text = $"Processing... (Output: {_outputFormats[OutputFormatCombo.SelectedIndex].Name})";
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to start: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                StopProcessing();
            }
        }

        private void Stop_Click(object sender, RoutedEventArgs e)
        {
            StopProcessing();
        }

        private DispatcherTimer? _testTimer;
        private byte[]? _testFrame;
        private DeckLinkWrapper? _testDeckLink;

        private void TestSdi_Click(object sender, RoutedEventArgs e)
        {
            // Stop any existing preview/processing
            StopPreview();
            StopProcessing();

            if (_testDeckLink != null)
            {
                // Stop timer first (DispatcherTimer runs on UI thread, safe to stop)
                if (_testTimer != null)
                {
                    _testTimer.Stop();
                    _testTimer.Tick -= TestTimer_Tick;
                    _testTimer = null;
                }
                _testFrame = null;

                // Stop and dispose DeckLink (all on UI thread)
                _testDeckLink.StopOutput();
                _testDeckLink.Dispose();
                _testDeckLink = null;

                TestSdiBtn.Content = "Test SDI Output";
                TestSdiBtn.Background = new SolidColorBrush(Color.FromRgb(255, 152, 0));
                StatusText.Text = "Test stopped";
                return;
            }

            try
            {
                Logger.Log("[TEST] Starting SDI output test (no input)");

                // Create new DeckLink wrapper for output only
                _testDeckLink = new DeckLinkWrapper();

                // Initialize with output device only (same device index for both)
                int outputIndex = OutputDeviceCombo.SelectedIndex >= 0 ? OutputDeviceCombo.SelectedIndex : 0;
                if (!_testDeckLink.Initialize(outputIndex, outputIndex))
                {
                    MessageBox.Show("Failed to initialize DeckLink for test", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    _testDeckLink = null;
                    return;
                }

                // DO NOT start input - only output
                var selectedMode = _outputFormats[OutputFormatCombo.SelectedIndex].Mode;
                Logger.Log($"[TEST] Starting SDI output with format: {_outputFormats[OutputFormatCombo.SelectedIndex].Name}");

                if (!_testDeckLink.StartOutput(selectedMode))
                {
                    MessageBox.Show("Failed to start SDI output", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    _testDeckLink.Dispose();
                    _testDeckLink = null;
                    return;
                }

                // Create green test pattern
                byte[] testFrame = new byte[1920 * 1080 * 4];
                for (int i = 0; i < 1920 * 1080; i++)
                {
                    testFrame[i * 4 + 0] = 0;   // B
                    testFrame[i * 4 + 1] = 255; // G
                    testFrame[i * 4 + 2] = 0;   // R
                    testFrame[i * 4 + 3] = 255; // A
                }

                // Send initial frames for preroll
                for (int i = 0; i < 8; i++)
                {
                    _testDeckLink.SendFrame(testFrame);
                }

                // Store test frame for timer callback
                _testFrame = testFrame;

                // Start DispatcherTimer (runs on UI thread, safe for COM calls)
                _testTimer = new DispatcherTimer();
                _testTimer.Interval = TimeSpan.FromMilliseconds(16); // ~60fps
                _testTimer.Tick += TestTimer_Tick;
                _testTimer.Start();

                TestSdiBtn.Content = "Stop Test";
                TestSdiBtn.Background = new SolidColorBrush(Color.FromRgb(244, 67, 54));
                StatusText.Text = "SDI Test running - Green screen should appear";
                Logger.Log("[TEST] SDI test started, sending green frames");
            }
            catch (Exception ex)
            {
                Logger.Log($"[TEST ERROR] {ex.Message}");
                MessageBox.Show($"Test failed: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                _testDeckLink?.Dispose();
                _testDeckLink = null;
            }
        }

        private void TestTimer_Tick(object? sender, EventArgs e)
        {
            if (_testDeckLink != null && _testDeckLink.IsOutputRunning && _testFrame != null)
            {
                _testDeckLink.SendFrame(_testFrame);
            }
        }

        private void Settings_Click(object sender, RoutedEventArgs e)
        {
            // Open settings window (reuse if already open)
            if (_settingsWindow != null && _settingsWindow.IsLoaded)
            {
                _settingsWindow.Activate();
                return;
            }

            _settingsWindow = new SettingsWindow(Settings)
            {
                Owner = this
            };
            _settingsWindow.Show();
        }

        // Processed frame preview (alpha mask - white silhouette on black)
        private WriteableBitmap? _outputBitmap;

        private void OnProcessedFrameForPreview(byte[] bgraData)
        {
            if (!_isProcessing) return;

            Dispatcher.BeginInvoke(() =>
            {
                try
                {
                    int width = 1920;
                    int height = 1080;

                    // Create or resize bitmap if needed
                    if (_outputBitmap == null || _outputBitmap.PixelWidth != width || _outputBitmap.PixelHeight != height)
                    {
                        _outputBitmap = new WriteableBitmap(width, height, 96, 96, PixelFormats.Bgra32, null);
                        // Show output in the bottom preview (OutputPreview)
                        OutputPreview.Source = _outputBitmap;
                    }

                    // Data is already white silhouette on black (B=G=R=alpha, A=255)
                    // from CreateAlphaOnlyOutput, so just use it directly

                    // Write to bitmap
                    _outputBitmap.Lock();
                    _outputBitmap.WritePixels(new Int32Rect(0, 0, width, height), bgraData, width * 4, 0);
                    _outputBitmap.Unlock();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ERROR] OnProcessedFrameForPreview: {ex.Message}");
                }
            });
        }

        private void StopProcessing()
        {
            _isProcessing = false;
            _statsTimer?.Stop();

            if (_pipeline != null)
            {
                _pipeline.OnProcessedFrame -= OnProcessedFrameForPreview;
                _pipeline.Stop();
                _pipeline.Dispose();
                _pipeline = null;
            }

            if (_deckLink != null)
            {
                _deckLink.OnFrameReceived -= OnFrameReceived;
                _deckLink.StopInput();
                _deckLink.StopOutput();
                _deckLink.Dispose();
                _deckLink = null;
            }

            // Update UI
            StartBtn.IsEnabled = true;
            StopBtn.IsEnabled = false;
            LoadModelBtn.IsEnabled = true;
            RefreshDevicesBtn.IsEnabled = true;
            InputDeviceCombo.IsEnabled = true;
            OutputDeviceCombo.IsEnabled = true;
            OutputFormatCombo.IsEnabled = true;

            StatusText.Text = "Stopped";
            FpsText.Text = "FPS: --";
            LatencyText.Text = "Latency: -- ms";

            // Restart preview
            StartPreview();
        }

        private void OnFrameReceived(byte[] frameData)
        {
            if (!_isProcessing || _pipeline == null) return;

            // Submit to pipeline for inference
            _pipeline.SubmitFrame(frameData);

            // Also update input preview (top screen)
            UpdateInputPreview(frameData);
        }

        private void UpdateInputPreview(byte[] yuvData)
        {
            Dispatcher.BeginInvoke(() =>
            {
                try
                {
                    int width = 1920;
                    int height = 1080;

                    // Create or resize bitmap if needed
                    if (_previewBitmap == null || _previewBitmap.PixelWidth != width || _previewBitmap.PixelHeight != height)
                    {
                        _previewBitmap = new WriteableBitmap(width, height, 96, 96, PixelFormats.Bgra32, null);
                        InputPreview.Source = _previewBitmap;
                    }

                    // Convert YUV422 (UYVY) to BGRA
                    byte[] bgraData = ConvertUyvyToBgra(yuvData, width, height);

                    // Write to bitmap
                    _previewBitmap.Lock();
                    _previewBitmap.WritePixels(new Int32Rect(0, 0, width, height), bgraData, width * 4, 0);
                    _previewBitmap.Unlock();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ERROR] UpdateInputPreview: {ex.Message}");
                }
            });
        }

        private void StatsTimer_Tick(object? sender, EventArgs e)
        {
            if (_pipeline == null) return;

            var stats = _pipeline.Stats;

            FpsText.Text = $"FPS: {stats.CurrentFps}";
            LatencyText.Text = $"Latency: {stats.TotalLatencyMs:F1} ms";
            InferenceTimeText.Text = $"Inference: {stats.InferenceTimeMs:F1} ms";
            PostprocessTimeText.Text = $"Postprocess: {stats.PostprocessTimeMs:F1} ms";
            OutputTimeText.Text = $"SDI Output: {stats.OutputTimeMs:F1} ms";
            TotalFramesText.Text = $"Total Frames: {stats.TotalFramesProcessed:N0}";

            if (stats.CurrentFps >= 55)
            {
                FpsText.Foreground = new SolidColorBrush(Color.FromRgb(76, 175, 80));
            }
            else if (stats.CurrentFps >= 30)
            {
                FpsText.Foreground = new SolidColorBrush(Color.FromRgb(255, 193, 7));
            }
            else
            {
                FpsText.Foreground = new SolidColorBrush(Color.FromRgb(244, 67, 54));
            }
        }
    }
}
