import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ACCOUNT_STATUS,
  formatDate,
  formatNumber,
  formatRelative,
  type AccountStatus,
} from '@carpool/shared';
import {
  AccountStatusBadge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  Pagination,
  ParticipationBadge,
  PageHeader,
  SearchInput,
  Select,
  SkeletonTable,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { EmployeeStatusDialog } from './EmployeeStatusDialog';

const STATUS_OPTIONS = [
  { value: ACCOUNT_STATUS.ACTIVE, label: 'Active' },
  { value: ACCOUNT_STATUS.PENDING, label: 'Pending' },
  { value: ACCOUNT_STATUS.SUSPENDED, label: 'Suspended' },
  { value: ACCOUNT_STATUS.DEACTIVATED, label: 'Deactivated' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Date added' },
  { value: 'lastActivityAt', label: 'Last activity' },
];

export function EmployeesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [participation, setParticipation] = useState('');
  const [department, setDepartment] = useState('');
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{ id: string; name: string; status: AccountStatus } | null>(null);

  const debouncedSearch = useDebounced(search);

  const departments = useApi(() => api.admin.employees.departments(), []);
  const employees = useApi(
    () =>
      api.admin.employees.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        participation: participation || undefined,
        department: department || undefined,
        sort,
        direction,
        page,
        pageSize: 10,
      }),
    [debouncedSearch, status, participation, department, sort, direction, page],
  );

  const items = employees.data?.items ?? [];
  const pagination = employees.data?.pagination;

  const toggleSort = (column: string) => {
    if (sort === column) {
      setDirection(direction === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setDirection('asc');
    }
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Employees"
        lead="Everyone in your organization, their carpool participation and their access."
        actions={
          <Link className="btn btn-primary" to="/invitations">
            <Icon name="plus" size={16} />
            Invite employees
          </Link>
        }
      />

      <Card>
        <div className="filter-bar">
          <div className="filter-bar__search">
            <SearchInput
              placeholder="Search by name, email or employee ID"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            label="Account status"
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Participation"
            options={[
              { value: 'active', label: 'Participating' },
              { value: 'inactive', label: 'Not participating' },
            ]}
            placeholder="Everyone"
            value={participation}
            onChange={(event) => {
              setParticipation(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Department"
            options={(departments.data ?? []).map((value) => ({ value, label: value }))}
            placeholder="All departments"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Sort by"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {employees.error ? (
          <ErrorState {...resolveErrorCopy(employees.error)} onRetry={employees.reload} />
        ) : employees.initialLoading ? (
          <SkeletonTable rows={8} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="users"
            title="No employees match these filters"
            text="Try clearing the search or filters, or invite someone new to the organization."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setParticipation('');
                  setDepartment('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th className="is-sortable" onClick={() => toggleSort('name')}>
                      Employee
                      {sort === 'name' ? (
                        <span className="table__sort">
                          <Icon name={direction === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} />
                        </span>
                      ) : null}
                    </th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Participation</th>
                    <th className="is-numeric">Rides / Trips</th>
                    <th className="is-sortable" onClick={() => toggleSort('lastActivityAt')}>
                      Last activity
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((employee) => (
                    <tr key={employee.id} onClick={() => navigate(`/employees/${employee.id}`)}>
                      <td>
                        <Identity
                          name={employee.name}
                          meta={`${employee.employeeCode ?? '—'} · ${employee.email}`}
                        />
                      </td>
                      <td className="t-caption">{employee.department ?? '—'}</td>
                      <td>
                        <AccountStatusBadge status={employee.status} />
                      </td>
                      <td>
                        <ParticipationBadge active={employee.isActiveParticipant} />
                      </td>
                      <td className="is-numeric">
                        {formatNumber(employee.ridesPublished)} / {formatNumber(employee.tripsCompleted)}
                      </td>
                      <td className="t-caption t-nowrap">
                        {employee.lastActivityAt ? formatRelative(employee.lastActivityAt) : 'Never'}
                        <div className="t-muted" style={{ fontSize: 11 }}>
                          Added {formatDate(employee.createdAt)}
                        </div>
                      </td>
                      <td>
                        <div className="table__actions">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setTarget({ id: employee.id, name: employee.name, status: employee.status });
                            }}
                          >
                            Access
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                label="employees"
              />
            ) : null}
          </>
        )}
      </Card>

      {items.length > 0 ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardBody tight>
            <p className="t-caption">
              Employees are never deleted — rides, trips and payments reference them. Use{' '}
              <span className="t-medium">Deactivate</span> to remove access permanently while keeping history
              intact.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <EmployeeStatusDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setTarget(null);
          employees.reload();
        }}
      />
    </>
  );
}
