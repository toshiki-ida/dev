using System;
using System.Runtime.InteropServices;
using DeckLinkAPI;

namespace RvmDecklink
{
    /// <summary>
    /// DeckLink screen preview callback - extracts frame data for WPF display
    /// </summary>
    public class PreviewCallback : IDeckLinkScreenPreviewCallback
    {
        public event Action<byte[], int, int>? FrameDataReady;

        private int _drawFrameCount = 0;

        void IDeckLinkScreenPreviewCallback.DrawFrame(IDeckLinkVideoFrame theFrame)
        {
            _drawFrameCount++;

            if (theFrame == null) return;

            try
            {
                int width = theFrame.GetWidth();
                int height = theFrame.GetHeight();
                int rowBytes = theFrame.GetRowBytes();

                // Check for no input source
                var flags = theFrame.GetFlags();
                if (flags.HasFlag(_BMDFrameFlags.bmdFrameHasNoInputSource))
                {
                    return;
                }

                // Get frame bytes via IDeckLinkVideoBuffer interface
                IntPtr pUnk = Marshal.GetIUnknownForObject(theFrame);
                Guid iidVideoBuffer = typeof(IDeckLinkVideoBuffer).GUID;
                int hr = Marshal.QueryInterface(pUnk, ref iidVideoBuffer, out IntPtr pBuffer);
                Marshal.Release(pUnk);

                if (hr == 0 && pBuffer != IntPtr.Zero)
                {
                    try
                    {
                        var buffer = (IDeckLinkVideoBuffer)Marshal.GetObjectForIUnknown(pBuffer);
                        buffer.GetBytes(out IntPtr frameBytes);

                        if (frameBytes != IntPtr.Zero)
                        {
                            int frameSize = rowBytes * height;
                            var frameData = new byte[frameSize];
                            Marshal.Copy(frameBytes, frameData, 0, frameSize);

                            if (_drawFrameCount % 60 == 1)
                            {
                                Console.WriteLine($"[DEBUG] DrawFrame: {width}x{height}, rowBytes={rowBytes}, size={frameSize}");
                            }

                            FrameDataReady?.Invoke(frameData, width, height);
                        }
                    }
                    finally
                    {
                        Marshal.Release(pBuffer);
                    }
                }
                else if (_drawFrameCount % 60 == 1)
                {
                    Console.WriteLine($"[WARN] QueryInterface for IDeckLinkVideoBuffer failed: 0x{hr:X8}");
                }

                // Add GC memory pressure
                GC.AddMemoryPressure(rowBytes * height);
            }
            catch (Exception ex)
            {
                if (_drawFrameCount % 60 == 1)
                {
                    Console.WriteLine($"[ERROR] DrawFrame: {ex.Message}");
                }
            }
        }
    }
}
