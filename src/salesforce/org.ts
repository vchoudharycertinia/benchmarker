/*
 * Copyright (c) 2025 Certinia Inc. All rights reserved.
 */

import { Connection } from '@salesforce/core';
import {
  BenchmarkOrgConnection,
  connectToSalesforceOrg,
  OrgAuthInfo,
} from './org/connection';
import { getOrgContext, OrgContext } from './org/context';

export interface OrgOptions {
  // use existing connection to create internal one
  connection?: Connection;
  username?: string;
  password?: string;
  token?: string;
  loginUrl?: string;
  version?: string;
  /**
   * List of namespaces to be removed from any Apex code.
   * Removes the need to make benchmark scripts for managed and unmanaged scenarios.
   * List of generated RegExp is available from the current org instance.
   */
  unmanagedNamespaces?: string[];
}

export class BenchmarkOrg {
  protected options: OrgOptions = {};
  protected orgConnection?: BenchmarkOrgConnection;
  protected context?: OrgContext;
  protected namespaceRegExp?: RegExp[];

  get connection(): BenchmarkOrgConnection {
    if (!this.orgConnection) {
      throw new Error('Org connection not yet established.');
    }
    return this.orgConnection;
  }

  /**
   * Sets connection from options or environment
   */
  async connect(options: OrgOptions = {}): Promise<void> {
    if (this.orgConnection) return;

    this.options = options;
    const auth = this.loadAuth();

    if (options.connection) {
      (await BenchmarkOrgConnection.create({
        authInfo: options.connection.getAuthInfo(),
      })) as BenchmarkOrgConnection;
    }

    if (auth) {
      this.orgConnection = await connectToSalesforceOrg(auth);
    }
  }

  async getContext(): Promise<OrgContext> {
    if (!this.context) {
      this.context = await getOrgContext(this.connection);
    }
    return this.context;
  }

  getUnmanagedNamespaceRegExp(): RegExp[] {
    if (!this.namespaceRegExp) {
      const umns =
        this.options.unmanagedNamespaces ||
        process.env.UNMANAGE_PACKAGE?.split(',');

      this.namespaceRegExp =
        umns?.map(e => new RegExp(e + '(__|.)', 'g')) || [];
    }

    return this.namespaceRegExp;
  }

  protected loadAuth(): OrgAuthInfo | undefined {
    const { username, password, token, loginUrl, version } = this.options;

    const user =
      username || process.env.SFDX_USERNAME || process.env.SF_USERNAME;

    if (user) {
      return {
        username: user,
        password:
          (password || process.env.SF_PASSWORD || '') +
          (token || process.env.SF_TOKEN || ''),
        loginUrl: loginUrl || process.env.SF_LOGIN,
        version,
      };
    }
    return undefined;
  }
}
