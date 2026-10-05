import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const tokenPattern = /^local TRACKING_API_TOKEN = "([0-9a-f]{64})"$/m;

function quoteLuaString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/**
 * Returns the API token embedded in the installed filter; rotated whenever the script changes.
 */
export async function ensureTrackingFilter(
  rspamdDirectory: string,
  trackingLuaSourcePath: string,
  trackingBaseUrl: string,
): Promise<string> {
  const stats = await fs
    .stat(rspamdDirectory)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        const msg = `Required Rspamd directory is missing: ${rspamdDirectory}`;
        console.error(msg);

        throw new Error(msg);
      }

      throw error;
    });

  if (!stats.isDirectory()) {
    throw new Error(`${rspamdDirectory} is not a directory`);
  }

  const blacklistPath = path.join(rspamdDirectory, "tracking-blacklist.txt");
  try {
    await fs.writeFile(blacklistPath, "", { flag: "wx" });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "EEXIST"
    ) {
      throw error;
    }
  }

  const targetPath = path.join(rspamdDirectory, "rspamd.local.lua");
  const sourceTemplate = await fs.readFile(trackingLuaSourcePath, "utf8");
  const placeholder = '"__TRACKING_BASE_URL__"';
  if (!sourceTemplate.includes(placeholder)) {
    throw new Error(
      `Tracking URL placeholder is missing from ${trackingLuaSourcePath}`,
    );
  }

  const tokenPlaceholder = '"__TRACKING_API_TOKEN__"';
  if (!sourceTemplate.includes(tokenPlaceholder)) {
    throw new Error(
      `Tracking API token placeholder is missing from ${trackingLuaSourcePath}`,
    );
  }

  const render = (token: string) =>
    sourceTemplate
      .replace(placeholder, () => quoteLuaString(trackingBaseUrl))
      .replace(tokenPlaceholder, () => quoteLuaString(token));

  try {
    const existing = await fs.readFile(targetPath, "utf8");
    const existingToken = tokenPattern.exec(existing)?.[1];
    if (existingToken && existing === render(existingToken)) {
      console.log(`Tracking filter is up-to-date at ${targetPath}`);
      return existingToken;
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }

  const token = crypto.randomBytes(32).toString("hex");
  await fs.writeFile(targetPath, render(token), "utf8");
  console.log(`Tracking filter has been updated at ${targetPath}`);
  return token;
}
