/** @type {import('next').NextConfig} */
const nextConfig = {
    // Next 16 builds with Turbopack. The old webpack block only stubbed out
    // fs/net/tls for the client bundle; Turbopack handles that itself and the
    // build is clean without it.
    reactStrictMode: true,
    poweredByHeader: false,

    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

module.exports = nextConfig;
