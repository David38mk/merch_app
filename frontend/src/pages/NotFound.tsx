import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-5xl font-extrabold text-brand-600">404</p>
      <p className="mt-2 text-lg font-semibold text-slate-800">Page not found</p>
      <p className="mt-1 text-sm text-slate-500">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6">
        <Button variant="outline">← Back to home</Button>
      </Link>
    </div>
  );
}
