using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace RvmDecklink
{
    /// <summary>
    /// RVM processing settings with real-time update support
    /// </summary>
    public class RvmSettings : INotifyPropertyChanged
    {
        private static readonly string SettingsPath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "rvm_settings.json");

        public event PropertyChangedEventHandler? PropertyChanged;

        // === Basic Settings ===
        private float _downsampleRatio = 0.25f;
        public float DownsampleRatio
        {
            get => _downsampleRatio;
            set { _downsampleRatio = Math.Clamp(value, 0.1f, 1.0f); OnPropertyChanged(); }
        }

        // === Alpha Settings ===
        private bool _useSoftAlpha = true;
        public bool UseSoftAlpha
        {
            get => _useSoftAlpha;
            set { _useSoftAlpha = value; OnPropertyChanged(); }
        }

        private float _alphaThreshold = 0.5f;
        public float AlphaThreshold
        {
            get => _alphaThreshold;
            set { _alphaThreshold = Math.Clamp(value, 0f, 1f); OnPropertyChanged(); }
        }

        private float _alphaContrast = 50f;
        public float AlphaContrast
        {
            get => _alphaContrast;
            set { _alphaContrast = Math.Clamp(value, 0.1f, 100f); OnPropertyChanged(); }
        }

        // === Edge Processing ===
        private bool _edgeRefinement = false;
        public bool EdgeRefinement
        {
            get => _edgeRefinement;
            set { _edgeRefinement = value; OnPropertyChanged(); }
        }

        private int _edgeKernelSize = 3;
        public int EdgeKernelSize
        {
            get => _edgeKernelSize;
            set { _edgeKernelSize = Math.Clamp(value | 1, 1, 15); OnPropertyChanged(); } // Force odd
        }

        private int _featherAmount = 0;
        public int FeatherAmount
        {
            get => _featherAmount;
            set { _featherAmount = Math.Clamp(value, 0, 20); OnPropertyChanged(); }
        }

        // === Morphological Operations ===
        private int _erosionSize = 0;
        public int ErosionSize
        {
            get => _erosionSize;
            set { _erosionSize = Math.Clamp(value, 0, 10); OnPropertyChanged(); }
        }

        private int _dilationSize = 0;
        public int DilationSize
        {
            get => _dilationSize;
            set { _dilationSize = Math.Clamp(value, 0, 10); OnPropertyChanged(); }
        }

        // === Temporal Processing ===
        private bool _temporalSmoothing = false;
        public bool TemporalSmoothing
        {
            get => _temporalSmoothing;
            set { _temporalSmoothing = value; OnPropertyChanged(); }
        }

        private float _smoothingStrength = 0.3f;
        public float SmoothingStrength
        {
            get => _smoothingStrength;
            set { _smoothingStrength = Math.Clamp(value, 0f, 1f); OnPropertyChanged(); }
        }

        // === Color Correction ===
        private float _gammaCorrection = 1.0f;
        public float GammaCorrection
        {
            get => _gammaCorrection;
            set { _gammaCorrection = Math.Clamp(value, 0.1f, 3f); OnPropertyChanged(); }
        }

        private float _minAlphaClamp = 0f;
        public float MinAlphaClamp
        {
            get => _minAlphaClamp;
            set { _minAlphaClamp = Math.Clamp(value, 0f, 0.5f); OnPropertyChanged(); }
        }

        private float _maxAlphaClamp = 1f;
        public float MaxAlphaClamp
        {
            get => _maxAlphaClamp;
            set { _maxAlphaClamp = Math.Clamp(value, 0.5f, 1f); OnPropertyChanged(); }
        }

        protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        /// <summary>
        /// Reset to default values
        /// </summary>
        public void ResetToDefaults()
        {
            DownsampleRatio = 0.25f;
            UseSoftAlpha = true;
            AlphaThreshold = 0.5f;
            AlphaContrast = 50f;
            EdgeRefinement = false;
            EdgeKernelSize = 3;
            FeatherAmount = 0;
            ErosionSize = 0;
            DilationSize = 0;
            TemporalSmoothing = false;
            SmoothingStrength = 0.3f;
            GammaCorrection = 1.0f;
            MinAlphaClamp = 0f;
            MaxAlphaClamp = 1f;
        }

        /// <summary>
        /// Apply preset settings
        /// </summary>
        public void ApplyPreset(string presetName)
        {
            switch (presetName)
            {
                case "Default":
                    ResetToDefaults();
                    break;

                case "High Quality":
                    DownsampleRatio = 0.5f;
                    UseSoftAlpha = true;
                    AlphaThreshold = 0.3f;
                    AlphaContrast = 30f;
                    EdgeRefinement = true;
                    EdgeKernelSize = 5;
                    FeatherAmount = 3;
                    ErosionSize = 0;
                    DilationSize = 1;
                    TemporalSmoothing = true;
                    SmoothingStrength = 0.5f;
                    GammaCorrection = 1.0f;
                    MinAlphaClamp = 0.02f;
                    MaxAlphaClamp = 0.98f;
                    break;

                case "Fast":
                    DownsampleRatio = 0.2f;
                    UseSoftAlpha = false;
                    AlphaThreshold = 0.5f;
                    AlphaContrast = 1f;
                    EdgeRefinement = false;
                    EdgeKernelSize = 3;
                    FeatherAmount = 0;
                    ErosionSize = 0;
                    DilationSize = 0;
                    TemporalSmoothing = false;
                    SmoothingStrength = 0.3f;
                    GammaCorrection = 1.0f;
                    MinAlphaClamp = 0f;
                    MaxAlphaClamp = 1f;
                    break;

                case "Soft Edge":
                    DownsampleRatio = 0.25f;
                    UseSoftAlpha = true;
                    AlphaThreshold = 0.3f;
                    AlphaContrast = 20f;
                    EdgeRefinement = true;
                    EdgeKernelSize = 7;
                    FeatherAmount = 5;
                    ErosionSize = 0;
                    DilationSize = 2;
                    TemporalSmoothing = true;
                    SmoothingStrength = 0.4f;
                    GammaCorrection = 0.8f;
                    MinAlphaClamp = 0f;
                    MaxAlphaClamp = 1f;
                    break;

                case "Sharp Edge":
                    DownsampleRatio = 0.3f;
                    UseSoftAlpha = true;
                    AlphaThreshold = 0.6f;
                    AlphaContrast = 80f;
                    EdgeRefinement = true;
                    EdgeKernelSize = 3;
                    FeatherAmount = 0;
                    ErosionSize = 1;
                    DilationSize = 0;
                    TemporalSmoothing = false;
                    SmoothingStrength = 0.3f;
                    GammaCorrection = 1.2f;
                    MinAlphaClamp = 0.1f;
                    MaxAlphaClamp = 0.95f;
                    break;
            }
        }

        /// <summary>
        /// Save settings to JSON file
        /// </summary>
        public bool Save()
        {
            try
            {
                var json = JsonSerializer.Serialize(this, new JsonSerializerOptions
                {
                    WriteIndented = true
                });
                File.WriteAllText(SettingsPath, json);
                Logger.Log($"[SETTINGS] Saved to {SettingsPath}");
                return true;
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] Failed to save settings: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Load settings from JSON file
        /// </summary>
        public bool Load()
        {
            try
            {
                if (!File.Exists(SettingsPath))
                {
                    Logger.Log("[SETTINGS] No settings file found, using defaults");
                    return false;
                }

                var json = File.ReadAllText(SettingsPath);
                var loaded = JsonSerializer.Deserialize<RvmSettings>(json);

                if (loaded != null)
                {
                    DownsampleRatio = loaded.DownsampleRatio;
                    UseSoftAlpha = loaded.UseSoftAlpha;
                    AlphaThreshold = loaded.AlphaThreshold;
                    AlphaContrast = loaded.AlphaContrast;
                    EdgeRefinement = loaded.EdgeRefinement;
                    EdgeKernelSize = loaded.EdgeKernelSize;
                    FeatherAmount = loaded.FeatherAmount;
                    ErosionSize = loaded.ErosionSize;
                    DilationSize = loaded.DilationSize;
                    TemporalSmoothing = loaded.TemporalSmoothing;
                    SmoothingStrength = loaded.SmoothingStrength;
                    GammaCorrection = loaded.GammaCorrection;
                    MinAlphaClamp = loaded.MinAlphaClamp;
                    MaxAlphaClamp = loaded.MaxAlphaClamp;

                    Logger.Log($"[SETTINGS] Loaded from {SettingsPath}");
                    return true;
                }
            }
            catch (Exception ex)
            {
                Logger.Log($"[ERROR] Failed to load settings: {ex.Message}");
            }

            return false;
        }

        /// <summary>
        /// Get preset names
        /// </summary>
        public static string[] GetPresetNames()
        {
            return new[] { "Default", "High Quality", "Fast", "Soft Edge", "Sharp Edge" };
        }
    }
}
