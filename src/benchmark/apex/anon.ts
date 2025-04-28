/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { DebugLogInfo } from '../../salesforce/soap/debug';
import {
  Benchmark,
  BenchmarkAction,
  BenchmarkResult,
  ErrorResult,
} from '../base';
import { GovernorLimits, LimitsContext } from './schemas';
import {
  executeAnonymous,
  assertAnonymousError,
  extractAssertionData,
} from '../../salesforce/execute';
import { ExecuteAnonymousResponse } from '../../salesforce/soap/executeAnonymous';
import { RunContext } from '../../state/context';
import { ApexBenchmarkOptions } from '../apex';
import { NamedSchema } from '../../text/json';

export interface AnonApexTransaction<C> {
  action: AnonApexAction<C>;
  apexCode: string;
  type: AnonApexTransactionType;
}

export enum AnonApexTransactionType {
  Data,
  Execute,
}

export interface AnonApexAction<C> extends BenchmarkAction {
  context?: C;
  debug?: DebugLogInfo[];
}

export interface AnonApexBenchmarkResult<T, C>
  extends BenchmarkResult<AnonApexAction<C>> {
  data: T;
}

/**
 * Standard benchmark, with optional start/stop calls in apex. If not
 * present, the whole script is assumed to be a benchmark and the code is
 * wrapped with these calls.
 *
 * @example Expected test format
 * // setup
 * benchmark.start();
 * // Apex code to test
 * benchmark.stop();
 * // teardown, extra assertions
 */
export class AnonApexBenchmark<
  T = GovernorLimits,
  C = LimitsContext,
> extends Benchmark<AnonApexAction<C>, AnonApexBenchmarkResult<T, C>> {
  protected transactions: AnonApexTransaction<C>[] = [];
  protected options: ApexBenchmarkOptions;
  protected schema: NamedSchema<T>;

  constructor(options: ApexBenchmarkOptions, schema: NamedSchema<T>) {
    super(options.name);
    this.options = options;
    this.schema = schema;
  }

  /**
   * Prepares an Anonymous Apex script for run. Injects required framework
   * code. Optionally splits into multiple transactions.
   *
   * @param actions Override actions configuration in the benchmark.
   */
  async prepare(actions?: AnonApexAction<C>[]): Promise<void> {
    const { code } = this.options;

    let content;
    if (!code.includes('benchmark.start(')) {
      content = 'benchmark.start();';
    }
    if (!code.includes('benchmark.stop(')) {
      content += code + 'benchmark.stop();';
    }

    this.transactions = [
      {
        action: (actions && actions[0]) || { name: '1' },
        apexCode:
          require('../../../scripts/apex/limits.apex') +
          require('../../../scripts/apex/benchmark.apex') +
          'benchmark.begin();' +
          content +
          'benchmark.end();',
        type: AnonApexTransactionType.Data,
      },
    ];
  }

  /**
   * Execute Anonymous Apex transactions and accumulate results and errors.
   */
  async run(): Promise<void> {
    this.reset();

    for (const transaction of this.transactions) {
      if (this._error) {
        break;
      }

      try {
        const response = await executeAnonymous(
          RunContext.current.org.connection,
          transaction.apexCode,
          transaction.action.debug || this.options.debug
        );

        if (transaction.type === AnonApexTransactionType.Data) {
          this._results.push(this.toBenchmarkResult(response, transaction));
        } else {
          // for other transaction types, treat errors normally
          // and halt benchmarking
          const err = assertAnonymousError(response);
          if (err) {
            throw err;
          }
        }
      } catch (e) {
        this._error = this.toErrorResult(e, transaction);
      }
    }
  }

  protected toBenchmarkResult(
    response: ExecuteAnonymousResponse,
    transaction: AnonApexTransaction<C>
  ): AnonApexBenchmarkResult<T, C> {
    return {
      name: this.name,
      action: transaction.action,
      data: extractAssertionData(response, this.schema),
    };
  }

  protected toErrorResult(
    e: unknown,
    transaction: AnonApexTransaction<C>
  ): ErrorResult {
    return {
      name: this.name,
      actionName: transaction.action.name,
      error: e instanceof Error ? e : new Error(`${e}`),
    };
  }
}
