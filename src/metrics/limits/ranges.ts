/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { NamedSchema, parseType } from '../../text/json';
import { JTDSchemaType } from 'ajv/dist/core';

export interface OffsetThresholdRange {
  start_range: number;
  end_range: number;
  offset_threshold: number;
}

export interface RangeCollection {
  cpu_ranges: OffsetThresholdRange[];
  dml_ranges: OffsetThresholdRange[];
  dmlRows_ranges: OffsetThresholdRange[];
  heap_ranges: OffsetThresholdRange[];
  queryRows_ranges: OffsetThresholdRange[];
  soql_ranges: OffsetThresholdRange[];
}

const offsetSchemaType: JTDSchemaType<OffsetThresholdRange> = {
  properties: {
    start_range: { type: 'int32' },
    end_range: { type: 'int32' },
    offset_threshold: { type: 'int32' },
  },
};

const rangeSchema: NamedSchema<RangeCollection> = {
  name: 'customRanges',
  schema: {
    properties: {
      cpu_ranges: { elements: offsetSchemaType },
      dml_ranges: { elements: offsetSchemaType },
      dmlRows_ranges: { elements: offsetSchemaType },
      heap_ranges: { elements: offsetSchemaType },
      queryRows_ranges: { elements: offsetSchemaType },
      soql_ranges: { elements: offsetSchemaType },
    },
  },
};

const defaultRanges: RangeCollection = {
  cpu_ranges: [
    { start_range: 0, end_range: 2000, offset_threshold: 3000 },
    { start_range: 2001, end_range: 4000, offset_threshold: 2500 },
    { start_range: 4001, end_range: 6000, offset_threshold: 2000 },
    { start_range: 6001, end_range: 8000, offset_threshold: 1500 },
    { start_range: 8001, end_range: 9000, offset_threshold: 1000 },
    { start_range: 9000, end_range: 9500, offset_threshold: 500 },
    { start_range: 9501, end_range: 9999, offset_threshold: 100 },
  ],
  dml_ranges: [
    { start_range: 0, end_range: 50, offset_threshold: 5 },
    { start_range: 51, end_range: 100, offset_threshold: 3 },
    { start_range: 101, end_range: 120, offset_threshold: 2 },
    { start_range: 121, end_range: 149, offset_threshold: 1 },
  ],
  dmlRows_ranges: [
    { start_range: 0, end_range: 2000, offset_threshold: 2000 },
    { start_range: 2001, end_range: 5000, offset_threshold: 1000 },
    { start_range: 5001, end_range: 8000, offset_threshold: 500 },
    { start_range: 8001, end_range: 9000, offset_threshold: 200 },
    { start_range: 9001, end_range: 9999, offset_threshold: 1 },
  ],
  heap_ranges: [
    { start_range: 0, end_range: 2000000, offset_threshold: 2000000 },
    { start_range: 2000001, end_range: 3000000, offset_threshold: 1000000 },
    { start_range: 3000001, end_range: 5000000, offset_threshold: 500000 },
    { start_range: 5000001, end_range: 6000000, offset_threshold: 100000 },
  ],
  queryRows_ranges: [
    { start_range: 0, end_range: 20000, offset_threshold: 5000 },
    { start_range: 20001, end_range: 30000, offset_threshold: 4000 },
    { start_range: 30001, end_range: 40000, offset_threshold: 2000 },
    { start_range: 40001, end_range: 48000, offset_threshold: 1000 },
    { start_range: 48001, end_range: 49999, offset_threshold: 1 },
  ],
  soql_ranges: [
    { start_range: 0, end_range: 50, offset_threshold: 10 },
    { start_range: 51, end_range: 80, offset_threshold: 5 },
    { start_range: 81, end_range: 90, offset_threshold: 2 },
    { start_range: 91, end_range: 99, offset_threshold: 1 },
  ],
};

/**
 * Load the range collection from either a custom json file or default.
 */
export async function getRangeCollection(
  filePath?: string
): Promise<RangeCollection> {
  if (filePath) {
    const rangeData = await fs.readFile(path.resolve(filePath), {
      encoding: 'utf8',
    });
    return parseType(rangeData, rangeSchema);
  }

  return defaultRanges;
}

/**
 * Apply offset that matches value range, to get total threshold.
 */
export function getTotalThreshold(
  value: number,
  ranges: OffsetThresholdRange[]
): number {
  return (
    value +
    (ranges.filter(
      ({ start_range, end_range }) => value >= start_range && value <= end_range
    )[0]?.offset_threshold || 0)
  );
}
