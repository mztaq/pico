#!/usr/bin/env node
// Run locally. This script never writes the secret into the repository.
import { randomBytes, createHash } from "node:crypto";

const label=process.argv.slice(2).join(" ").trim();
if(label.length<2||label.length>60){
  console.error('Usage: node scripts/create-status-admin-invite.mjs "Laptop label"');
  process.exitCode=1;
}else{
  const token=randomBytes(32).toString("base64url");
  const digest=createHash("sha256").update(token).digest("hex");
  const escaped=label.replaceAll("'","''");
  console.log("\n1) In Cloudflare D1 pico-db SQL Console, run this command:\n");
  console.log("INSERT INTO pico_status_admin_invites (token_hash, label, expires_at)");
  console.log("VALUES ('"+digest+"', '"+escaped+"', unixepoch() + 86400);\n");
  console.log("2) Open this private link on the browser to approve:\n");
  console.log("https://status.picompiler.pages.dev/enroll#"+token+"\n");
  console.log("The link expires after 24 hours or its first use. Keep it private.");
  console.log("Approved browsers get a revocable session valid for 30 days.\n");
}
