// The notice at the bottom of Settings and Help: Progressor is free, so anyone selling it is not us.
import { FREE_NOTICE } from "./words.js";

export function FreeNotice() {
  return (
    <p className="free-notice" role="note">
      {FREE_NOTICE}
    </p>
  );
}
