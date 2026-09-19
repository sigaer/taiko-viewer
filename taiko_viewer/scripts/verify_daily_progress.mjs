#!/usr/bin/env node
// Compatibility entry point: acceptance now requires authoritative snapshot replay.
// Invoke with Node's --experimental-strip-types flag, inside the bounded QA runner.
import './verify_growth_closure.mjs';
