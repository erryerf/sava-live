import CrewUploadClient from '@/components/crew/CrewUploadClient';

interface CrewPageProps {
  params: {
    slug: string;
  };
}

export default function CrewUploadPage({ params }: CrewPageProps) {
  return <CrewUploadClient slug={params.slug} />;
}

