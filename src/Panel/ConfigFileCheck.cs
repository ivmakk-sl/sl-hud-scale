using System;
using System.IO;

namespace HudScale
{
    // Tells whether the config file was written since the last record. BepInEx does not watch the
    // file, so the mod checks it when the settings window opens and when a HUD page loads, and reads
    // it again only when it changed. The mod records after each of its own saves.
    public sealed class ConfigFileCheck
    {
        private readonly string path;
        private DateTime? recorded;

        public ConfigFileCheck(string path)
        {
            this.path = path;
        }

        // A missing file is no change: there is nothing to read again.
        public bool Changed()
        {
            if (!File.Exists(path)) return false;
            return recorded != File.GetLastWriteTimeUtc(path);
        }

        public void Record()
        {
            recorded = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : (DateTime?)null;
        }
    }
}
