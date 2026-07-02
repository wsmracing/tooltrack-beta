"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";
import { displaySerial } from "@/lib/normalise";

export function LookupForm({ compact = false, initialValue = "" }: { compact?: boolean; initialValue?: string }) {
  const [serial, setSerial] = useState(initialValue);
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = displaySerial(serial);
    if (!value) return;
    setSerial(value);
    router.push(`/lookup?serial=${encodeURIComponent(value)}`);
  }

  return (
    <form className={compact ? "lookupForm compact" : "lookupForm"} onSubmit={submit}>
      <label htmlFor={compact ? "lookup-compact" : "lookup-main"}>Serial number</label>
      <div className="lookupInputRow">
        <div className="inputWithIcon"><SearchIcon /><input id={compact ? "lookup-compact" : "lookup-main"} value={serial} onChange={(event) => setSerial(event.target.value.toUpperCase())} onBlur={() => setSerial(displaySerial(serial))} placeholder="Enter serial number" autoCapitalize="characters" autoComplete="off" /></div>
        <button className="button primary" type="submit">Check serial</button>
      </div>
      {!compact && <p className="fieldHint">Spaces, dashes and letter case are ignored.</p>}
    </form>
  );
}
