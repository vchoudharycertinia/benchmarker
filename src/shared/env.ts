/** @ignore */
/**
 * Copyright (c) 2018-2019 FinancialForce.com, inc. All rights reserved.
 */
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || '';
}

export function getExternalBuildId() {
  return process.env.EXTERNAL_BUILD_ID || '';
}
