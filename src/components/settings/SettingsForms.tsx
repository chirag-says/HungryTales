"use client";

import { useState, useTransition } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toaster";
import { LIMITS, type Person } from "@/lib/domain";
import { changePassphrase, renamePeople } from "@/server/actions/auth";

export function SettingsForms({ journalName, persons }: { journalName: string; persons: Person[] }) {
  const toast = useToast();
  const [journal, setJournal] = useState(journalName);
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(persons.map((p) => [p.id, p.name])));
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passErrors, setPassErrors] = useState<Record<string, string>>({});
  const [savingNames, startNames] = useTransition();
  const [savingPass, startPass] = useTransition();

  return (
    <div className="flex flex-col gap-10">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          startNames(async () => {
            const r = await renamePeople({ journalName: journal, names });
            if (r.ok) {
              setNameErrors({});
              toast("Names saved");
            } else setNameErrors({ ...(r.fieldErrors ?? {}), _: r.fieldErrors ? "" : r.error });
          });
        }}
      >
        <h2 className="font-display text-2xl">Names</h2>
        <Field label="Journal name" htmlFor="journal" error={nameErrors.journalName}>
          <input id="journal" value={journal} onChange={(e) => setJournal(e.target.value)} maxLength={LIMITS.nameMax} className={inputClass} />
        </Field>
        {persons.map((p) => (
          <Field key={p.id} label={p.slot === 1 ? "First person" : "Second person"} htmlFor={`name-${p.id}`} error={nameErrors[`names.${p.id}`]}>
            <input id={`name-${p.id}`} value={names[p.id]} onChange={(e) => setNames({ ...names, [p.id]: e.target.value })} maxLength={LIMITS.nameMax} className={inputClass} />
          </Field>
        ))}
        {nameErrors._ ? (
          <p role="alert" className="text-sm text-accent">
            {nameErrors._}
          </p>
        ) : null}
        <Button type="submit" variant="ink" busy={savingNames} className="self-start">
          Save names
        </Button>
      </form>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          startPass(async () => {
            const r = await changePassphrase({ current, next, confirm });
            if (r.ok) {
              setPassErrors({});
              setCurrent("");
              setNext("");
              setConfirm("");
              toast("Passphrase changed. Other devices will need the new one.");
            } else setPassErrors({ ...(r.fieldErrors ?? {}), _: r.fieldErrors ? "" : r.error });
          });
        }}
      >
        <h2 className="font-display text-2xl">Shared passphrase</h2>
        <p className="-mt-2 text-sm text-ink-2">Changing it signs out every other device, including your friend&apos;s phone. Tell them the new one.</p>
        <Field label="Current passphrase" htmlFor="current" error={passErrors.current}>
          <input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
        </Field>
        <Field label="New passphrase" htmlFor="next" hint={`At least ${LIMITS.passphraseMin} characters.`} error={passErrors.next}>
          <input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Type it again" htmlFor="confirm" error={passErrors.confirm}>
          <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </Field>
        {passErrors._ ? (
          <p role="alert" className="text-sm text-accent">
            {passErrors._}
          </p>
        ) : null}
        <Button type="submit" variant="outline" busy={savingPass} className="self-start">
          Change passphrase
        </Button>
      </form>
    </div>
  );
}
