import { useState } from 'react';
import { formatDistance, formatNumber, toLocalDateInput } from '@carpool/shared';
import {
  BarChart,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Meter,
  PageHeader,
  Skeleton,
  SkeletonStats,
  Stat,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalDateInput(date);
}

export function ParticipationPage() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(toLocalDateInput());

  const participation = useApi(() => api.admin.participation({ from, to }), [from, to]);
  const data = participation.data;

  return (
    <>
      <PageHeader
        title="Participation"
        lead="An active participant published, requested or completed a ride inside the selected period."
        actions={
          <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <Button variant="secondary" icon="refresh" onClick={participation.reload}>
              Apply
            </Button>
          </div>
        }
      />

      {participation.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(participation.error)} onRetry={participation.reload} />
        </Card>
      ) : participation.initialLoading || !data ? (
        <SkeletonStats count={4} />
      ) : (
        <>
          <div className="grid grid-4">
            <Stat
              label="Participation rate"
              value={`${formatNumber(data.participationRate, 1)}%`}
              icon="trend"
              accent
              foot={
                <span>
                  {formatNumber(data.activeParticipants)} of {formatNumber(data.totalEmployees)} employees
                </span>
              }
            />
            <Stat label="Published a ride" value={formatNumber(data.publishers)} icon="car" foot={<span>as driver</span>} />
            <Stat
              label="Requested a seat"
              value={formatNumber(data.requesters)}
              icon="seat"
              foot={<span>as passenger</span>}
            />
            <Stat
              label="Completed a trip"
              value={formatNumber(data.completers)}
              icon="route"
              foot={<span>travelled together</span>}
            />
          </div>

          <div className="grid grid-2" style={{ marginTop: 'var(--space-6)' }}>
            <Card>
              <CardHeader title="Weekly activity" lead="Distinct participants per week, last eight weeks" />
              <CardBody>
                {data.weekly.every((point) => point.participants === 0) ? (
                  <EmptyState icon="chart" title="No weekly activity yet" />
                ) : (
                  <BarChart points={data.weekly.map((point) => ({ label: point.label, value: point.participants }))} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Monthly trend" lead="Completed trips per month, last six months" />
              <CardBody>
                {data.monthly.every((point) => point.trips === 0) ? (
                  <EmptyState icon="chart" title="No monthly activity yet" />
                ) : (
                  <BarChart points={data.monthly.map((point) => ({ label: point.label, value: point.trips }))} />
                )}
              </CardBody>
            </Card>
          </div>

          <Card style={{ marginTop: 'var(--space-6)' }}>
            <CardHeader title="Most active employees" lead="Within the selected period" />
            <CardBody flush>
              {data.topParticipants.length === 0 ? (
                <EmptyState icon="users" title="Nobody carpooled in this period" />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th className="is-numeric">Published</th>
                        <th className="is-numeric">Requested</th>
                        <th className="is-numeric">Trips</th>
                        <th className="is-numeric">Distance</th>
                        <th style={{ width: 140 }}>Share of trips</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topParticipants.map((participant) => {
                        const max = Math.max(1, ...data.topParticipants.map((p) => p.tripsCompleted));
                        return (
                          <tr key={participant.id}>
                            <td className="t-medium">{participant.name}</td>
                            <td className="t-caption">{participant.department ?? '—'}</td>
                            <td className="is-numeric">{formatNumber(participant.ridesPublished)}</td>
                            <td className="is-numeric">{formatNumber(participant.ridesRequested)}</td>
                            <td className="is-numeric">{formatNumber(participant.tripsCompleted)}</td>
                            <td className="is-numeric">{formatDistance(participant.distanceKm)}</td>
                            <td>
                              <Meter value={participant.tripsCompleted} max={max} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {participation.loading && !participation.initialLoading ? (
        <Skeleton width="30%" style={{ marginTop: 'var(--space-4)' }} />
      ) : null}
    </>
  );
}
