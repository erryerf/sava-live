import LiveWallClient from '@/components/live/LiveWallClient';

interface LiveWallPageProps {
  params: {
    slug: string;
  };
}

export default function LiveWallPage({ params }: LiveWallPageProps) {
  return <LiveWallClient slug={params.slug} />;
}

