/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import path from 'node:path';
import { ErrorResult } from '../benchmark/base';
import {
  AnonymousOptions,
  ApexAction,
  ApexBenchmark,
  ApexBenchmarkResult,
  createApexBenchmark,
} from '../benchmark/apex';
import {
  ApexSourceOptions,
  findApexInDir,
  readApex,
  readApexFromFile,
  resolveApexPath,
} from './apex/source';
import { RunContext, RunContextOptions } from '../state/context';
import { LimitsDegMetric, LimitsDegMetricOptions } from '../metrics/limits';
import { RunStore } from '../state/store';
import { WriteMapper } from '../database/mapper/interop';

export interface ApexBenchmarkServiceOptions
  extends RunContextOptions,
    AnonymousOptions {
  limitsDegradation?: LimitsDegMetricOptions;

  useLegacySchema?: boolean;
}

export interface BenchmarkDirectoryOptions
  extends ApexSourceOptions,
    AnonymousOptions {}

export interface BenchmarkSingleOptions
  extends ApexSourceOptions,
    AnonymousOptions {
  name: string;
  actions?: ApexAction[];
}

export interface BenchmarkDirectoryResult {
  benchmarks: ApexBenchmarkResult[];
  errors: ErrorResult[];
}

export interface BenchmarkSingleResult {
  benchmarks: ApexBenchmarkResult[];
  error?: ErrorResult;
}

export class ApexBenchmarkService {
  protected isSetup: boolean = false;
  protected run: RunContext;
  protected store: RunStore<ApexBenchmarkResult>;
  protected deg?: LimitsDegMetric;

  constructor() {
    this.run = RunContext.current;
    this.store = new RunStore();
  }

  /**
   * Customise behaviour of the benchmarking service.
   */
  async setup(options: ApexBenchmarkServiceOptions = {}): Promise<void> {
    if (this.isSetup) {
      return;
    }

    await this.run.setup(options);

    if (options.useLegacySchema) {
      await this.run.setupPgLegacy(options.pg);
    }

    this.deg = new LimitsDegMetric(this.run.pgQuery, options.limitsDegradation);

    this.isSetup = true;
  }

  restore() {
    this.run = RunContext.reset();
    this.store = new RunStore();
    this.isSetup = false;
  }

  /**
   * Run benchmarks for all apex files under the specified directory path.
   *
   * @param apexPath Path to directory containing ".apex" files.
   * @param options Additional options to customise the benchmark.
   * @returns A merged list of results from all identified benchmarks.
   */
  async benchmarkDirectory(
    apexPath: string,
    options?: BenchmarkDirectoryOptions
  ): Promise<BenchmarkDirectoryResult> {
    await this.setup();
    const { root, paths } = await findApexInDir(apexPath);

    const results: BenchmarkSingleResult[] = [];
    for (const apexfile of paths) {
      const name = path.relative(root, apexfile).replace('.apex', '');
      const benchmark = createApexBenchmark({
        ...options,
        name,
        code: await readApexFromFile(apexfile, options),
      });

      await benchmark.prepare();

      const result = await this.runBenchmark(benchmark);

      results.push(result);
    }

    const result = this.mergeDirResults(results);
    const benchmarks = await this.applyMetrics(result.benchmarks);

    this.store.addItems(benchmarks);

    return { ...result, benchmarks };
  }

  /**
   * Run a benchmark for a single apex file.
   *
   * @param apexFilePath Path to ".apex" file containing benchmark script.
   * @param options Additional options to customise the benchmark.
   * @returns An object with reported results and errors.
   */
  async benchmarkFile(
    apexFilePath: string,
    options?: BenchmarkSingleOptions
  ): Promise<BenchmarkSingleResult> {
    const absPath = await resolveApexPath(apexFilePath);
    const code = await readApexFromFile(absPath, options);

    return this.benchmarkCode(code, {
      ...options,
      name: options?.name || path.basename(absPath, '.apex'),
    });
  }

  /**
   * Run a benchmark on Anonymous Apex code.
   *
   * @param apexCode Apex code to be benchmarked. Supports different formats.
   * @param options Additional options to customise the benchmark.
   * @returns An object with reported results and errors.
   */
  async benchmarkCode(
    apexCode: string,
    options: BenchmarkSingleOptions
  ): Promise<BenchmarkSingleResult> {
    await this.setup();

    const benchmark = createApexBenchmark({
      ...options,
      code: await readApex(apexCode, options),
    });

    await benchmark.prepare(options.actions);

    const result = await this.runBenchmark(benchmark);
    const benchmarks = await this.applyMetrics(result.benchmarks);

    this.store.addItems(benchmarks);

    return { ...result, benchmarks };
  }

  /**
   * Sync current stored results to configured data sources.
   */
  async save(): Promise<void> {
    await this.run.save();
    await this.run.forAllDataSources(this.saveResults);
    this.store.moveCursor();
  }

  private async runBenchmark(
    benchmark: ApexBenchmark
  ): Promise<BenchmarkSingleResult> {
    await benchmark.run();

    return {
      benchmarks: benchmark.results(),
      error: benchmark.error(),
    };
  }

  private async applyMetrics(
    results: ApexBenchmarkResult[]
  ): Promise<ApexBenchmarkResult[]> {
    if (!this.deg) {
      return results;
    }
    return this.deg.calculate(results);
  }

  private mergeDirResults(
    runs: BenchmarkSingleResult[]
  ): BenchmarkDirectoryResult {
    return runs.reduce(
      (acc, curr) => {
        acc.benchmarks.push(...curr.benchmarks);
        if (curr.error) acc.errors.push(curr.error);
        return acc;
      },
      { benchmarks: [], errors: [] } as BenchmarkDirectoryResult
    );
  }

  private async saveResults(mapper: WriteMapper): Promise<void> {
    const orgContext = await this.run.org.getContext();

    const results = this.store.getItemsFromCursor();

    // TODO call various mapper methods for each entity
  }
}
