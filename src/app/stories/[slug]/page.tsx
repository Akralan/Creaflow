import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoryPage from "@/components/landing/tellovo/StoryPage";
import { getStory, STORIES } from "@/components/landing/tellovo/stories";

// The three testimonials of the landing each lead here (copied from tellovo.ai/stories/*).
export const dynamicParams = false;

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const story = getStory((await params).slug);
  if (!story) return {};
  const title = `${story.title} · Tellovo`;
  return {
    title: story.title,
    description: story.description,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Tellovo",
      title,
      description: story.description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: story.description,
    },
  };
}

export default async function StoryRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const story = getStory((await params).slug);
  if (!story) notFound();
  return <StoryPage story={story} />;
}
