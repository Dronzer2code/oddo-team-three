import { useEffect, useState } from 'react';
import { DISTANCE_UNIT, formatDateTime } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'UTC'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

interface FormState {
  name: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  timezone: string;
  currency: string;
  distanceUnit: string;
  carpoolingEnabled: boolean;
  vehicleApprovalRequired: boolean;
  rideApprovalRequired: boolean;
  defaultMileageKmpl: string;
}

export function OrganizationPage() {
  const toast = useToast();
  const organization = useApi(() => api.admin.organization.get(), []);
  const save = useMutation((body: Record<string, unknown>) => api.admin.organization.updateSettings(body));

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    const data = organization.data;
    if (!data) return;
    setForm({
      name: data.organization.name,
      logoUrl: data.organization.logoUrl ?? '',
      contactEmail: data.organization.contactEmail ?? '',
      contactPhone: data.organization.contactPhone ?? '',
      address: data.organization.address ?? '',
      timezone: data.organization.timezone,
      currency: data.organization.currency,
      distanceUnit: data.organization.distanceUnit,
      carpoolingEnabled: data.organization.carpoolingEnabled,
      vehicleApprovalRequired: data.settings.vehicleApprovalRequired,
      rideApprovalRequired: data.settings.rideApprovalRequired,
      defaultMileageKmpl: String(data.settings.defaultMileageKmpl),
    });
  }, [organization.data]);

  if (organization.error) {
    return (
      <>
        <PageHeader title="Organization" />
        <Card>
          <ErrorState {...resolveErrorCopy(organization.error)} onRetry={organization.reload} />
        </Card>
      </>
    );
  }

  if (!form || !organization.data) {
    return (
      <>
        <PageHeader title="Organization" />
        <Card>
          <CardBody className="stack">
            <Skeleton variant="title" width="30%" />
            <Skeleton width="60%" />
            <Skeleton variant="block" height={180} />
          </CardBody>
        </Card>
      </>
    );
  }

  const data = organization.data;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });

  async function submit() {
    const result = await save.run({
      name: form!.name,
      logoUrl: form!.logoUrl,
      contactEmail: form!.contactEmail,
      contactPhone: form!.contactPhone,
      address: form!.address,
      timezone: form!.timezone,
      currency: form!.currency,
      distanceUnit: form!.distanceUnit,
      carpoolingEnabled: form!.carpoolingEnabled,
      vehicleApprovalRequired: form!.vehicleApprovalRequired,
      rideApprovalRequired: form!.rideApprovalRequired,
      defaultMileageKmpl: Number(form!.defaultMileageKmpl),
    });
    if (result) {
      toast.success('Organization settings saved');
      organization.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Organization"
        lead="Identity, locale and carpooling policy. Every change is recorded in the audit log."
        actions={
          <Button variant="primary" onClick={submit} loading={save.busy}>
            Save changes
          </Button>
        }
      />

      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}

      <div
        className="grid grid-split-tight"
        style={{
          alignItems: 'start',
          marginTop: save.error ? 'var(--space-4)' : 0,
        }}
      >
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Identity"
              lead={`Organization code for self registration: ${data.organization.slug}`}
            />
            <CardBody className="stack">
              <Input
                label="Organization name"
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                error={save.error?.fieldErrors.name}
              />
              <Input
                label="Logo URL"
                optional
                value={form.logoUrl}
                onChange={(event) => set('logoUrl', event.target.value)}
                error={save.error?.fieldErrors.logoUrl}
                hint="Shown in the employee and admin applications"
              />
              {form.logoUrl ? (
                <div className="row">
                  <img
                    src={form.logoUrl}
                    alt=""
                    style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                  />
                  <span className="t-caption">Logo preview</span>
                </div>
              ) : null}
              <div className="form-row">
                <Input
                  label="Contact email"
                  type="email"
                  optional
                  value={form.contactEmail}
                  onChange={(event) => set('contactEmail', event.target.value)}
                  error={save.error?.fieldErrors.contactEmail}
                />
                <Input
                  label="Contact phone"
                  optional
                  value={form.contactPhone}
                  onChange={(event) => set('contactPhone', event.target.value)}
                  error={save.error?.fieldErrors.contactPhone}
                />
              </div>
              <Input
                label="Service area or address"
                optional
                value={form.address}
                onChange={(event) => set('address', event.target.value)}
                error={save.error?.fieldErrors.address}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Locale" lead="Applied consistently across every application" />
            <CardBody>
              <div className="form-row">
                <Select
                  label="Time zone"
                  options={TIMEZONES.map((value) => ({ value, label: value }))}
                  value={form.timezone}
                  onChange={(event) => set('timezone', event.target.value)}
                />
                <Select
                  label="Currency"
                  options={CURRENCIES.map((value) => ({ value, label: value }))}
                  value={form.currency}
                  onChange={(event) => set('currency', event.target.value)}
                />
                <Select
                  label="Distance unit"
                  options={[
                    { value: DISTANCE_UNIT.KM, label: 'Kilometres' },
                    { value: DISTANCE_UNIT.MI, label: 'Miles' },
                  ]}
                  value={form.distanceUnit}
                  onChange={(event) => set('distanceUnit', event.target.value)}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Carpooling policy" />
            <CardBody className="stack-lg">
              <Switch
                checked={form.carpoolingEnabled}
                onChange={(value) => set('carpoolingEnabled', value)}
                label="Carpooling available"
                hint="When switched off, nobody can publish or request a ride. Existing trips are unaffected."
              />
              <Switch
                checked={form.vehicleApprovalRequired}
                onChange={(value) => set('vehicleApprovalRequired', value)}
                label="Vehicle approval required"
                hint="New employee vehicles start under review and must be approved before use."
              />
              <Switch
                checked={form.rideApprovalRequired}
                onChange={(value) => set('rideApprovalRequired', value)}
                label="Driver approves each seat request"
                hint="Passengers request a seat and the driver accepts or declines."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Default fuel efficiency" lead="Used when no cost version specifies one" />
            <CardBody className="stack">
              <Input
                label="Kilometres per litre"
                type="number"
                step="0.1"
                min={1}
                value={form.defaultMileageKmpl}
                onChange={(event) => set('defaultMileageKmpl', event.target.value)}
                error={save.error?.fieldErrors.defaultMileageKmpl}
              />
              <Alert tone="info">
                Fuel price and running cost are versioned separately on the Costs page so historical trips
                keep the rate that applied at the time.
              </Alert>
              <p className="t-caption">Last updated {formatDateTime(data.settings.updatedAt)}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
