using System.Collections.Generic;
using GameCore.HotUpdate.ReduxUI;
using UnityEngine;

namespace HudScale
{
    // Runs the install call in the root page. The full page.js (an embedded resource) goes only when the
    // root page does not have it: at once for a root-ready message, else after a short command gave
    // NoScript (a root page that the game built again after a browser crash).
    internal static class PageScript
    {
        private static string script;
        private static readonly HashSet<string> loggedWarnings = new HashSet<string>();

        // The Vite bundle, embedded by HudScale.csproj under this name.
        private static string Script()
        {
            if (script != null) return script;
            using (var stream = typeof(PageScript).Assembly.GetManifestResourceStream("HudScale.page.js"))
            using (var reader = new System.IO.StreamReader(stream))
                script = reader.ReadToEnd();
            return script;
        }

        private static Vuplex.WebView.IWebView WebView() =>
            ReduxUISystem.Instance?.GetWebUILayer()?.canvasWebViewPrefab?.WebView;

        // A full send whose result has not come back yet blocks a second one, for at most this long: a
        // browser crash drops the result. A root-ready message is a new root page, so its send goes always.
        private const float FullSendWaitSeconds = 5f;
        private static float fullSendAt = float.NegativeInfinity;
        // The number of the last full send: only its result opens the gate, not a late one of an older send.
        private static int fullSendId;

        public static void Run(string call, string trigger)
        {
            var webView = WebView();
            if (webView == null)
            {
                Plugin.Log.LogWarning("HUD Scale: web view not found");
                return;
            }
            if (HudScaleLogic.SendsFullScript(trigger))
            {
                SendWithScript(call, trigger);
                return;
            }
            webView.ExecuteJavaScript(HudScaleLogic.InstallCommand(call), (Il2CppSystem.Action<string>)(r =>
            {
                if (r == HudScaleLogic.NoScript) SendWithScript(call, trigger);
                else OnResult(r, call, trigger);
            }));
        }

        private static void SendWithScript(string call, string trigger)
        {
            var webView = WebView();
            float now = Time.realtimeSinceStartup;
            bool newPage = HudScaleLogic.SendsFullScript(trigger);
            if (webView == null || (!newPage && now - fullSendAt < FullSendWaitSeconds)) return;
            fullSendAt = now;
            int id = ++fullSendId;
            if (Plugin.Verbose.Value) Plugin.Log.LogDebug($"HUD Scale page script: sent ({trigger})");
            webView.ExecuteJavaScript(HudScaleLogic.FullCommand(Script(), call), (Il2CppSystem.Action<string>)(r =>
            {
                if (id == fullSendId) fullSendAt = float.NegativeInfinity;
                OnResult(r, call, trigger);
            }));
        }

        private static void OnResult(string r, string call, string trigger)
        {
            if (Plugin.Verbose.Value) Plugin.Log.LogDebug($"HUD Scale install ({trigger}): {call} -> {r}");
            // Each distinct problem logs one time, so a game update is not silent but the log is not spammed.
            if (r != "installed" && loggedWarnings.Add(r ?? "no result")) Plugin.Log.LogWarning($"HUD Scale page script: {r ?? "no result"}");
        }
    }
}
