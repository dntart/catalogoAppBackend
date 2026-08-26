'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { registrarNegocio } from '../../ui/api-client';
import { useAuth } from '../../ui/AuthContext';

export default function RegistroPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [ownerNombre, setOwnerNombre] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerWhatsappNumber, setOwnerWhatsappNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registrarNegocio({
        nombreNegocio,
        ownerNombre,
        ownerEmail,
        ownerPassword,
        ownerWhatsappNumber: ownerWhatsappNumber || undefined,
      });
      await login(ownerEmail, ownerPassword);
      router.push('/');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('Ya existe una cuenta con ese email');
      } else if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError('Demasiados intentos, esperá un minuto y volvé a probar');
      } else {
        setError('No se pudo crear la cuenta. Revisá los datos.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Textil Stock</h1>
          <p className="mt-1 text-sm text-stone-500">Creá la cuenta de tu negocio</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-600">Nombre del negocio</label>
          <input
            required
            value={nombreNegocio}
            onChange={(e) => setNombreNegocio(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 focus:border-stone-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-600">Tu nombre</label>
          <input
            required
            value={ownerNombre}
            onChange={(e) => setOwnerNombre(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 focus:border-stone-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-600">Email</label>
          <input
            type="email"
            required
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 focus:border-stone-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-600">Contraseña</label>
          <input
            type="password"
            required
            minLength={8}
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 focus:border-stone-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-stone-400">Mínimo 8 caracteres</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-stone-600">
            WhatsApp <span className="text-stone-400">(opcional, para usar el bot)</span>
          </label>
          <input
            placeholder="whatsapp:+549..."
            value={ownerWhatsappNumber}
            onChange={(e) => setOwnerWhatsappNumber(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 focus:border-stone-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-stone-800 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
        <p className="text-center text-sm text-stone-500">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-stone-800 underline">
            Ingresá acá
          </Link>
        </p>
      </form>
    </div>
  );
}
