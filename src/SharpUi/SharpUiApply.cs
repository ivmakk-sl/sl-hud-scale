using System;
using GameCore.HotUpdate;
using GameCore.HotUpdate.ReduxUI;
using HarmonyLib;
using UnityEngine;

namespace HudScale
{
    // Sharp UI: while SharpUI is on, each frame sets the pixel density of the web UI to the value that fits
    // the screen when it differs, so each later set of the game (a change of the Graphics setting or the
    // resolution, a browser rebuild) is covered with no patch of the game's async apply. HotUpdateCaller.Update
    // runs in each frame, also at the title screen and while the world is paused. At each change from on to
    // off, whatever its cause (the panel switch, a file edit, another config tool), the game computes its own
    // value again. The prefab and its RectTransform are kept between frames, so a frame reads only numbers and
    // makes no interop wrapper objects. They are looked up again when Unity destroyed them (the game destroys
    // the web UI root before it builds a new one) and once a second, in case the game holds a new prefab.
    [HarmonyPatch(typeof(HotUpdateCaller), nameof(HotUpdateCaller.Update))]
    internal static class SharpUiApply
    {
        // The value of SharpUI at the last frame.
        private static bool lastOn;
        private static bool warned;
        private static Vuplex.WebView.CanvasWebViewPrefab prefab;
        private static RectTransform rect;
        private static float lookedUpAt = float.NegativeInfinity;
        private const float LookUpSeconds = 1f;

        private static void Postfix()
        {
            try
            {
                bool on = Plugin.SharpUI.Value;
                if (!on)
                {
                    if (lastOn)
                    {
                        var layer = ReduxUISystem.Instance?.GetWebUILayer();
                        // Without the layer, the switch back to the game's value waits for a later frame.
                        if (layer == null) return;
                        if (Plugin.Verbose.Value) Plugin.Log.LogDebug("Sharp UI: off, the game sets the pixel density");
                        layer.RefreshPixelDensity();
                    }
                    lastOn = false;
                    return;
                }
                lastOn = true;
                float now = Time.realtimeSinceStartup;
                if (prefab == null || rect == null || now - lookedUpAt >= LookUpSeconds)
                {
                    lookedUpAt = now;
                    prefab = ReduxUISystem.Instance?.GetWebUILayer()?.canvasWebViewPrefab;
                    rect = prefab == null ? null : prefab.transform.TryCast<RectTransform>();
                    if (rect == null) return;
                }
                float layout = rect.rect.width * prefab.Resolution;
                float? fit = SharpUiLogic.Fit(Screen.width, layout);
                if (fit == null || prefab.PixelDensity == fit.Value) return;
                if (Plugin.Verbose.Value) Plugin.Log.LogDebug(FormattableString.Invariant($"Sharp UI: pixel density {prefab.PixelDensity} -> {fit.Value} (screen {Screen.width}, layout {layout})"));
                prefab.PixelDensity = fit.Value;
            }
            catch (Exception e)
            {
                // A per-frame hook: the first failure logs, the next ones do not.
                if (warned) return;
                warned = true;
                Plugin.Log.LogWarning($"Sharp UI: apply failed: {e}");
            }
        }
    }
}
