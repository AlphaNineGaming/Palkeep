# Palkeep Server Command

Palkeep is a Windows desktop control center for Palworld dedicated servers and
single-player worlds.

[Download the latest Windows Beta](https://github.com/AlphaNineGaming/Palkeep/releases)

**New to Palkeep?** Read the [easy user guide](USER_GUIDE.md), including the
step-by-step instructions for activating the single-player live bridge.

Palkeep checks GitHub Releases when the desktop app starts, downloads newer
Beta builds in the background, and prompts when the update is ready to install.
Downloaded updates install when Palkeep restarts or closes. The installed
version and Beta build are shown in the sidebar and About window.

## Modes

- **Server:** reads the official dedicated-server REST API and uses an optional
  local bridge for live inventory, Palbox, teleport, and messaging operations.
- **Single player:** discovers Steam saves under
  `%LOCALAPPDATA%\Pal\Saved\SaveGames`, reads current `PlM`/Oodle and legacy
  `PlZ` saves, and supports offline inventory and Palbox changes.

Single-player writes are blocked while Palworld is running. Palkeep creates a
complete backup before every mutation, validates the rewritten save before
replacing `Level.sav`, and exposes one-click restore points stored outside the
Steam Cloud save tree.

## Development

```powershell
npm install
npm run desktop:run
```

Build the Windows installer with:

```powershell
npm run build:win
```

The bundled save engine and its third-party notices are in `single-player/`.
No save data is uploaded or transmitted.

### Binary provenance

Native single-player binaries are not stored in the source repository. Windows
builds download the checksum-pinned official Python runtime and compile the
Oodle-compatible module from pinned source commits. CI verifies signatures,
hashes, imports, and the no-binaries-in-source policy before packaging. See
[SECURITY.md](SECURITY.md) and [dependencies.lock.json](dependencies.lock.json).

The same policy applies to the optional live bridge: its two UE4SS loader DLLs
are reconstructed from a checksum-pinned upstream Palworld release and verified
before packaging.

## Community and support

Palkeep is created and maintained by **AlphaNineGaming**.

- [Support development on Ko-fi](https://ko-fi.com/E1W220NMPA)
- [Join the Discord community](https://discord.gg/RQsVw2vyg)
- [Watch AlphaNineGaming on YouTube](https://www.youtube.com/@AlphanineGaming)
- [Follow AlphaNineGaming on Twitch](https://www.twitch.tv/alphanine_gaming)

Palworld © Pocketpair, Inc. Palkeep is an independent community project and is
not affiliated with or endorsed by Pocketpair.
