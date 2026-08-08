import { useState } from 'react';
import { Alert, Button, Input, Textarea } from '@carpool/ui';
import { ApiError } from '@carpool/api-client';
import { contactRequestSchema } from '@carpool/shared';
import { api } from '../lib/config';

interface FormState {
  name: string;
  email: string;
  company: string;
  employees: string;
  message: string;
}

const EMPTY: FormState = { name: '', email: '', company: '', employees: '', message: '' };

export function Contact() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failure, setFailure] = useState<string | null>(null);

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    <section className="section" id="contact">
      <div className="cta" style={{ marginBottom: 'var(--space-8)' }}>
        <div>
          <h2 className="cta__title">Ready to take cars off the road?</h2>
          <p className="cta__text">
            Tell us how many people commute to your offices and we will set up a walkthrough with your own
            cost configuration.
          </p>
        </div>
        <Button variant="accent" size="lg" iconAfter="arrowRight" onClick={() => document.getElementById('contact-form')?.scrollIntoView()}>
          Request a demo
        </Button>
      </div>

      <div className="split" id="contact-form">
        <div>
          <span className="eyebrow">Contact</span>
          <h2 className="section__title">Talk to us.</h2>
          <p className="section__lead">
            We will reply with a demo organization seeded with your own numbers, so you can see the dashboard
            and reports before rolling anything out.
          </p>
          <div className="stack" style={{ marginTop: 'var(--space-6)' }}>
            <div>
              <div className="t-label">Email</div>
              <div>mobility@ridesync.example.com</div>
            </div>
            <div>
              <div className="t-label">Phone</div>
              <div>+91 33 4000 1200</div>
            </div>
            <div>
              <div className="t-label">Office</div>
              <div>14 Park Street, Kolkata 700016</div>
            </div>
          </div>
        </div>

        <form className="card" onSubmit={submit} noValidate>
          <div className="card-body stack">
            {status === 'sent' ? <Alert tone="success">Thanks — we will be in touch shortly.</Alert> : null}
            {failure ? <Alert tone="error">{failure}</Alert> : null}

            <div className="form-row">
              <Input label="Your name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" />
              <Input
                label="Work email"
                type="email"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
                autoComplete="email"
              />
            </div>
            <div className="form-row">
              <Input label="Company" value={form.company} onChange={set('company')} error={errors.company} />
              <Input
                label="Commuting employees"
                value={form.employees}
                onChange={set('employees')}
                error={errors.employees}
                optional
                placeholder="e.g. 250"
              />
            </div>
            <Textarea
              label="What would you like to solve?"
              value={form.message}
              onChange={set('message')}
              error={errors.message}
              rows={4}
              placeholder="We have three offices and no visibility on who is driving in alone…"
            />
            <Button type="submit" variant="primary" loading={status === 'sending'} block>
              Send request
            </Button>
            <p className="t-caption">
              We only use these details to reply to your request.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
