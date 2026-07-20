const path = require("path");
const { spawnSync } = require("child_process");

exports.default = async function embedPalkeepWindowsIcon(context) {
  if (context.electronPlatformName !== "win32") return;

  const projectDir = context.packager.projectDir;
  const executable = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );
  const icon = path.join(projectDir, "build", "icon.ico");
  const resourceEditor = path.join(
    projectDir,
    "node_modules",
    "electron-winstaller",
    "vendor",
    "rcedit.exe",
  );

  const result = spawnSync(
    resourceEditor,
    [
      executable,
      "--set-icon",
      icon,
      "--set-version-string",
      "FileDescription",
      context.packager.appInfo.productName,
      "--set-version-string",
      "ProductName",
      context.packager.appInfo.productName,
      "--set-version-string",
      "CompanyName",
      "AlphaNineGaming",
    ],
    { stdio: "inherit", windowsHide: true },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Could not embed the Palkeep Windows icon (rcedit exit ${result.status}).`);
  }
};
