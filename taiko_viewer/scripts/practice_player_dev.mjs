// Owned and stopped by verify_practice_player.mjs inside its bounded QA cgroup.
import { runCommand } from '@nuxt/cli';

await runCommand('dev', ['--no-fork', '--host', '127.0.0.1', '--port', '3197'], {
  // UI-only QA must not start application maintenance or recovery jobs.
  overrides: { nitro: { ignore: ['plugins/**', '**/server/plugins/**'] } }
});
