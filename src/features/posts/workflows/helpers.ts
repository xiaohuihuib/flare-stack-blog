import { invalidate } from "@/features/cache/public-cache";
import * as PostService from "@/features/posts/services/posts.service";
import * as SearchService from "@/features/search/service/search.service";
import { getDb } from "@/lib/db";

export async function fetchPost(env: Env, postId: number) {
  const db = getDb(env);
  return await PostService.findPostById({ db, env }, { id: postId });
}

export async function invalidatePostCaches(
  env: Env,
  executionCtx: ExecutionContext,
  slug: string,
) {
  await invalidate.postPublished({ env, executionCtx }, { slug });
}

export async function upsertPostSearchIndex(
  env: Env,
  post: {
    id: number;
    slug: string;
    title: string;
    summary: string | null;
    contentJson: Parameters<typeof SearchService.upsert>[1]["contentJson"];
    tags: Array<{ name: string }>;
  },
) {
  const db = getDb(env);
  await SearchService.upsert(
    { env, db },
    {
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      contentJson: post.contentJson,
      tags: post.tags.map((t) => t.name),
    },
  );
}
