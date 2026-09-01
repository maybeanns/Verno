import type { Metadata } from 'next';

import ProfileContent from '@/components/profile/ProfileContent';

export const metadata: Metadata = {
    title: 'Profile — ProductHive',
    description: 'Your account, plan, and API keys.',
};

export default function ProfilePage() {
    return (
        <main className="min-h-screen bg-background relative overflow-x-clip">
            <div className="fixed inset-0 bg-gradient-mesh opacity-20 pointer-events-none" />

            {/* pt-24 clears the fixed navbar. */}
            <div className="relative z-10 container mx-auto px-4 pt-24 pb-12 max-w-5xl">
                <ProfileContent />
            </div>
        </main>
    );
}
