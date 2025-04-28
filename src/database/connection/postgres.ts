/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import pgstr from 'pg-connection-string';
import { WriteMapper } from '../mapper/interop';

export interface PostgresOptions {
  enable?: boolean;
  url?: string;
}

export interface DataSourceCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

// TODO temporarily abstract until new schema
export abstract class PostgresDataSource {
  mapper?: WriteMapper;
  protected options: PostgresOptions = {};

  abstract connect(options?: PostgresOptions): Promise<void>;

  protected resolveCredentials(): DataSourceCredentials | null {
    const url = this.options.url || process.env.DATABASE_URL;

    if (this.options.enable === false || url == null) {
      return null;
    }

    const { host, port, user, password, database } = pgstr.parse(url);

    if (!user || !password || !database) {
      return null;
    }

    return {
      host: host || 'localhost',
      port: port ? parseInt(port) : 5432,
      database,
      username: user,
      password,
    };
  }
}
