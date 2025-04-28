/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { LimitsAvg } from '../../metrics/limits';

// interfaces for common operations between mappers
// used when working with multiple mappers

export interface ReadMapper {
  selectLimitsTenDayAverage(
    projectId: string,
    names: string[],
    actionNames: string[]
  ): Promise<LimitsAvg[]>;
}

export interface WriteMapper extends ReadMapper {}
