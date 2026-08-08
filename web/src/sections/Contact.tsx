import { useState } from 'react';
import { Alert, Button, Input, Textarea } from '@carpool/ui';
import { ApiError } from '@carpool/api-client';
import { contactRequestSchema } from '@carpool/shared';
import { Stars } from '../components/Stars';
import { api } from '../lib/config';

interface FormState {
  name: string;
  email: string;
  company: string;
  employees: string;
  message: string;
}

const EMPTY: FormState = {
  name: '',
  email: '',
  company: '',
  employees: '',
  message: '',
};

const OFFICES = [
  {
    city: 'Kolkata',
    address: '14 Park Street, Kolkata 700016',
    phone: '+91 33 4000 1200',
  },
  {
    city: 'Pune',
    address: 'Level 6, Amar Tech Park, Balewadi 411045',
    phone: '+91 20 6720 4400',
  },
];

/**
 * Contact section, following the reference's contact page: centred intro with a
 * rating line, a forest form card with mint fields, then the office list.
 * Posts to the real API using the same zod schema the server validates with.
 */
export function Contact() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  const set =
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
      setErrors((current) => ({ ...current, [key]: '' }));
    };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);

    // Same schema the API validates against — no duplicate rules.
    const parsed = contactRequestSchema.safeParse({
      ...form,
      employees: form.employees || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }

    setStatus('sending');
    try {
      await api.public.contact(parsed.data);
      setStatus('sent');
      setForm(EMPTY);
    } catch (error) {
      setStatus('idle');
      setFailure(
        error instanceof ApiError
          ? error.isNetworkError
            ? 'Connection unavailable. Check your internet connection and try again.'
            : error.message
          : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <section className="band band--faint" id="contact">
      <div className="band__inner">
        <div className="section-head section-head--center">
          <span className="eyebrow">Ready when you are</span>
          <div className="section-head__text">
            <h2 className="section-head__title" style={{ fontSize: 'clamp(2.25rem, 4vw, 3.125rem)' }}>
              Get in touch.
            </h2>
            <p className="section-head__lead" style={{ margin: 'var(--space-4) auto 0' }}>
              Tell us how many people commute to your offices and we will set up a walkthrough on a demo
              organisation seeded with your own cost configuration.
            </p>
          </div>
          <div className="rating rating--center">
            <Stars />
            <p className="rating__caption">Usually answered within one working day</p>
          </div>
        </div>

        <form
          className="panel panel--forest"
          onSubmit={submit}
          noValidate
          style={{ maxWidth: 880, margin: '0 auto' }}
        >
          <div className="stack" style={{ padding: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
            {status === 'sent' ? <Alert tone="success">Thanks — we will be in touch shortly.</Alert> : null}
            {failure ? <Alert tone="error">{failure}</Alert> : null}

            <div className="form-row">
              <Input
                label="Your name"
                value={form.name}
                onChange={set('name')}
                error={errors.name}
                autoComplete="name"
                placeholder="Jaya Sharma"
              />
              <Input
                label="Work email"
                type="email"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
                autoComplete="email"
                placeholder="jaya@company.com"
              />
            </div>
            <div className="form-row">
              <Input
                label="Company"
                value={form.company}
                onChange={set('company')}
                error={errors.company}
                placeholder="Meridian Works"
              />
              <Input
                label="Commuting employees"
                value={form.employees}
                onChange={set('employees')}
                error={errors.employees}
                optional
                placeholder="250"
              />
            </div>
            <Textarea
              label="What would you like to solve?"
              value={form.message}
              onChange={set('message')}
              error={errors.message}
              rows={5}
              placeholder="We have three offices and no visibility on who is driving in alone…"
            />
            <Button type="submit" variant="secondary" size="lg" loading={status === 'sending'} block>
              Send request
            </Button>
            <p className="t-caption" style={{ color: 'var(--color-fg-on-ink-muted)' }}>
              We only use these details to reply to your request.
            </p>
          </div>
        </form>

        <div className="split" style={{ marginTop: 'clamp(3rem, 6vw, 5rem)' }}>
          <div>
            <span className="eyebrow">Our offices</span>
            <h3
              className="split__title"
              style={{
                marginTop: 'var(--space-4)',
                fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
              }}
            >
              Come and see it running.
            </h3>
          </div>
          <div className="grid grid-2">
            {OFFICES.map((office) => (
              <div key={office.city}>
                <h4 className="t-lead" style={{ fontSize: '1.25rem' }}>
                  {office.city}
                </h4>
                <p className="t-caption" style={{ marginTop: 'var(--space-3)' }}>
                  {office.address}
                </p>
                <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>
                  <span className="t-medium">Office </span>
                  {office.phone}
                </p>
                <p className="t-caption" style={{ marginTop: 'var(--space-1)' }}>
                  <span className="t-medium">Email </span>
                  mobility@ridesync.example.com
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
