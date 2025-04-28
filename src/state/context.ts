/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import * as dotenv from 'dotenv';
import { BenchmarkOrg, OrgOptions } from '../salesforce/org';
import {
  PostgresDataSource,
  PostgresOptions,
} from '../database/connection/postgres';
import { LegacyDataSource } from '../database/connection/legacy';
import { ReadMapper, WriteMapper } from '../database/mapper/interop';

export interface GlobalOptions {
  // id/name for current run e.g. build number
  externalId?: string;

  // id/name for project / product - mark created records
  projectId?: string;

  // path to custom env - default: cwd/.env
  envFile?: string;
}

export interface RunContextOptions {
  global?: GlobalOptions;
  org?: OrgOptions;
  pg?: PostgresOptions;
}

export class RunContext {
  projectId: string;
  org: BenchmarkOrg;
  pg: PostgresDataSource;
  pgLegacy?: LegacyDataSource;
  externalId?: string;

  constructor() {
    this.org = new BenchmarkOrg();
    this.pg = new LegacyDataSource(); // TODO switch to PostgresDataSource / new schema
    this.projectId = '';
  }

  static get current(): RunContext {
    return context;
  }

  static reset(): RunContext {
    context = new RunContext();
    return context;
  }

  get pgQuery(): ReadMapper | undefined {
    return this.pgLegacy?.mapper || this.pg.mapper;
  }

  async setup(options: RunContextOptions = {}): Promise<RunContext> {
    this.loadEnv(options.global);

    await this.org.connect(options.org);
    await this.pg.connect({ enable: false }); // TODO new schema

    return this;
  }

  async setupPgLegacy(options?: PostgresOptions): Promise<void> {
    this.pgLegacy = new LegacyDataSource();
    await this.pgLegacy.connect(options);
  }

  async forAllDataSources(
    op: (ds: WriteMapper) => Promise<void>
  ): Promise<void> {
    for (const mapper of [this.pg.mapper, this.pgLegacy?.mapper]) {
      if (mapper) await op(mapper);
    }
  }

  async save(): Promise<void> {
    const org = await this.org.getContext();
    await this.forAllDataSources(async m => {
      // TODO
    });
  }

  protected loadEnv(global: GlobalOptions = {}) {
    if (this.projectId.length != 0) return;

    dotenv.config({ path: global.envFile || '.env' });

    const id = global.projectId || process.env.PROJECT_ID;
    if (id == null || id.length == 0) {
      throw new Error('global.projectId or $PROJECT_ID env is required');
    }

    this.projectId = id;
    this.externalId = global.externalId || process.env.EXTERNAL_BUILD_ID;
  }
}

let context: RunContext = new RunContext();
