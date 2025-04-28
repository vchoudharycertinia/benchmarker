/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { LegacyDataMapper } from '../mapper/legacy';
import { DataSource } from 'typeorm';
import { TestResult } from '../entity/result';
import { OrgInfo } from '../entity/org';
import { PackageInfo } from '../entity/package';
import { ExecutionInfo } from '../entity/execution';
import { Alert } from '../entity/alert';
import { PostgresDataSource, PostgresOptions } from './postgres';

export class LegacyDataSource extends PostgresDataSource {
  async connect(options: PostgresOptions = {}): Promise<void> {
    if (this.mapper) return;

    this.options = options;

    const credentials = this.resolveCredentials();
    if (!credentials) return;

    const ds = await new DataSource({
      type: 'postgres',
      entities: [TestResult, OrgInfo, PackageInfo, ExecutionInfo, Alert],
      schema: 'performance',
      synchronize: false,
      logging: false,
      ssl: credentials.host.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
      ...credentials,
    }).initialize();

    this.mapper = new LegacyDataMapper(ds);
  }
}
