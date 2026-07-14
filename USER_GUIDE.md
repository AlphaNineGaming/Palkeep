# Palkeep Easy User Guide

Palkeep is a Windows desktop companion for managing Palworld dedicated servers
and single-player worlds. This guide starts with the safest setup and explains
how to activate live item delivery.

## Before you begin

- Close Palworld before installing or updating the live bridge.
- Back up important worlds. Palkeep also creates a backup before every offline
  single-player change.
- Use the bridge only with your own local game or a server you are authorized
  to manage.

## Palkeep application updates

Palkeep checks for newer Beta releases every time it starts. When an update is
available, it downloads in the background and shows its progress at the top of
the window. Choose **Restart and install** when prompted, or close Palkeep and
the downloaded update will install automatically.

Versions older than 0.6.6 Beta only detect releases and cannot install them.
Install 0.6.6 Beta manually once to enable automatic updates for future builds.

## Quick start: single player

1. Install and open Palkeep.
2. Select **Single player**.
3. Palkeep normally finds Steam and Xbox/Microsoft Store worlds automatically.
4. Select your world and character.
5. Use **Inventory**, **Palbox**, **Item Database**, or **Pal Database**.
6. Keep Palworld closed when making protected offline changes.

> [!IMPORTANT]
> ## Activate the live bridge
>
> The bridge is required when you want an item to appear immediately while
> your single-player world is running.
>
> 1. **Close Palworld completely.** The bridge cannot be installed or updated
>    while the game is running.
> 2. Open Palkeep and select **Single player**.
> 3. Find **Enable live delivery** at the bottom of the left sidebar.
> 4. Click **Install bridge**.
> 5. If Palkeep asks for a folder, choose the main **Palworld** game folder—not
>    `Pal/Binaries/Win64` and not your save folder.
> 6. Wait for the “Live bridge installed” message.
> 7. Start Palworld and load the character into the world.
> 8. Leave Palkeep open. Within a few seconds, the sidebar should turn green
>    and show **Live delivery ready** with the detected player name.

Common game folder examples:

```text
C:\Program Files (x86)\Steam\steamapps\common\Palworld
D:\SteamLibrary\steamapps\common\Palworld
C:\XboxGames\Palworld
```

### Confirm that live delivery works

1. In Palkeep, open **Inventory** and select **Give item**.
2. Find the item and set its quantity.
3. Select **Live in running game** as the delivery method.
4. Click **Deliver item**.
5. Check the character inventory in Palworld.

The current built-in single-player bridge supports live item delivery. Pal
creation and other save changes use the protected offline editor unless a
future bridge version explicitly marks them as live.

## If the bridge does not become ready

Try these checks in order:

1. Make sure the character is fully inside a loaded world, not on the title or
   world-selection screen.
2. Wait 5–10 seconds; Palkeep checks the bridge repeatedly.
3. Close Palworld completely, reopen it, and enter the world again.
4. Confirm that Palkeep says **Live bridge installed**.
5. If **Install bridge** appears again, reinstall it while Palworld is closed.
6. If Palkeep reports a conflicting `dwmapi.dll`, another mod loader is already
   present. Configure or remove that conflicting loader before retrying. Do not
   delete it blindly if other mods depend on it.
7. If Windows blocked the files, review Windows Security protection history and
   allow them only if you downloaded Palkeep from the official GitHub release.
8. If Palkeep cannot write to the game folder, close it and run Palkeep as
   administrator once to install the bridge.

After a Palworld update, close the game and use **Update bridge** if Palkeep
shows that a newer bridge version is available.

## Protected offline editing

Offline editing is the safer fallback when live delivery is unavailable:

1. Close Palworld.
2. Choose the world and character in Palkeep.
3. Add the item or Pal and select the offline delivery option.
4. Palkeep backs up the save, applies the change, and validates the rewritten
   save before replacing the original.
5. Start Palworld and inspect the result.

Never edit a single-player save while Palworld is running. The game can
overwrite the change or leave the save in an inconsistent state.

## Dedicated server mode

1. Select **Server**.
2. Open the connection settings.
3. Enter the Palworld REST API address, administrator username, and password.
4. Keep the default loopback address when Palkeep runs on the same machine as
   the server.
5. Save and test the connection.

Pocketpair's official REST API provides server status, players, settings,
saves, announcements, kicks, and bans. Live inventory, Palbox, teleport, and
private-message operations require a separate compatible server-side HTTP
bridge. This is different from the built-in single-player bridge described
above. Keep such a bridge bound to loopback or a trusted private network.

## Backups and recovery

- Palkeep creates a complete backup before every offline mutation.
- Open **Backups** to review or restore a previous save.
- Restore only while Palworld is closed.
- Keep an additional manual copy before experimenting with large changes.

## Getting help

- [Palkeep releases](https://github.com/AlphaNineGaming/Palkeep/releases)
- [Discord community](https://discord.gg/RQsVw2vyg)
- [Support development on Ko-fi](https://ko-fi.com/E1W220NMPA)

When asking for help, include the Palkeep version/build, Palworld store
(Steam or Xbox/Microsoft Store), the status shown under live delivery, and the
exact error message. Do not share passwords, bridge tokens, or private server
addresses.
