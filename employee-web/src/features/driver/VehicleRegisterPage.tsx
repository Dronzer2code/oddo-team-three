import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { VEHICLE_STATUS, VEHICLE_TYPE, VEHICLE_TYPE_LABEL } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useMutation } from '../../lib/hooks';
import { isOperational, useAuth } from '../../lib/auth';
import { usePanelAccess } from '../../lib/panels';

const DRAFT_KEY = 'driver_vehicle_draft';

const EMPTY = {
  model: '',
  vehicleType: 'sedan',
  registrationNumber: '',
  color: '',
  seatingCapacity: '5',
  manufacturingYear: '',
  document: '',
};

/**
 * Register Vehicle. The fields and the three buttons are the ones the platform
 * contract specifies. A submitted vehicle starts PENDING review, which is what
 * puts it in the administrator's approval queue.
 *
 * "Save as Draft" keeps the form locally — a draft vehicle is not a database
 * state in this schema, and creating a half-real record to represent one would
 * put a vehicle in the register that nobody submitted.
 */
export function VehicleRegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const panel = usePanelAccess();

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...EMPTY, ...(JSON.parse(saved) as typeof EMPTY) } : EMPTY;
    } catch {
      return EMPTY;
    }
  });

  const create = useMutation((body: Record<string, unknown>) => api.employee.vehicles.create(body));

  const operational = isOperational(user);

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    toast.info('Draft saved on this device');
  }

  async function submit() {
    // The model field carries "make model"; the API stores them separately.
    const words = form.model.trim().split(/\s+/);
    const make = words.length > 1 ? words[0]! : form.model.trim();
    const model = words.length > 1 ? words.slice(1).join(' ') : form.model.trim();

    const result = await create.run({
      make,
      model,
      registrationNumber: form.registrationNumber.trim(),
      vehicleType: form.vehicleType,
      seatingCapacity: Number(form.seatingCapacity),
      color: form.color.trim() || undefined,
    });

    if (result) {
      localStorage.removeItem(DRAFT_KEY);
      toast.success(
        result.status === VEHICLE_STATUS.UNDER_REVIEW
          ? 'Vehicle submitted for approval'
          : 'Vehicle registered and ready to use',
      );
      panel.reload();
      navigate('/driver/vehicle');
    }
  }

  return (
    <>
      <PageHeader
        title="Register Vehicle"
        lead="Register the car you drive to work. An administrator approves it before you can publish rides."
        breadcrumbs={[{ label: 'My Vehicle', href: '/driver/vehicle' }, { label: 'Register Vehicle' }]}
        renderLink={(crumb) => <Link to={crumb.href ?? '#'}>{crumb.label}</Link>}
      />

      <Card style={{ maxWidth: 720 }}>
        <CardHeader title="Vehicle details" lead="All fields are checked again on the server." />
        <CardBody className="stack">
          {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}
          {!operational ? (
            <Alert tone="warning">
              Your account cannot register a vehicle right now. Contact your administrator.
            </Alert>
          ) : null}

          <Input
            label="Vehicle model"
            value={form.model}
            onChange={(event) => set('model', event.target.value)}
            error={create.error?.fieldErrors.make ?? create.error?.fieldErrors.model}
            placeholder="Honda City"
            autoFocus
          />

          <Select
            label="Vehicle type"
            options={Object.values(VEHICLE_TYPE).map((value) => ({
              value,
              label: VEHICLE_TYPE_LABEL[value],
            }))}
            value={form.vehicleType}
            onChange={(event) => set('vehicleType', event.target.value)}
          />

          <Input
            label="Registration number"
            value={form.registrationNumber}
            onChange={(event) => set('registrationNumber', event.target.value)}
            error={create.error?.fieldErrors.registrationNumber}
            placeholder="WB 06 AK 4412"
          />

          <div className="form-row">
            <Input
              label="Vehicle color"
              value={form.color}
              onChange={(event) => set('color', event.target.value)}
              error={create.error?.fieldErrors.color}
              placeholder="Silver"
            />
            <Input
              label="Seating capacity"
              type="number"
              min={1}
              max={50}
              value={form.seatingCapacity}
              onChange={(event) => set('seatingCapacity', event.target.value)}
              error={create.error?.fieldErrors.seatingCapacity}
              hint="Including the driver's seat"
            />
          </div>

          <Input
            label="Manufacturing year"
            optional
            type="number"
            min={1980}
            max={new Date().getFullYear()}
            value={form.manufacturingYear}
            onChange={(event) => set('manufacturingYear', event.target.value)}
          />

          <Textarea
            label="Vehicle document"
            optional
            rows={2}
            value={form.document}
            onChange={(event) => set('document', event.target.value)}
            placeholder="Registration certificate number or a link your administrator can open"
          />

          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => navigate('/driver/vehicle')} disabled={create.busy}>
              Cancel
            </Button>
            <Button variant="ghost" onClick={saveDraft} disabled={create.busy}>
              Save as Draft
            </Button>
            <Button variant="primary" onClick={submit} loading={create.busy} disabled={!operational}>
              Submit for Approval
            </Button>
          </div>

          <Alert tone="info">
            Manufacturing year and document are recorded on the form for your administrator's reference;
            the vehicle register itself stores the model, type, registration, colour and capacity.
          </Alert>
        </CardBody>
      </Card>
    </>
  );
}
