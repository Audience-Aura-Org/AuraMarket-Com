/**
 * scripts/run-invariants.js
 * One-off invariant reconciliation runner.
 *
 * Usage:
 *   node scripts/run-invariants.js              # all 30 checks
 *   node scripts/run-invariants.js INV-01,INV-04  # specific IDs
 *   node scripts/run-invariants.js --json       # machine-readable JSON output
 */

'use strict';

require('../config/env');

const mongoose = require('mongoose');
const { runInvariants } = require('../jobs/invariants');

// Pre-register all models used by the checks
require('../models/User.model');
require('../models/Transaction.model');
require('../models/Order.model');
require('../models/Escrow.model');
require('../models/Dispute.model');
require('../models/Shipment.model');
require('../models/WithdrawalRequest.model');
require('../models/Product.model');
require('../models/Coupon.model');
require('../models/Vendor.model');
require('../models/UserSubscription.model');
require('../models/SubscriptionPlan.model');
require('../models/PlatformSettings.model');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const subsetArg = args.find((a) => !a.startsWith('--'));
const subset = subsetArg ? subsetArg.split(',').map((s) => s.trim()) : undefined;

const PASS  = '\x1b[32m✔\x1b[0m';
const FAIL  = '\x1b[31m✘\x1b[0m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const DIM   = '\x1b[2m';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.log(DIM + `Connected to MongoDB. Running ${subset ? subset.join(', ') : 'all 30'} invariant checks…` + RESET);

  const { results, summary } = await runInvariants({ subset });

  if (jsonMode) {
    console.log(JSON.stringify({ summary, results }, null, 2));
  } else {
    console.log('');
    for (const r of results) {
      const icon = r.ok ? PASS : FAIL;
      const label = r.ok ? GREEN + 'PASS' + RESET : RED + 'FAIL' + RESET;
      console.log(`${icon} ${BOLD}${r.id}${RESET}  [${label}]  ${DIM}${r.description}  (checked ${r.checked})${RESET}`);

      if (!r.ok) {
        for (const v of r.violations.slice(0, 5)) {
          console.log(`   ${RED}↳${RESET} ${JSON.stringify(v)}`);
        }
        if (r.violations.length > 5) {
          console.log(`   ${DIM}…and ${r.violations.length - 5} more${RESET}`);
        }
      }
    }

    console.log('');
    console.log('─'.repeat(60));
    const status = summary.failed === 0 ? GREEN + 'ALL CLEAR' + RESET : RED + 'VIOLATIONS FOUND' + RESET;
    console.log(`${BOLD}${status}${RESET}  ${summary.passed}/${summary.total} passed  •  ${summary.total_violations} total violations`);
    console.log(`${DIM}Run at: ${summary.run_at}${RESET}`);
    console.log('─'.repeat(60));
  }

  await mongoose.disconnect();
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(2);
});
