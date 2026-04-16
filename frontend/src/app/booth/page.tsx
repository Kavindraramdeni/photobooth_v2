import { BoothPageClient } from './BoothPageClient';

type BoothPageProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

  export default async function BoothPage({ searchParams }: BoothPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawEvent = resolvedParams?.event;
  const eventSlug = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
    
  return <BoothPageClient eventSlug={eventSlug} />;
}
