/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { LimitsDeg } from '../metrics/limits';
import { DebugLogInfo } from '../salesforce/soap/debug';
import {
  AnonApexAction,
  AnonApexBenchmark,
  AnonApexBenchmarkResult,
} from './apex/anon';
import { LegacyAnonApexBenchmark } from './apex/legacy';
import { GovernorLimits, LimitsContext, limitsSchema } from './apex/schemas';

export type ApexBenchmark = AnonApexBenchmark;
export type ApexAction = AnonApexAction<LimitsContext>;
export type ApexMetrics = {
  deg?: LimitsDeg;
};
export type ApexBenchmarkResult = AnonApexBenchmarkResult<
  GovernorLimits,
  LimitsContext
> &
  ApexMetrics;

export interface AnonymousOptions {
  /**
   * Set debug logging behaviour.
   */
  debug?: DebugLogInfo[];
}

export interface ApexBenchmarkOptions extends AnonymousOptions {
  /**
   * Name to identify the benchmark run in final results.
   */
  name: string;

  /**
   * Full apex script to be used in benchmark.
   */
  code: string;
}

export function createApexBenchmark(
  options: ApexBenchmarkOptions
): ApexBenchmark {
  if (
    options.code.includes('new GovernorLimits()') &&
    options.code.includes("System.assert(false, '-_'")
  ) {
    return new LegacyAnonApexBenchmark(options);
  }

  return new AnonApexBenchmark(options, limitsSchema);
}
