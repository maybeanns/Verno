import { FlatCompat } from '@eslint/eslintrc';

// eslint-config-next is still published as an eslintrc-style config, so it has
// to be bridged into flat config. `next lint` used to do this implicitly; it is
// deprecated and prompts interactively when no config exists, which hangs CI.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
    {
        ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'],
    },
    ...compat.extends('next/core-web-vitals'),
];

export default config;
