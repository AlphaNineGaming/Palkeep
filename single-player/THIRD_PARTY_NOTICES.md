# Palkeep single-player engine notices

Release packages contain a Python runtime and native save-format component so
Palkeep can edit local saves without requiring a separate installation. Native
binaries are not committed to the source repository. They are reconstructed by
`scripts/prepare-single-player.ps1` from the pinned sources and checksums in
`dependencies.lock.json`.

- Python 3.12.10 is distributed under the Python Software Foundation License.
  Its license is included as `runtime/LICENSE.txt`.
- `palworld-save-tools` is Copyright (c) 2024 Jun Siang Cheah and distributed
  under the MIT License. See `PALWORLD_SAVE_TOOLS_LICENSE.txt`.
- PalEdit-derived Oodle support is Copyright (c) 2024 Jacob Lawrence and is
  distributed under the MIT License. See `PALEDIT_LICENSE.txt`.
- The bundled `ooz`/`pyooz` compression binding is distributed under
  GPL-3.0-or-later. Source is available from
  https://github.com/MRHRTZ/pyooz and https://github.com/MRHRTZ/ooz.

Each generated release runtime includes `runtime-manifest.json`, containing the
source commits and SHA-256 digest of every generated native file.

Palkeep uses this engine only as a separate local helper process. No save data
is uploaded or transmitted.
