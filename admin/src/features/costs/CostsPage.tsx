import { useState } from 'react';
import { COST_CONFIG_TYPE, formatDate, formatMoney, formatNumber, toLocalDateInput } from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonTable,
  Stat,
  Textarea,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

const TYPE_LABEL: Record<string, string> = {
  fuel_price: 'Fuel price',
  travel_cost: 'Running cost',
};

const EMPTY = {
  type: COST_CONFIG_TYPE.FUEL_PRICE as string,
  value: '',
  unit: 'per litre',
  currency: 'INR',
  mileageKmpl: '',
  effectiveFrom: toLocalDateInput(),
  effectiveUntil: '',
  note: '',
};

export function CostsPage() {
  const toast = useToast();
  const costs = useApi(() => api.admin.costs.list(), []);
  const create = useMutation((body: Record<string, unknown>) => api.admin.costs.create(body));
  const close = useMutation((id: string) => api.admin.costs.close(id));

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [closeTarget, setCloseTarget] = useState<string | null>(null);

  const configurations = costs.data?.configurations ?? [];
  const current = costs.data?.current;

  async function submit() {
    const result = await create.run({
      type: form.type,
      value: Number(form.value),
      unit: form.unit,
      currency: form.currency,
      mileageKmpl: form.mileageKmpl ? Number(form.mileageKmpl) : undefined,
      effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : undefined,
      note: form.note.trim() || undefined,
    });
    if (result) {
      toast.success('New cost version published');
      setOpen(false);
      setForm(EMPTY);
      costs.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Cost configuration"
        lead="Versioned with effective dates. Publishing a new version never rewrites a completed trip."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setForm({ ...EMPTY, effectiveFrom: toLocalDateInput() });
              setOpen(true);
            }}
          >
            New version
          </Button>
        }
      />

      {current ? (
        <div className="grid grid-4">
          <Stat
            label="Fuel price"
            value={formatMoney(current.fuelCostPerLitre, current.currency, 2)}
            icon="fuel"
            accent
            small
            foot={<span>per litre</span>}
          />
          <Stat
            label="Running cost"
            value={formatMoney(current.travelCostPerKm, current.currency, 2)}
            icon="car"
            small
            foot={<span>per kilometre</span>}
          />
          <Stat
            label="Fuel efficiency"
            value={`${formatNumber(current.mileageKmpl, 1)} km/l`}
            icon="trend"
            small
            foot={<span>Applied to new trips</span>}
          />
          <Stat
            label="Cost of a 12 km trip"
            value={formatMoney(
              (12 / current.mileageKmpl) * current.fuelCostPerLitre + 12 * current.travelCostPerKm,
              current.currency,
            )}
            icon="wallet"
            small
            foot={<span>Fuel plus running cost</span>}
          />
        </div>
      ) : null}

      <Card style={{ marginTop: 'var(--space-6)' }}>
        <CardHeader
          title="Version history"
          lead="Closed versions stay here so historical reports remain reproducible"
        />
        <CardBody flush>
          {costs.error ? (
            <ErrorState {...resolveErrorCopy(costs.error)} onRetry={costs.reload} />
          ) : costs.initialLoading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : configurations.length === 0 ? (
            <EmptyState
              icon="fuel"
              title="No cost versions yet"
              text="Publish a fuel price and a running cost so ride estimates and trip costs can be calculated."
              action={
                <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
                  New version
                </Button>
              }
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th className="is-numeric">Value</th>
                    <th className="is-numeric">Fuel efficiency</th>
                    <th>Effective from</th>
                    <th>Effective until</th>
                    <th>Status</th>
                    <th>Created by</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {configurations.map((configuration) => (
                    <tr key={configuration.id}>
                      <td>
                        <div className="row" style={{ gap: 'var(--space-2)' }}>
                          <Icon name={configuration.type === 'fuel_price' ? 'fuel' : 'car'} size={15} />
                          <span className="t-medium">
                            {TYPE_LABEL[configuration.type] ?? configuration.type}
                          </span>
                        </div>
                      </td>
                      <td className="is-numeric">
                        {formatMoney(configuration.value, configuration.currency, 2)}
                        <div className="t-caption t-muted">{configuration.unit}</div>
                      </td>
                      <td className="is-numeric">
                        {configuration.mileageKmpl
                          ? `${formatNumber(configuration.mileageKmpl, 1)} km/l`
                          : '—'}
                      </td>
                      <td className="t-caption t-nowrap">{formatDate(configuration.effectiveFrom)}</td>
                      <td className="t-caption t-nowrap">
                        {configuration.effectiveUntil
                          ? formatDate(configuration.effectiveUntil)
                          : 'Open ended'}
                      </td>
                      <td>
                        <Badge tone={configuration.isCurrent ? 'success' : 'neutral'}>
                          {configuration.isCurrent ? 'In force' : 'Historical'}
                        </Badge>
                      </td>
                      <td className="t-caption">{configuration.createdByName}</td>
                      <td>
                        <div className="table__actions">
                          {configuration.effectiveUntil === null ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCloseTarget(configuration.id)}
                            >
                              Close
                            </Button>
                          ) : null}
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

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody tight>
          <p className="t-caption">
            <span className="t-medium">How a trip is priced:</span> litres = distance ÷ fuel efficiency; cost
            = litres × fuel price + distance × running cost. The values in force when the trip starts are
            copied onto the trip, so later edits cannot move a closed report.
          </p>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Publish a new cost version"
        lead="The previous open-ended version of the same type is closed automatically."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={create.busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={create.busy}>
              Publish version
            </Button>
          </>
        }
      >
        <div className="stack">
          {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}
          <Select
            label="Configuration type"
            options={[
              { value: COST_CONFIG_TYPE.FUEL_PRICE, label: 'Fuel price (per litre)' },
              { value: COST_CONFIG_TYPE.TRAVEL_COST, label: 'Running cost (per kilometre)' },
            ]}
            value={form.type}
            onChange={(event) =>
              setForm({
                ...form,
                type: event.target.value,
                unit: event.target.value === COST_CONFIG_TYPE.FUEL_PRICE ? 'per litre' : 'per km',
              })
            }
          />
          <div className="form-row">
            <Input
              label="Value"
              type="number"
              step="0.01"
              min={0}
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
              error={create.error?.fieldErrors.value}
              placeholder="104.50"
            />
            <Input
              label="Unit"
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
            />
            <Select
              label="Currency"
              options={['INR', 'USD', 'EUR', 'GBP'].map((value) => ({ value, label: value }))}
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value })}
            />
          </div>
          {form.type === COST_CONFIG_TYPE.FUEL_PRICE ? (
            <Input
              label="Fuel efficiency (km per litre)"
              type="number"
              step="0.1"
              min={1}
              value={form.mileageKmpl}
              onChange={(event) => setForm({ ...form, mileageKmpl: event.target.value })}
              error={create.error?.fieldErrors.mileageKmpl}
              hint="Required for a fuel price version"
            />
          ) : null}
          <div className="form-row">
            <Input
              label="Effective from"
              type="date"
              value={form.effectiveFrom}
              onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })}
              error={create.error?.fieldErrors.effectiveFrom}
            />
            <Input
              label="Effective until"
              type="date"
              optional
              value={form.effectiveUntil}
              onChange={(event) => setForm({ ...form, effectiveUntil: event.target.value })}
              error={create.error?.fieldErrors.effectiveUntil}
              hint="Leave empty for open ended"
            />
          </div>
          <Textarea
            label="Note"
            optional
            rows={2}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Q3 pump price revision"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={closeTarget !== null}
        title="Close this cost version?"
        message="It stops applying from now on. Trips already completed under it keep their original figures."
        confirmLabel="Close version"
        busy={close.busy}
        onCancel={() => setCloseTarget(null)}
        onConfirm={async () => {
          if (!closeTarget) return;
          const result = await close.run(closeTarget);
          if (result) {
            toast.success('Cost version closed');
            setCloseTarget(null);
            costs.reload();
          } else if (close.error) {
            toast.error(close.error.message);
          }
        }}
      />
    </>
  );
}
