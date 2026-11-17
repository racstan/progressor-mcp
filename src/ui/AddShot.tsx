// Adding a screenshot to a thing to try: pick a file, or paste a picture into the note. Optional, like
// every mark; the picture is kept with the goal's pictures and your AI is told where it is.
import { type ClipboardEvent, useRef, useState } from "react";
import { uploadHandTestPicture } from "./data.js";
import { Icon } from "./Icon.js";

/** What the file picker offers: the same kinds the plan keeps as pictures. */
const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.webm,.mp4";

/** A picture pasted from the clipboard (a screenshot), named so its caption reads well; undefined for text. */
export function pastedPicture(items: DataTransferItemList | undefined): File | undefined {
  const item = [...(items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
  const file = item?.getAsFile();
  if (!file) return undefined;
  const ext = file.type === "image/jpeg" ? ".jpg" : `.${file.type.slice("image/".length)}`;
  return new File([file], `Your screenshot${ext}`, { type: file.type });
}

/**
 * The "Add a screenshot" link and a paste handler for a note field, for one thing to try. `onAdded`
 * loads the plan again so the picture shows.
 */
export function useAddShot(target: { projectId: string; goalId: string; testId: string | undefined }, onAdded: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const add = async (file: File) => {
    if (!target.testId) return;
    setBusy(true);
    setError(undefined);
    try {
      await uploadHandTestPicture(target.projectId, target.goalId, target.testId, file);
      onAdded();
    } catch (e) {
      setError(`The screenshot was not added: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    const file = pastedPicture(e.clipboardData?.items);
    if (!file) return;
    e.preventDefault();
    void add(file);
  };
  const picker = (
    <>
      <button type="button" className={`linkbtn add-shot${busy ? " busy" : ""}`} disabled={busy} title="Pick a screenshot or recording, or paste one into the note" onClick={() => input.current?.click()}>
        <Icon name="image" size={14} /> {busy ? "Adding the screenshot…" : "Add a screenshot"}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void add(file);
        }}
      />
    </>
  );
  return { picker, onPaste, busy, error };
}
