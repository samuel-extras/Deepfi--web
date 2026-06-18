import { redirect } from "next/navigation";
import { buildRedirectUrlWithParams } from "@/lib/utils/urlParsing";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: PageProps) {
  redirect(await buildRedirectUrlWithParams("/prediction", searchParams));
}
