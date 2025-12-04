using System;
using System.Windows;
using System.Windows.Controls;

namespace RvmDecklink
{
    public partial class SettingsWindow : Window
    {
        private readonly RvmSettings _settings;
        private bool _isLoading = true;  // Start as true to prevent events during init
        private bool _isInitialized = false;

        public SettingsWindow(RvmSettings settings)
        {
            _settings = settings;

            InitializeComponent();

            // Initialize preset combo
            PresetCombo.ItemsSource = RvmSettings.GetPresetNames();
            PresetCombo.SelectedIndex = 0;

            // Load current values to UI
            LoadSettingsToUI();

            _isInitialized = true;
            _isLoading = false;
        }

        private void LoadSettingsToUI()
        {
            _isLoading = true;
            try
            {
                // Basic
                DownsampleSlider.Value = _settings.DownsampleRatio;
                UpdateValueLabel(DownsampleValue, _settings.DownsampleRatio, "F2");

                // Alpha
                SoftAlphaCheck.IsChecked = _settings.UseSoftAlpha;
                ThresholdSlider.Value = _settings.AlphaThreshold;
                UpdateValueLabel(ThresholdValue, _settings.AlphaThreshold, "F2");
                ContrastSlider.Value = _settings.AlphaContrast;
                UpdateValueLabel(ContrastValue, _settings.AlphaContrast, "F1");

                // Edge
                EdgeRefinementCheck.IsChecked = _settings.EdgeRefinement;
                EdgeKernelSlider.Value = _settings.EdgeKernelSize;
                UpdateValueLabel(EdgeKernelValue, _settings.EdgeKernelSize);
                FeatherSlider.Value = _settings.FeatherAmount;
                UpdateValueLabel(FeatherValue, _settings.FeatherAmount);

                // Morphological
                ErosionSlider.Value = _settings.ErosionSize;
                UpdateValueLabel(ErosionValue, _settings.ErosionSize);
                DilationSlider.Value = _settings.DilationSize;
                UpdateValueLabel(DilationValue, _settings.DilationSize);

                // Temporal
                TemporalSmoothingCheck.IsChecked = _settings.TemporalSmoothing;
                SmoothingSlider.Value = _settings.SmoothingStrength;
                UpdateValueLabel(SmoothingValue, _settings.SmoothingStrength, "F2");

                // Color Correction
                GammaSlider.Value = _settings.GammaCorrection;
                UpdateValueLabel(GammaValue, _settings.GammaCorrection, "F2");
                MinAlphaSlider.Value = _settings.MinAlphaClamp;
                UpdateValueLabel(MinAlphaValue, _settings.MinAlphaClamp, "F2");
                MaxAlphaSlider.Value = _settings.MaxAlphaClamp;
                UpdateValueLabel(MaxAlphaValue, _settings.MaxAlphaClamp, "F2");
            }
            finally
            {
                _isLoading = false;
            }
        }

        private void UpdateValueLabel(TextBlock? label, double value, string format = "F0")
        {
            if (label != null)
            {
                label.Text = value.ToString(format);
            }
        }

        private void OnSliderChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_isLoading || !_isInitialized) return;

            var slider = sender as Slider;
            if (slider == null) return;

            // Update settings based on slider name
            if (slider == DownsampleSlider)
            {
                _settings.DownsampleRatio = (float)slider.Value;
                UpdateValueLabel(DownsampleValue, slider.Value, "F2");
            }
            else if (slider == ThresholdSlider)
            {
                _settings.AlphaThreshold = (float)slider.Value;
                UpdateValueLabel(ThresholdValue, slider.Value, "F2");
            }
            else if (slider == ContrastSlider)
            {
                _settings.AlphaContrast = (float)slider.Value;
                UpdateValueLabel(ContrastValue, slider.Value, "F1");
            }
            else if (slider == EdgeKernelSlider)
            {
                int value = (int)slider.Value;
                if (value % 2 == 0) value++;  // Force odd
                _settings.EdgeKernelSize = value;
                UpdateValueLabel(EdgeKernelValue, value);
            }
            else if (slider == FeatherSlider)
            {
                _settings.FeatherAmount = (int)slider.Value;
                UpdateValueLabel(FeatherValue, slider.Value);
            }
            else if (slider == ErosionSlider)
            {
                _settings.ErosionSize = (int)slider.Value;
                UpdateValueLabel(ErosionValue, slider.Value);
            }
            else if (slider == DilationSlider)
            {
                _settings.DilationSize = (int)slider.Value;
                UpdateValueLabel(DilationValue, slider.Value);
            }
            else if (slider == SmoothingSlider)
            {
                _settings.SmoothingStrength = (float)slider.Value;
                UpdateValueLabel(SmoothingValue, slider.Value, "F2");
            }
            else if (slider == GammaSlider)
            {
                _settings.GammaCorrection = (float)slider.Value;
                UpdateValueLabel(GammaValue, slider.Value, "F2");
            }
            else if (slider == MinAlphaSlider)
            {
                _settings.MinAlphaClamp = (float)slider.Value;
                UpdateValueLabel(MinAlphaValue, slider.Value, "F2");
            }
            else if (slider == MaxAlphaSlider)
            {
                _settings.MaxAlphaClamp = (float)slider.Value;
                UpdateValueLabel(MaxAlphaValue, slider.Value, "F2");
            }
        }

        private void OnCheckChanged(object sender, RoutedEventArgs e)
        {
            if (_isLoading || !_isInitialized) return;

            var check = sender as CheckBox;
            if (check == null) return;

            if (check == SoftAlphaCheck)
            {
                _settings.UseSoftAlpha = check.IsChecked ?? false;
            }
            else if (check == EdgeRefinementCheck)
            {
                _settings.EdgeRefinement = check.IsChecked ?? false;
            }
            else if (check == TemporalSmoothingCheck)
            {
                _settings.TemporalSmoothing = check.IsChecked ?? false;
            }
        }

        private void PresetCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_isLoading || !_isInitialized || PresetCombo.SelectedItem == null) return;

            var presetName = PresetCombo.SelectedItem.ToString();
            if (!string.IsNullOrEmpty(presetName))
            {
                _settings.ApplyPreset(presetName);
                LoadSettingsToUI();
            }
        }

        private void Reset_Click(object sender, RoutedEventArgs e)
        {
            _settings.ResetToDefaults();
            LoadSettingsToUI();
            PresetCombo.SelectedIndex = 0;
        }

        private void Load_Click(object sender, RoutedEventArgs e)
        {
            if (_settings.Load())
            {
                LoadSettingsToUI();
                MessageBox.Show("Settings loaded successfully", "Settings", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show("No saved settings found", "Settings", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void Save_Click(object sender, RoutedEventArgs e)
        {
            if (_settings.Save())
            {
                MessageBox.Show("Settings saved successfully", "Settings", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show("Failed to save settings", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
