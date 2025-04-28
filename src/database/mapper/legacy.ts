/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { Brackets, DataSource, Repository } from 'typeorm';
import { TestResult } from '../entity/result';
import { LimitsAvg } from '../../metrics/limits';
import { WriteMapper } from './interop';

export class LegacyDataMapper implements WriteMapper {
  protected testResults: Repository<TestResult>;

  constructor(dataSource: DataSource) {
    this.testResults = dataSource.getRepository(TestResult);
  }

  async selectLimitsTenDayAverage(
    projectId: string,
    names: string[],
    actionNames: string[]
  ): Promise<LimitsAvg[]> {
    return this.testResults
      .createQueryBuilder('res')
      .select('res.flow_name', 'name')
      .addSelect('res.action', 'action')
      .addSelect('COALESCE(ROUND(AVG(res.cpu_time), 0), 0)', 'cpuTimeAvg')
      .addSelect('COALESCE(ROUND(AVG(res.dml_rows), 0), 0)', 'dmlRowsAvg')
      .addSelect(
        'COALESCE(ROUND(AVG(res.dml_statements), 0), 0)',
        'dmlStatementsAvg'
      )
      .addSelect('COALESCE(ROUND(AVG(res.heap_size), 0), 0)', 'heapSizeAvg')
      .addSelect('COALESCE(ROUND(AVG(res.query_rows), 0), 0)', 'queryRowsAvg')
      .addSelect(
        'COALESCE(ROUND(AVG(res.soql_queries), 0), 0)',
        'soqlQueriesAvg'
      )
      .where('res.product = :projectId', { projectId })
      .andWhere('name IN (:...names)', { names })
      .andWhere('action IN (:...actionNames)', {
        actionNames,
      })
      .andWhere(
        new Brackets(qb => qb.where('error IS NULL').orWhere("error = ''"))
      )
      .andWhere(
        "res.create_date_time >= CURRENT_TIMESTAMP - INTERVAL '10 DAYS'"
      )
      .groupBy('name')
      .addGroupBy('action')
      .having('COUNT(*) >= 5')
      .getRawMany();
  }
}
