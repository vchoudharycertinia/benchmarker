/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { ApexBenchmarkOptions } from '../apex';
import {
  AnonApexAction,
  AnonApexBenchmark,
  AnonApexTransactionType,
} from './anon';
import { LimitsContext, limitsSchema } from './schemas';

/**
 * Old (deprecated) test structure, with manual tracking and return of limits.
 *
 * @example Expected test format
 * // setup
 * GovernorLimits initialLimits = (new GovernorLimits()).getCurrentGovernorLimits();
 * // Apex code to test
 * GovernorLimits finalLimits = (new GovernorLimits()).getCurrentGovernorLimits();
 * GovernorLimits limitsDiff = (new GovernorLimits()).getLimitsDiff(initialLimits, finalLimits);
 * // teardown, extra assertions
 * System.assert(false, '-_' + JSON.serialize(limitsDiff) + '_-');
 */
export class LegacyAnonApexBenchmark extends AnonApexBenchmark {
  constructor(options: ApexBenchmarkOptions) {
    super(options, limitsSchema);
  }

  async prepare(actions?: AnonApexAction<LimitsContext>[]): Promise<void> {
    const { code } = this.options;
    this.transactions = [
      {
        action: (actions && actions[0]) || { name: '1' },
        apexCode: require('../../../scripts/apex/limits.apex') + code,
        type: AnonApexTransactionType.Data,
      },
    ];
  }
}
