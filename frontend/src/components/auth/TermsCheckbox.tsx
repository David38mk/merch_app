import { Link } from "react-router-dom";

/** Terms & Privacy acceptance — a hard requirement on every signup path.
 * The links open the policy pages in a new tab so they don't lose the form. */
export function TermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-600">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        I agree to the{" "}
        <Link to="/terms" target="_blank" className="font-medium text-brand-700 hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" target="_blank" className="font-medium text-brand-700 hover:underline">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}
