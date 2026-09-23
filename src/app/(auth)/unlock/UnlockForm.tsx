"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { unlockJournal } from "@/server/actions/auth";

export function UnlockForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 flex flex-col gap-5"
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await unlockJournal({ passphrase: String(formData.get("passphrase") ?? "") });
          if (result.ok) router.replace("/who");
          else setError(result.fieldErrors?.passphrase ?? result.error);
        })
      }
    >
      <Field label="Passphrase" htmlFor="passphrase" error={error ?? undefined}>
        <input id="passphrase" name="passphrase" type="password" autoComplete="current-password" required autoFocus className={inputClass} />
      </Field>
      <Button type="submit" variant="ink" size="lg" busy={pending}>
        Open our journal
      </Button>
    </form>
  );
}
