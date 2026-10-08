#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((err) => {
  // Command failures surface here only for unexpected bugs —
  // handled user-facing errors exit() on their own.
  console.error(err?.stack ?? err);
  process.exit(1);
});
