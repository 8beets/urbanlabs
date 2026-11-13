import { Command } from 'commander';
import { alertsSendCommand } from './alerts-send';
import { centreProbeCommand } from './centre-probe';
import { centresSyncCommand } from './centres-sync';
import { checkBuildCommand } from './check-build';
import { freshnessCommand } from './freshness';
import { ingestCommand } from './ingest';
import { ingestPlanCommand } from './ingest-plan';
import { snapshotCommand } from './snapshot';
import { sourceVerifyCommand } from './source-verify';

// Operational commands (npm run cli -- --help). Run with tsx; not part of the site bundle.
await new Command('urbanlabs')
  .description('UrbanLabs operational commands')
  .addCommand(ingestCommand)
  .addCommand(ingestPlanCommand)
  .addCommand(sourceVerifyCommand)
  .addCommand(centreProbeCommand)
  .addCommand(centresSyncCommand)
  .addCommand(snapshotCommand)
  .addCommand(freshnessCommand)
  .addCommand(alertsSendCommand)
  .addCommand(checkBuildCommand)
  .parseAsync();
