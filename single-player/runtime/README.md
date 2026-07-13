# Generated Python runtime

This directory is intentionally almost empty in source control.

Run the following command on Windows to download the checksum-pinned official
Python embedded distribution and build the native Oodle module from pinned
source:

```powershell
npm run prepare:single-player
```

The exact URLs, commits, submodule commits, and checksums are recorded in
`dependencies.lock.json`. CI performs the same reconstruction from a clean
checkout and runs `scripts/verify-supply-chain.ps1` before packaging.

Do not commit generated DLL, EXE, PYD, ZIP, CAT, or `_pth` files.
