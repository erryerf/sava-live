import GuestGalleryClient from '@/components/guest/GuestGalleryClient';

interface GuestGalleryPageProps {
  params: {
    slug: string;
  };
}

export default function GuestGalleryPage({ params }: GuestGalleryPageProps) {
  return <GuestGalleryClient slug={params.slug} />;
}

