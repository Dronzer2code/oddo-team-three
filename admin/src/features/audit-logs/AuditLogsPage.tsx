import { useState } from 'react';
import { AUDIT_ACTION_LABEL, formatDateTime, type AuditLogEntry } from '@carpool/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SkeletonTable,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

const ENTITY_TONE: Record<string, 'neutral' | 'accent' | 'warning' | 'success'> = {
  employee: 'accent',
  vehicle: 'warning',
  organization: 'neutral',
  cost_configuration: 'success',
  invitation: 'neutral',
  admin: 'neutral',
};

function ValueTable({ title, values }: { title: string; values: Record<string, unknown> | null }) {
  if (!values || Object.keys(values).length === 0) {
    return (
      <div>
        <div className="t-label">{title}</div>
        <p className="t-caption">—</p>
      </div>
    );
  }
  return (
    <div>
      <div className="t-label">{title}</div>
      <table className="table" style={{ marginTop: 'var(--space-2)' }}>
        <tbody>
          {Object.entries(values).map(([key, value]) => (
            <tr key={key}>
              <td className="t-caption">{key}</td>
              <td className="t-medium">{value === null ? '—' : String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const actions = useApi(() => api.admin.auditLogs.actions(), []);
  const logs = useApi(
    () =>
      api.admin.auditLogs.list({
        action: action || undefined,
        entityType: entityType || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 15,
      }),
    [action, entityType, from, to, page],
  );

  const items = logs.data?.items ?? [];
  const pagination = logs.data?.pagination;

  return (
    <>
      <PageHeader
        title="Audit logs"
        lead="Every access change, vehicle decision and configuration edit, with the actor and the before and after values."
      />

      <Card>
        <div className="filter-bar">
          <Select
            label="Action"
            placeholder="All actions"
            options={(actions.data ?? []).map((value) => ({
              value,
              label: AUDIT_ACTION_LABEL[value] ?? value,
            }))}
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Entity"
            placeholder="All entities"
            options={[
              { value: 'employee', label: 'Employee' },
              { value: 'vehicle', label: 'Vehicle' },
              { value: 'organization', label: 'Organization' },
              { value: 'cost_configuration', label: 'Cost configuration' },
              { value: 'invitation', label: 'Invitation' },
            ]}
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
          />
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
          {action || entityType || from || to ? (
            <Button
              variant="ghost"
              onClick={() => {
                setAction('');
                setEntityType('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {logs.error ? (
          <ErrorState {...resolveErrorCopy(logs.error)} onRetry={logs.reload} />
        ) : logs.initialLoading ? (
          <SkeletonTable rows={10} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="history"
            title="No audit records match these filters"
            text="Administrative changes appear here as soon as they happen."
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Change</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => {
                    const changedKeys = Object.keys(entry.newValues ?? {});
                    return (
                      <tr key={entry.id} onClick={() => setSelected(entry)}>
                        <td className="t-caption t-nowrap">{formatDateTime(entry.createdAt)}</td>
                        <td className="t-medium">{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</td>
                        <td>
                          <Badge tone={ENTITY_TONE[entry.entityType] ?? 'neutral'}>
                            {entry.entityType.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="t-caption">{entry.actorName}</td>
                        <td className="t-caption">
                          {changedKeys.length === 0
                            ? '—'
                            : changedKeys
                                .slice(0, 2)
                                .map(
                                  (key) =>
                                    `${key}: ${String((entry.previousValues ?? {})[key] ?? '—')} → ${String(
                                      (entry.newValues ?? {})[key],
                                    )}`,
                                )
                                .join(', ') +
                              (changedKeys.length > 2 ? ` +${changedKeys.length - 2} more` : '')}
                        </td>
                        <td>
                          <div className="table__actions">
                            <Icon name="chevronRight" size={14} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPage={setPage}
                label="records"
              />
            ) : null}
          </>
        )}
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        wide
        title={selected ? (AUDIT_ACTION_LABEL[selected.action] ?? selected.action) : ''}
        lead={selected ? `${selected.actorName} · ${formatDateTime(selected.createdAt)}` : ''}
      >
        {selected ? (
          <div className="stack-lg">
            <div className="detail-list">
              <div className="detail-list__item">
                <div className="detail-list__label">Entity type</div>
                <div className="detail-list__value">{selected.entityType.replace('_', ' ')}</div>
              </div>
              <div className="detail-list__item">
                <div className="detail-list__label">Entity ID</div>
                <div className="detail-list__value t-caption">{selected.entityId ?? '—'}</div>
              </div>
              <div className="detail-list__item">
                <div className="detail-list__label">Organization</div>
                <div className="detail-list__value t-caption">{selected.organizationId}</div>
              </div>
            </div>
            <div className="grid grid-2">
              <ValueTable title="Previous values" values={selected.previousValues} />
              <ValueTable title="New values" values={selected.newValues} />
            </div>
            {selected.metadata ? <ValueTable title="Metadata" values={selected.metadata} /> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
