/** @ignore */
/**
 * Copyright (c) 2025 Certinia, Inc. All rights reserved.
 */
import { Alert } from './entity/alert';
import { getConnection } from './connection';

export async function saveAlerts(alerts: Alert[]) {
  const connection = await getConnection();
  return connection.manager.save(alerts);
}
