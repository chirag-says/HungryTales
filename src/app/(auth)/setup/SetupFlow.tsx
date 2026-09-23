"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { LIMITS } from "@/lib/domain";
import { setupJournal } from "@/server/actions/auth";

type Step = 0 | 1 | 2;

/** Three short steps: you, your friend, the journal and its passphrase. */
export function SetupFlow({ needsSetupCode }: { needsSetupCode: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [myName, setMyName] = useState("");
  const [friendName, setFriendName] = useState("");
  const [journalName, setJournalName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const next = (to: Step) => {
    setErrors({});
    setStep(to);
  };

  const submit = () =>
    startTransition(async () => {
      setErrors({});
      const result = await setupJournal({
        myName,
        friendName,
        journalName: journalName || `${myName} & ${friendName}`,
        passphrase,
        confirm,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currency: "INR",
        setupCode: needsSetupCode ? setupCode : undefined,
      });
      if (result.ok) {
        router.replace("/");
        return;
      }
      setErrors({ ...(result.fieldErrors ?? {}), _: result.fieldErrors ? "" : result.error });
      if (result.fieldErrors?.myName) setStep(0);
      else if (result.fieldErrors?.friendName) setStep(1);
    });

  return (
    <div>
      <p className="eyebrow mb-3" aria-live="polite">
        Step {step + 1} of 3
      </p>

      {step === 0 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (myName.trim()) next(1);
          }}
          className="flex flex-col gap-6"
        >
          <h1 className="font-display text-4xl leading-tight">What should we call you?</h1>
          <Field label="Your name" htmlFor="myName" error={errors.myName}>
            <input id="myName" value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={LIMITS.nameMax} autoComplete="given-name" autoFocus required className={inputClass} />
          </Field>
          <Button type="submit" variant="ink" size="lg" disabled={!myName.trim()}>
            Continue
          </Button>
        </form>
      ) : null}

      {step === 1 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (friendName.trim()) next(2);
          }}
          className="flex flex-col gap-6"
        >
          <h1 className="font-display text-4xl leading-tight">And who do you eat with?</h1>
          <Field label="Your friend's name" htmlFor="friendName" error={errors.friendName}>
            <input id="friendName" value={friendName} onChange={(e) => setFriendName(e.target.value)} maxLength={LIMITS.nameMax} autoFocus required className={inputClass} />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="lg" onClick={() => next(0)} aria-label="Back">
              <ArrowLeft className="size-5" />
            </Button>
            <Button type="submit" variant="ink" size="lg" className="flex-1" disabled={!friendName.trim()}>
              Continue
            </Button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5"
        >
          <h1 className="font-display text-4xl leading-tight">Create your shared journal</h1>
          <p className="-mt-2 text-ink-2">
            You&apos;ll both use one passphrase to open it. After that, each of you picks your own name on your phone.
          </p>
          <Field label="Journal name" htmlFor="journalName" optional error={errors.journalName}>
            <input id="journalName" value={journalName} onChange={(e) => setJournalName(e.target.value)} placeholder={`${myName} & ${friendName}`} maxLength={LIMITS.nameMax} className={inputClass} />
          </Field>
          <Field label="Shared passphrase" htmlFor="passphrase" hint={`At least ${LIMITS.passphraseMin} characters. A short sentence you'll both remember works well.`} error={errors.passphrase}>
            <input id="passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password" minLength={LIMITS.passphraseMin} required className={inputClass} />
          </Field>
          <Field label="Type it again" htmlFor="confirm" error={errors.confirm}>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required className={inputClass} />
          </Field>
          {needsSetupCode ? (
            <Field label="Setup code" htmlFor="setupCode" hint="The SETUP_CODE from your deployment settings. It stops strangers from claiming a fresh install." error={errors.setupCode}>
              <input id="setupCode" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} autoComplete="off" required className={inputClass} />
            </Field>
          ) : null}
          {errors._ ? (
            <p role="alert" className="text-sm text-accent">
              {errors._}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="lg" onClick={() => next(1)} aria-label="Back">
              <ArrowLeft className="size-5" />
            </Button>
            <Button type="submit" variant="primary" size="lg" className="flex-1" busy={pending}>
              Start our food story
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
