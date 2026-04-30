import { ClientForm } from "../client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nouveau client
        </h1>
      </div>
      <ClientForm />
    </div>
  );
}
