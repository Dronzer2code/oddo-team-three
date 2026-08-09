import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AUDIT_ACTION_LABEL,
  VEHICLE_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatDistance,
  formatNumber,
  formatRelative,
} from '@carpool/shared';
import {
  AccountStatusBadge,
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailList,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  Input,
  PageHeader,
  ParticipationBadge,
  Plate,
  Skeleton,
  Stat,
  VehicleStatusBadge,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { EmployeeStatusDialog } from './EmployeeStatusDialog';

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const employee = useApi(() => api.admin.employees.get(id), [id]);
  const audit = useApi(() => api.admin.employees.auditLogs(id), [id]);

  const [editing, setEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', department: '', employeeCode: '' });

  const update = useMutation((body: Record<string, unknown>) => api.admin.employees.update(id, body));

  if (employee.error) {
    return (
      <>
        <PageHeader title="Employee" />
        <Card>
          <ErrorState {...resolveErrorCopy(employee.error)} onRetry={employee.reload} />
        </Card>
      </>
    );
  }

  if (employee.initialLoading || !employee.data) {
    return (
      <>
        <PageHeader title="Employee" />
        <Card>
          <CardBody className="stack">
            <Skeleton variant="title" width="40%" />
            <Skeleton width="60%" />
            <Skeleton variant="block" height={120} />
          </CardBody>
        </Card>
      </>
    );
  }

  const data = employee.data;

  function startEditing() {
    setForm({
      name: data.name,
      phone: data.phone ?? '',
      department: data.department ?? '',
      employeeCode: data.employeeCode ?? '',
    });
    setEditing(true);
  }

  async function save() {
    const body: Record<string, unknown> = {};
    if (form.name !== data.name) body.name = form.name;
    if (form.phone !== (data.phone ?? '')) body.phone = form.phone;
    if (form.department !== (data.department ?? '')) body.department = form.department;
    if (form.employeeCode !== (data.employeeCode ?? '')) body.employeeCode = form.employeeCode;

    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }
    const result = await update.run(body);
    if (result) {
      toast.success('Employee updated');
      setEditing(false);
      employee.reload();
      audit.reload();
    }
  }

  return (
    <>
      <PageHeader
        title={data.name}
        lead={`${data.employeeCode ?? 'No employee ID'} · ${data.email}`}
        breadcrumbs={[{ label: 'Employees', href: '/admin/employees' }, { label: data.name }]}
        renderLink={(crumb) => <Link to={crumb.href!}>{crumb.label}</Link>}
        actions={
          <>
            <Button variant="secondary" icon="edit" onClick={startEditing} disabled={editing}>
              Edit details
            </Button>
            <Button variant="primary" onClick={() => setStatusOpen(true)}>
              Change access
            </Button>
          </>
        }
      />

      <div className="grid grid-4">
        <Stat
          label="Account status"
          value={<AccountStatusBadge status={data.status} />}
          small
          icon="shield"
        />
        <Stat label="Rides published" value={formatNumber(data.ridesPublished)} small icon="list" />
        <Stat label="Trips completed" value={formatNumber(data.tripsCompleted)} small icon="route" accent />
        <Stat label="Distance travelled" value={formatDistance(data.totalDistanceKm)} small icon="trend" />
      </div>

      <div className="grid grid-split-tight" style={{ marginTop: 'var(--space-6)' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Employee details" />
            <CardBody>
              {editing ? (
                <div className="stack">
                  {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
                  <div className="form-row">
                    <Input
                      label="Full name"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      error={update.error?.fieldErrors.name}
                    />
                    <Input
                      label="Employee ID"
                      value={form.employeeCode}
                      onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
                      error={update.error?.fieldErrors.employeeCode}
                    />
                  </div>
                  <div className="form-row">
                    <Input
                      label="Phone"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value })}
                      error={update.error?.fieldErrors.phone}
                    />
                    <Input
                      label="Department"
                      value={form.department}
                      onChange={(event) => setForm({ ...form, department: event.target.value })}
                      error={update.error?.fieldErrors.department}
                    />
                  </div>
                  <p className="t-caption">
                    Email address, role and organization are not editable from the admin panel.
                  </p>
                  <div className="row">
                    <Button variant="primary" onClick={save} loading={update.busy}>
                      Save changes
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(false)} disabled={update.busy}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <DetailList
                  items={[
                    { label: 'Employee ID', value: data.employeeCode ?? '—' },
                    { label: 'Department', value: data.department ?? '—' },
                    { label: 'Email', value: data.email },
                    { label: 'Phone', value: data.phone ?? '—' },
                    { label: 'Organization', value: data.organizationName },
                    {
                      label: 'Participation',
                      value: <ParticipationBadge active={data.isActiveParticipant} />,
                    },
                    { label: 'Account created', value: formatDate(data.createdAt) },
                    {
                      label: 'Last activity',
                      value: data.lastActivityAt ? formatRelative(data.lastActivityAt) : 'Never',
                    },
                  ]}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Registered vehicles"
              lead={`${data.vehicles.length} vehicle${data.vehicles.length === 1 ? '' : 's'}`}
            />
            <CardBody flush>
              {data.vehicles.length === 0 ? (
                <EmptyState
                  icon="car"
                  title="No vehicles registered"
                  text="This employee can ride as a passenger but cannot publish rides yet."
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Registration</th>
                        <th className="is-numeric">Seats</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.vehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td>
                            <div className="t-medium">
                              {vehicle.make} {vehicle.model}
                            </div>
                            <div className="t-caption">{VEHICLE_TYPE_LABEL[vehicle.vehicleType]}</div>
                          </td>
                          <td>
                            <Plate>{vehicle.registrationNumber}</Plate>
                          </td>
                          <td className="is-numeric">{vehicle.seatingCapacity}</td>
                          <td>
                            <VehicleStatusBadge status={vehicle.status} />
                          </td>
                          <td>
                            <div className="table__actions">
                              <Link className="btn btn-ghost btn-sm" to={`/admin/vehicles/${vehicle.id}`}>
                                Open
                                <Icon name="arrowRight" size={13} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Audit history" lead="Administrative changes to this employee" />
          <CardBody flush>
            {audit.error ? (
              <ErrorState {...resolveErrorCopy(audit.error)} onRetry={audit.reload} />
            ) : audit.initialLoading ? (
              <div className="card-body stack">
                <Skeleton width="70%" />
                <Skeleton width="55%" />
              </div>
            ) : (audit.data ?? []).length === 0 ? (
              <EmptyState
                icon="history"
                title="No changes recorded"
                text="Access and detail changes appear here."
              />
            ) : (
              <div className="stack" style={{ padding: 'var(--space-4)' }}>
                {(audit.data ?? []).map((entry) => (
                  <div
                    key={entry.id}
                    style={{ borderLeft: '2px solid var(--color-border)', paddingLeft: 'var(--space-4)' }}
                  >
                    <div className="t-medium">{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</div>
                    <div className="t-caption">
                      {entry.actorName} · {formatDateTime(entry.createdAt)}
                    </div>
                    {entry.previousValues || entry.newValues ? (
                      <div className="t-caption t-muted" style={{ marginTop: 4 }}>
                        {Object.keys(entry.newValues ?? {}).map((key) => (
                          <div key={key}>
                            {key}: {String((entry.previousValues ?? {})[key] ?? '—')} →{' '}
                            <span className="t-medium">{String((entry.newValues ?? {})[key])}</span>
                          </div>
                        ))}
                        {entry.metadata && (entry.metadata as { reason?: string }).reason ? (
                          <div>Reason: {(entry.metadata as { reason?: string }).reason}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <EmployeeStatusDialog
        target={statusOpen ? { id: data.id, name: data.name, status: data.status } : null}
        onClose={() => setStatusOpen(false)}
        onDone={() => {
          setStatusOpen(false);
          employee.reload();
          audit.reload();
        }}
      />
    </>
  );
}
