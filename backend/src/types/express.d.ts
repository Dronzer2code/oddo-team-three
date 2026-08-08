import type { Database } from '../database/client.js';
import type { AccountStatus, UserRole } from '@carpool/shared';

export interface RequestActor {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationCurrency: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
}

declare global {
  namespace Express {
    interface Request {
      db: Database;
      /** Present only after `authenticate` has run. */
      actor?: RequestActor;
    }
  }
}
