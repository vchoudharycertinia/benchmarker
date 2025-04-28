/*
 * Copyright (c) 2019 Certinia Inc. All rights reserved.
 */

import {
  TransactionTestTemplate,
  TestFlowOutput,
  GovernorMetricsResult,
} from './transactionTestTemplate';
import { TestResult } from '../database/entity/result';
import Table from 'cli-table';
import { getDatabaseUrl } from '../shared/env';
import { getOrgContext } from '../services/org';
import { save } from '../services/result/save';
import { generateValidAlerts } from '../metrics/limits';

/**
 * Retrieve peformance metrics from a tests execution and save them
 * @param processTestTemplate object with the information required to execute a test
 * @param results results of the test steps executions
 */
export const saveResults = async (
  processTestTemplate: TransactionTestTemplate,
  results: TestFlowOutput[]
) => {
  if (results.length > 0) {
    console.log(createTable(results));
  }

  // TODO ignore TestFlowOutput
  // call apexService.save on cached results

  const tests: TestResult[] = results.map(f =>
    toTestResult(processTestTemplate, f)
  );

  // TODO id alerts w name/action
  if (getDatabaseUrl()) {
    try {
      const orgContext = await getOrgContext(processTestTemplate.connection);
      const validAlerts = await generateValidAlerts(tests);
      await save(tests, orgContext, validAlerts);
    } catch (err) {
      console.error(
        'Failed to save results to database. Check DATABASE_URL environment variable, unset to skip saving.'
      );
      throw err;
    }
  }
};

// TODO move to db module data mapper (perf schema)
// except alert info / TestResultOutput
function toTestResult(
  processTestTemplate: TransactionTestTemplate,
  flowOutput: TestFlowOutput
): TestResult {
  const r: TestResult = new TestResult();
  r.flowName = flowOutput.testStepDescription.flowName;
  r.action = flowOutput.testStepDescription.action;
  r.product = processTestTemplate.product;
  r.testType = processTestTemplate.testType;

  const limits: GovernorMetricsResult = flowOutput.result;
  r.duration = limits.timer;
  r.cpuTime = limits.cpuTime;
  r.dmlRows = limits.dmlRows;
  r.dmlStatements = limits.dmlStatements;
  r.heapSize = limits.heapSize;
  r.queryRows = limits.queryRows;
  r.soqlQueries = limits.soqlQueries;
  r.queueableJobs = limits.queueableJobs;
  r.futureCalls = limits.futureCalls;

  return r;
}

function createTable(data: TestFlowOutput[]): string {
  return new Table({
    head: [
      'Flow Name',
      'Action',
      'Duration (ms)',
      'CPU time (ms)',
      'DML rows',
      'DML statements',
      'Heap size (bytes)',
      'Query rows',
      'SOQL queries',
      'Queueables',
      'Futures',
    ],
    rows: data.map(({ testStepDescription, result }) => [
      testStepDescription.flowName,
      testStepDescription.action,
      String(result.timer),
      String(result.cpuTime),
      String(result.dmlRows),
      String(result.dmlStatements),
      String(result.heapSize),
      String(result.queryRows),
      String(result.soqlQueries),
      String(result.queueableJobs),
      String(result.futureCalls),
    ]),
  }).toString();
}
