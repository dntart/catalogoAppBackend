/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only: no paginas, solo route handlers bajo app/api/**
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
