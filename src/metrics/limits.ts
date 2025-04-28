/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { ApexBenchmarkResult } from '../benchmark/apex';
import { GovernorLimits, LimitsThresholds } from '../benchmark/apex/schemas';
import { ReadMapper } from '../database/mapper/interop';
import { RunContext } from '../state/context';
import {
  getRangeCollection,
  getTotalThreshold,
  OffsetThresholdRange,
  RangeCollection,
} from './limits/ranges';

export interface LimitsDegMetricOptions {
  enable?: boolean;
  customRangesPath?: string;
}

export enum LimitsDegType {
  // exceeds avg+offset
  Offset = 'offset',
  // exceeds value
  Threshold = 'threshold',
}

export interface LimitsDeg {
  cpuTimeDeg: number;
  dmlRowsDeg: number;
  dmlStatementsDeg: number;
  heapSizeDeg: number;
  queryRowsDeg: number;
  soqlQueriesDeg: number;
  degType: LimitsDegType;
}

export interface LimitsAvg {
  name: string;
  action: string;
  cpuTimeAvg: number;
  dmlRowsAvg: number;
  dmlStatementsAvg: number;
  heapSizeAvg: number;
  queryRowsAvg: number;
  soqlQueriesAvg: number;
}

export class LimitsDegMetric {
  protected options: LimitsDegMetricOptions;
  protected globalEnabled: boolean;
  protected dataMapper?: ReadMapper;
  protected ranges?: RangeCollection;

  constructor(
    dataMapper: ReadMapper | undefined,
    options: LimitsDegMetricOptions = {}
  ) {
    this.dataMapper = dataMapper;
    this.options = options;
    this.globalEnabled = options.enable
      ? options.enable
      : Boolean(process.env.ENABLE_METRICS) ||
        false ||
        Boolean(process.env.STORE_ALERTS) ||
        false;
  }

  async calculate(
    results: ApexBenchmarkResult[]
  ): Promise<ApexBenchmarkResult[]> {
    const metricsToDo = this.identifyEnabled(results);
    if (metricsToDo.size == 0) {
      return results;
    }

    const avgDict = await this.getRecentAverages(metricsToDo);

    const resultsAndMetrics = [...results];
    for (const [idx, bench] of metricsToDo) {
      // avg can be disabled if no connection or missing if not enough recent data
      const avg: LimitsAvg | undefined = avgDict[idx];
      const thresholds = bench.action.context?.thresholds;

      let deg: LimitsDeg | undefined;
      if (thresholds) {
        deg = this.calculateThresholdDeg(bench.data, thresholds, avg);
      } else if (avg) {
        deg = await this.calculateOffsetDeg(bench.data, avg);
      }

      resultsAndMetrics[idx] = { ...bench, deg };
    }

    return resultsAndMetrics;
  }

  private identifyEnabled(
    results: ApexBenchmarkResult[]
  ): Map<number, ApexBenchmarkResult> {
    return results.reduce((acc, curr, idx) => {
      const localEnabled = curr.action.context?.enableMetrics;
      if (localEnabled || (localEnabled == null && this.globalEnabled)) {
        acc.set(idx, curr);
      }
      return acc;
    }, new Map<number, ApexBenchmarkResult>());
  }

  private async getRecentAverages(
    results: Map<number, ApexBenchmarkResult>
  ): Promise<Record<number, LimitsAvg>> {
    if (!this.dataMapper) {
      return {};
    }

    const names = new Set<string>();
    const actions = new Set<string>();
    const nameIndexes: Record<string, number> = {};
    results.forEach(({ name, action }, key) => {
      names.add(name);
      actions.add(action.name);
      nameIndexes[name + action.name] = key;
    });

    const records = await this.dataMapper.selectLimitsTenDayAverage(
      RunContext.current.projectId,
      Array.from(names.values()),
      Array.from(actions.values())
    );

    const avg: Record<number, LimitsAvg> = {};
    records.forEach(rec => {
      avg[nameIndexes[rec.name + rec.action]] = rec;
    });

    return avg;
  }

  private calculateThresholdDeg(
    data: GovernorLimits,
    thresholds: LimitsThresholds,
    avg?: LimitsAvg
  ): LimitsDeg {
    return {
      cpuTimeDeg: this.calcDiffWithThreshold(
        data.cpuTime,
        thresholds.cpuTimeThreshold,
        avg?.cpuTimeAvg
      ),
      dmlRowsDeg: this.calcDiffWithThreshold(
        data.dmlRows,
        thresholds.dmlRowThreshold,
        avg?.dmlRowsAvg
      ),
      dmlStatementsDeg: this.calcDiffWithThreshold(
        data.dmlStatements,
        thresholds.dmlStatementThreshold,
        avg?.dmlStatementsAvg
      ),
      heapSizeDeg: this.calcDiffWithThreshold(
        data.heapSize,
        thresholds.heapSizeThreshold,
        avg?.heapSizeAvg
      ),
      queryRowsDeg: this.calcDiffWithThreshold(
        data.queryRows,
        thresholds.queryRowsThreshold,
        avg?.queryRowsAvg
      ),
      soqlQueriesDeg: this.calcDiffWithThreshold(
        data.soqlQueries,
        thresholds.soqlQueriesThreshold,
        avg?.soqlQueriesAvg
      ),
      degType: LimitsDegType.Threshold,
    };
  }

  private calcDiffWithThreshold(
    value: number,
    threshValue: number,
    avgValue?: number
  ): number {
    // avoid negatives by diffing against threshold if avg unavailable / invalid
    const diffValue = avgValue ? Math.min(avgValue, threshValue) : threshValue;
    return value > threshValue ? value - diffValue : 0;
  }

  private async calculateOffsetDeg(
    data: GovernorLimits,
    avg: LimitsAvg
  ): Promise<LimitsDeg> {
    const ranges = await this.getRanges();

    return {
      cpuTimeDeg: this.calcDiffWithOffset(
        data.cpuTime,
        avg.cpuTimeAvg,
        ranges.cpu_ranges
      ),
      dmlRowsDeg: this.calcDiffWithOffset(
        data.dmlRows,
        avg.dmlRowsAvg,
        ranges.dmlRows_ranges
      ),
      dmlStatementsDeg: this.calcDiffWithOffset(
        data.dmlStatements,
        avg.dmlStatementsAvg,
        ranges.dml_ranges
      ),
      heapSizeDeg: this.calcDiffWithOffset(
        data.heapSize,
        avg.heapSizeAvg,
        ranges.heap_ranges
      ),
      queryRowsDeg: this.calcDiffWithOffset(
        data.queryRows,
        avg.queryRowsAvg,
        ranges.queryRows_ranges
      ),
      soqlQueriesDeg: this.calcDiffWithOffset(
        data.soqlQueries,
        avg.soqlQueriesAvg,
        ranges.soql_ranges
      ),
      degType: LimitsDegType.Offset,
    };
  }

  private async getRanges(): Promise<RangeCollection> {
    if (!this.ranges) {
      this.ranges = await getRangeCollection(
        this.options.customRangesPath || process.env.CUSTOM_RANGES_PATH
      );
    }
    return this.ranges;
  }

  private calcDiffWithOffset(
    value: number,
    avgValue: number,
    ranges: OffsetThresholdRange[]
  ): number {
    return value > getTotalThreshold(avgValue, ranges) ? value - avgValue : 0;
  }
}
