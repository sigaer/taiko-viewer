import { readFile } from "node:fs/promises";
import { openAccountTitleDb } from "./account_title_db.mjs";
import { grantAnnualBetaTitle, normalizeRoster, rosterHash, ANNUAL_BETA_TITLE_SOURCE } from "../server/services/account-titles/annual-beta-grant.ts";
import { ANNUAL_BETA_TITLE } from "../server/services/account-titles/repository.ts";

// Recipient identities stay in a private reviewed manifest, never in Git.
const args = process.argv.slice(2);
const production = args.includes("--production"), apply = args.includes("--apply");
const flags = args.filter(arg => arg.startsWith("--"));
if (flags.some(flag => !["--production", "--apply", "--manifest"].includes(flag))) throw Error("Unknown title grant flag");
const path = args[args.indexOf("--manifest") + 1];
if (!args.includes("--manifest") || !path?.startsWith("/")) throw Error("Absolute private manifest path required");
const manifest = JSON.parse(await readFile(path, "utf8"));
const ids = normalizeRoster(manifest.userIds);
if (manifest.campaign !== ANNUAL_BETA_TITLE_SOURCE || manifest.titleName !== ANNUAL_BETA_TITLE.name ||
    manifest.recipientCount !== ids.length || manifest.rosterSha256 !== rosterHash(ids) || (production && ids.length !== 39)) {
  throw Error("Reviewed title grant manifest does not match this campaign");
}
const connection = await openAccountTitleDb({ production, apply });
try {
  const result = await grantAnnualBetaTitle(connection.db, ids, apply);
  console.log(JSON.stringify({ database: connection.database, action: apply ? "grant" : "preview", ...result }));
} finally { await connection.close(); }
