'use client';

import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import {
  createAdminNegocio,
  fetchAdminNegocios,
  updateAdminNegocio,
  updateAdminUsuario,
} from '../../../ui/api-client';
import { useAuth } from '../../../ui/AuthContext';
import type { NegocioConUsuarios, UsuarioResumen } from '../../../ui/types';

function FormularioNuevoTaller({ onCreado }: { onCreado: () => void }) {
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [ownerNombre, setOwnerNombre] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerWhatsappNumber, setOwnerWhatsappNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createAdminNegocio({
        nombreNegocio,
        ownerNombre,
        ownerEmail,
        ownerPassword,
        ownerWhatsappNumber: ownerWhatsappNumber || undefined,
      });
      setNombreNegocio('');
      setOwnerNombre('');
      setOwnerEmail('');
      setOwnerPassword('');
      setOwnerWhatsappNumber('');
      onCreado();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('Ya existe una cuenta con ese email.');
      } else {
        setError('No se pudo crear el taller. Revisá los datos (contraseña mínimo 8 caracteres).');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-wa-text">Nuevo taller</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-wa-bubble-in p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs text-wa-text-light">Nombre del taller</label>
          <input
            required
            value={nombreNegocio}
            onChange={(e) => setNombreNegocio(e.target.value)}
            className="rounded border border-wa-border px-2 py-1.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-wa-text-light">Nombre del dueño</label>
          <input
            required
            value={ownerNombre}
            onChange={(e) => setOwnerNombre(e.target.value)}
            className="rounded border border-wa-border px-2 py-1.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-wa-text-light">Email</label>
          <input
            type="email"
            required
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="rounded border border-wa-border px-2 py-1.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-wa-text-light">Contraseña</label>
          <input
            type="password"
            required
            minLength={8}
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            className="rounded border border-wa-border px-2 py-1.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-wa-text-light">
            WhatsApp <span className="text-wa-text-light">(opcional)</span>
          </label>
          <input
            placeholder="whatsapp:+549..."
            value={ownerWhatsappNumber}
            onChange={(e) => setOwnerWhatsappNumber(e.target.value)}
            className="rounded border border-wa-border px-2 py-1.5"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-wa-green px-4 py-1.5 text-white hover:brightness-95 disabled:opacity-50"
        >
          {submitting ? 'Creando...' : 'Crear taller'}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    </section>
  );
}

function FilaUsuario({
  usuario,
  onGuardado,
}: {
  usuario: UsuarioResumen;
  onGuardado: (actualizado: UsuarioResumen) => void;
}) {
  const [email, setEmail] = useState(usuario.email);
  const [whatsapp, setWhatsapp] = useState(usuario.whatsappNumber ?? '');
  const [activo, setActivo] = useState(usuario.activo);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const huboCambios = email !== usuario.email || whatsapp !== (usuario.whatsappNumber ?? '') || activo !== usuario.activo;

  async function guardar(): Promise<void> {
    setError(null);
    setGuardando(true);
    try {
      const actualizado = await updateAdminUsuario(usuario.id, {
        email,
        whatsappNumber: whatsapp || undefined,
        activo,
      });
      onGuardado(actualizado);
    } catch {
      setError('No se pudo guardar. Revisá que el email/número no estén en uso.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className="border-t border-wa-border">
      <td className="px-4 py-2">{usuario.nombre}</td>
      <td className="px-4 py-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-56 rounded border border-wa-border px-2 py-1"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="whatsapp:+549..."
          className="w-48 rounded border border-wa-border px-2 py-1"
        />
      </td>
      <td className="px-4 py-2">{usuario.esSuperAdmin ? 'Sí' : 'No'}</td>
      <td className="px-4 py-2">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
      </td>
      <td className="px-4 py-2">
        <button
          onClick={guardar}
          disabled={!huboCambios || guardando}
          className="rounded bg-wa-green px-3 py-1 text-xs text-white hover:brightness-95 disabled:opacity-40"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

function TarjetaNegocio({
  negocio,
  onNegocioActualizado,
  onUsuarioActualizado,
}: {
  negocio: NegocioConUsuarios;
  onNegocioActualizado: (id: string, activo: boolean) => void;
  onUsuarioActualizado: (negocioId: string, usuario: UsuarioResumen) => void;
}) {
  const [activo, setActivo] = useState(negocio.activo);
  const [guardando, setGuardando] = useState(false);

  async function cambiarActivo(nuevoValor: boolean): Promise<void> {
    setActivo(nuevoValor);
    setGuardando(true);
    try {
      await updateAdminNegocio(negocio.id, { activo: nuevoValor });
      onNegocioActualizado(negocio.id, nuevoValor);
    } catch {
      setActivo(!nuevoValor); // revertir si falló
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="rounded-lg bg-wa-bubble-in p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-wa-text">{negocio.nombre}</h2>
          <p className="text-xs text-wa-text-light">
            Alta: {new Date(negocio.createdAt).toLocaleDateString()}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-wa-text">
          <input
            type="checkbox"
            checked={activo}
            disabled={guardando}
            onChange={(e) => cambiarActivo(e.target.checked)}
          />
          Taller activo
        </label>
      </div>

      {negocio.usuarios.length === 0 ? (
        <p className="text-sm text-wa-text-light">Este negocio no tiene usuarios cargados.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-wa-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-wa-input-bg text-wa-text">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">WhatsApp</th>
                <th className="px-4 py-2">Super-admin</th>
                <th className="px-4 py-2">Activo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {negocio.usuarios.map((usuario) => (
                <FilaUsuario
                  key={usuario.id}
                  usuario={usuario}
                  onGuardado={(actualizado) => onUsuarioActualizado(negocio.id, actualizado)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminPage() {
  const { user, loading: cargandoUsuario } = useAuth();
  const [negocios, setNegocios] = useState<NegocioConUsuarios[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.esSuperAdmin) return;
    fetchAdminNegocios()
      .then(setNegocios)
      .finally(() => setLoading(false));
  }, [user]);

  if (cargandoUsuario) {
    return <p className="text-wa-text-light">Cargando...</p>;
  }

  if (!user?.esSuperAdmin) {
    return (
      <div className="rounded-lg bg-wa-bubble-in p-5 text-wa-text shadow-sm">
        <h2 className="text-lg font-semibold">No autorizado</h2>
        <p className="mt-1 text-sm text-wa-text-light">
          Esta sección es solo para el administrador del sistema.
        </p>
      </div>
    );
  }

  function actualizarNegocioEnLista(id: string, activo: boolean): void {
    setNegocios((prev) => prev.map((n) => (n.id === id ? { ...n, activo } : n)));
  }

  function actualizarUsuarioEnLista(negocioId: string, usuario: UsuarioResumen): void {
    setNegocios((prev) =>
      prev.map((n) =>
        n.id !== negocioId
          ? n
          : { ...n, usuarios: n.usuarios.map((u) => (u.id === usuario.id ? usuario : u)) },
      ),
    );
  }

  function recargarNegocios(): void {
    setLoading(true);
    fetchAdminNegocios()
      .then(setNegocios)
      .finally(() => setLoading(false));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-wa-text">Talleres</h1>
        <p className="text-sm text-wa-text-light">
          Todos los negocios dados de alta en el sistema, con el email y el número de WhatsApp de cada usuario.
        </p>
      </div>

      <FormularioNuevoTaller onCreado={recargarNegocios} />

      {loading ? (
        <p className="text-wa-text-light">Cargando...</p>
      ) : negocios.length === 0 ? (
        <p className="text-wa-text-light">Todavía no hay negocios cargados.</p>
      ) : (
        negocios.map((negocio) => (
          <TarjetaNegocio
            key={negocio.id}
            negocio={negocio}
            onNegocioActualizado={actualizarNegocioEnLista}
            onUsuarioActualizado={actualizarUsuarioEnLista}
          />
        ))
      )}
    </div>
  );
}
