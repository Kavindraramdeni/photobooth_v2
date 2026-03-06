import { BoothPageClient } from './BoothPageClient';

type SearchParamsInput =
  | { [key: string]: string | string[] | undefined }
  | Promise<{ [key: string]: string | string[] | undefined }>;

export default async function BoothPage({
  searchParams,
}: {
 searchParams?: SearchParamsInput;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawEvent = resolvedParams?.event;
  const eventSlug = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
  
  return <BoothPageClient eventSlug={eventSlug} />;
}
