# Palkeep single-player engine notices

This folder contains a bundled Python runtime and save-format components so
Palkeep can edit local saves without requiring a separate installation.

- Python 3.12.10 is distributed under the Python Software Foundation License.
  Its license is included as `runtime/LICENSE.txt`.
- `palworld-save-tools` is Copyright (c) 2024 Jun Siang Cheah and distributed
  under the MIT License. See `PALWORLD_SAVE_TOOLS_LICENSE.txt`.
- PalEdit-derived Oodle support is Copyright (c) 2024 Jacob Lawrence and is
  distributed under the MIT License. See `PALEDIT_LICENSE.txt`.
- The bundled `ooz`/`pyooz` compression binding is distributed under
  GPL-3.0-or-later. Source is available from
  https://github.com/MRHRTZ/pyooz and https://github.com/MRHRTZ/ooz.

Palkeep uses this engine only as a separate local helper process. No save data
is uploaded or transmitted.
