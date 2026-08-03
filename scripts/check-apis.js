#!/usr/bin/env node
const { loadEnv } = require("../src/env");
const { checkApiConnections } = require("../src/apiHealth");

loadEnv();

const args = parseArgs(process.argv.slice(2));

checkApiConnections({
  website: args.website || args._[0] || "garvee.com",
  markets: args.markets || "US",
  platforms: args.platforms || "meta,google,bing",
  sinceDays: Number(args.sinceDays || 30)
})
  .then(result => {
    console.log(`API check for ${result.query.domain}`);
    for (const check of result.checks) {
      const status = check.ok ? "OK" : "WARN";
      const warning = check.warnings.length ? ` | ${check.warnings.join("; ")}` : "";
      console.log(
        `${status} ${check.platform}: ${check.sourceMode}, configured=${check.configured}, ads=${check.ads}, ${check.latencyMs}ms${warning}`
      );
    }
  })
  .catch(error => {
    console.error(error.message);
    process.exit(1);
  });

function parseArgs(argv) {
  const parsed = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=");
    const value = inlineValue === undefined ? argv[index + 1] : inlineValue;
    parsed[rawKey] = value;
    if (inlineValue === undefined) index += 1;
  }

  return parsed;
}
