/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proyecto unico: paginas del dashboard (app/**) + route handlers del
  // backend (app/api/**), todo en el mismo deploy de Vercel.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
