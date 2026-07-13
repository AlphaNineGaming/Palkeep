# Palkeep Server Command

Palkeep is a Windows desktop control center for Palworld dedicated servers and
single-player worlds.

[Download the latest Windows release](https://github.com/AlphaNineGaming/Palkeep/releases/latest)

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

## Community and support

Palkeep is created and maintained by **AlphaNineGaming**.

- [Support development on Ko-fi](https://ko-fi.com/E1W220NMPA)
- [Join the Discord community](https://discord.gg/RQsVw2vyg)
- [Watch AlphaNineGaming on YouTube](https://www.youtube.com/@AlphanineGaming)
- [Follow AlphaNineGaming on Twitch](https://www.twitch.tv/alphanine_gaming)

Palworld © Pocketpair, Inc. Palkeep is an independent community project and is
not affiliated with or endorsed by Pocketpair.
