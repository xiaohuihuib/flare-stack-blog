import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PostEditorData } from "@/features/posts/components/post-editor/types";
import { convertToPlainText, slugify } from "@/features/posts/utils/content";
import type { Tag } from "@/features/tags/tags.schema";
import { orpc, orpcClient } from "@/lib/orpc";
import { useDebounce } from "@/hooks/use-debounce";
import { m } from "@/paraglide/messages";
import {
  BLOB_UPLOADING_ERROR,
  shouldAutogenerateSlug,
} from "../post-editor.model";

interface UsePostActionsOptions {
  postId: number;
  post: PostEditorData;
  setPost: React.Dispatch<React.SetStateAction<PostEditorData>>;
  setError: (error: string | null) => void;
  flush: () => Promise<void>;
  allTags: Array<Tag>;
}

export function usePostActions({
  postId,
  post,
  setPost,
  setError,
  flush,
  allTags,
}: UsePostActionsOptions) {
  const queryClient = useQueryClient();

  const [processState, setProcessState] = useState<
    "IDLE" | "PROCESSING" | "SUCCESS"
  >("IDLE");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);

  const canPublish = useMemo(() => {
    if (!post.publishedAt) return true;
    return post.publishedAt.toISOString().slice(0, 10) <= post.serverToday;
  }, [post.publishedAt, post.serverToday]);

  const lastAutoSlugRef = useRef<string | null>(null);
  const queuedTitleRef = useRef<string | null>(null);
  const prevTitleRef = useRef(post.title);
  const isFirstTitleMount = useRef(true);
  const slugGenerationMode = useRef<"manual" | "auto">("manual");
  const latestSlugRef = useRef(post.slug);
  const latestTitleRef = useRef(post.title);
  latestSlugRef.current = post.slug;
  latestTitleRef.current = post.title;
  const debouncedTitle = useDebounce(post.title, 500);

  const invalidatePostQueries = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.posts.admin.get.key({ input: { id: postId } }),
    });
    void queryClient.invalidateQueries({
      queryKey: orpc.posts.admin.list.key(),
    });
    void queryClient.invalidateQueries({ queryKey: orpc.posts.list.key() });
  };

  const publishMutation = useMutation({
    mutationFn: () => orpcClient.posts.admin.publish({ id: postId }),
    onSuccess: () => {
      toast.success(m.editor_header_publish());
      setPost((prev) => ({ ...prev, hasPublicSnapshot: true }));
      setProcessState("SUCCESS");
      invalidatePostQueries();
      setTimeout(() => {
        setProcessState("IDLE");
      }, 3000);
    },
    onError: () => {
      toast.error(m.editor_action_publish_failed());
      setProcessState("IDLE");
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => orpcClient.posts.admin.unpublish({ id: postId }),
    onSuccess: () => {
      toast.success(m.editor_header_unpublish());
      setPost((prev) => ({ ...prev, hasPublicSnapshot: false }));
      setProcessState("SUCCESS");
      invalidatePostQueries();
      setTimeout(() => {
        setProcessState("IDLE");
      }, 3000);
    },
    onError: () => {
      toast.error(m.editor_action_unpublish_failed());
      setProcessState("IDLE");
    },
  });

  const unpublish = unpublishMutation.mutate;

  const handlePublish = useCallback(async () => {
    if (processState !== "IDLE") return;
    setProcessState("PROCESSING");
    try {
      await flush();
    } catch (error) {
      const message =
        error instanceof Error && error.message === BLOB_UPLOADING_ERROR
          ? m.editor_action_image_uploading()
          : m.editor_action_publish_failed();
      toast.error(message);
      setProcessState("IDLE");
      return;
    }
    publishMutation.mutate();
  }, [flush, processState, publishMutation]);

  const handleUnpublish = useCallback(() => {
    if (processState !== "IDLE") return;
    setProcessState("PROCESSING");
    unpublish();
  }, [processState, unpublish]);

  const slugMutation = useMutation({
    mutationFn: (title: string) =>
      orpcClient.posts.admin.generateSlug({
        title,
        excludeId: postId,
      }),
    onSuccess: (result) => {
      lastAutoSlugRef.current = result.slug;
      setPost((prev) => ({ ...prev, slug: result.slug }));
      if (slugGenerationMode.current === "manual") {
        toast.success(m.editor_action_slug_set(), {
          description: m.editor_action_slug_set_desc({ slug: result.slug }),
        });
      }
    },
    onSettled: (_data, error) => {
      if (error) {
        console.error("Slug generation failed:", error);
        setError(m.editor_action_slug_error());
        const fallbackSlug = slugify(latestTitleRef.current) || "untitled-log";
        lastAutoSlugRef.current = fallbackSlug;
        setPost((prev) => ({ ...prev, slug: fallbackSlug }));
      }
      const queuedTitle = queuedTitleRef.current;
      queuedTitleRef.current = null;
      if (
        queuedTitle &&
        shouldAutogenerateSlug(latestSlugRef.current, lastAutoSlugRef.current)
      ) {
        slugGenerationMode.current = "auto";
        slugMutation.mutate(queuedTitle);
      }
    },
  });

  const previewSummaryMutation = useMutation({
    mutationFn: () =>
      orpcClient.posts.admin.previewSummary({
        contentJson: post.contentJson,
      }),
    onSuccess: (result) => {
      setPost((prev) => ({ ...prev, summary: result.summary }));
    },
    onError: (error) => {
      toast.error(m.editor_action_summary_error(), {
        description:
          error instanceof Error
            ? error.message
            : m.editor_action_unknown_error(),
      });
    },
  });

  const lockSlug = () => {
    lastAutoSlugRef.current = null;
  };

  useEffect(() => {
    if (isFirstTitleMount.current) {
      isFirstTitleMount.current = false;
      prevTitleRef.current = debouncedTitle;
      return;
    }

    if (debouncedTitle === prevTitleRef.current) {
      return;
    }
    prevTitleRef.current = debouncedTitle;

    if (!debouncedTitle.trim()) {
      return;
    }
    if (
      !shouldAutogenerateSlug(latestSlugRef.current, lastAutoSlugRef.current)
    ) {
      return;
    }
    if (slugMutation.isPending) {
      queuedTitleRef.current = debouncedTitle;
      return;
    }
    slugGenerationMode.current = "auto";
    slugMutation.mutate(debouncedTitle);
  }, [debouncedTitle, slugMutation]);

  const handleGenerateSlug = () => {
    if (!post.title.trim()) {
      setError(m.editor_action_title_empty());
      return;
    }
    slugGenerationMode.current = "manual";
    slugMutation.mutate(post.title);
  };

  const handleGenerateSummary = () => {
    const plainText = convertToPlainText(post.contentJson).trim();
    if (plainText.length === 0) {
      toast.error(m.editor_action_no_content(), {
        description: m.editor_action_no_content_summary(),
      });
      return;
    }
    setIsGeneratingSummary(true);
    previewSummaryMutation.mutate(undefined, {
      onSettled: () => {
        setIsGeneratingSummary(false);
      },
    });
  };

  const handleGenerateTags = async () => {
    try {
      setIsGeneratingTags(true);
      const generatedTagNames = await orpcClient.tags.admin.generate({
        title: post.title,
        summary: post.summary,
        content:
          typeof post.contentJson === "string"
            ? post.contentJson
            : JSON.stringify(post.contentJson),
        existingTags: allTags.map((t) => t.name),
      });

      const newTagIds: Array<number> = [];
      const currentTagIds = new Set(post.tagIds);

      for (const name of generatedTagNames) {
        const existingTag = allTags.find(
          (t) => t.name.toLowerCase() === name.toLowerCase(),
        );

        if (existingTag) {
          if (!currentTagIds.has(existingTag.id)) {
            newTagIds.push(existingTag.id);
            currentTagIds.add(existingTag.id);
          }
        } else {
          try {
            const created = await orpcClient.tags.admin.create({ name });
            newTagIds.push(created.id);
            currentTagIds.add(created.id);
          } catch {
            continue;
          }
        }
      }

      if (newTagIds.length > 0) {
        setPost((prev) => ({
          ...prev,
          tagIds: [...prev.tagIds, ...newTagIds],
        }));

        await queryClient.invalidateQueries({
          queryKey: orpc.tags.admin.list.key(),
        });

        toast.success(m.editor_action_tags_done(), {
          description: m.editor_action_tags_added({
            count: String(newTagIds.length),
          }),
        });
      } else {
        toast.info(m.editor_action_tags_done(), {
          description: m.editor_action_tags_none(),
        });
      }
    } catch (error) {
      console.error("Failed to generate tags:", error);
      toast.error(m.editor_action_tags_error(), {
        description:
          error instanceof Error
            ? error.message
            : m.editor_action_unknown_error(),
      });
    } finally {
      setIsGeneratingTags(false);
    }
  };

  return {
    isGeneratingSlug: slugMutation.isPending,
    isGeneratingSummary,
    isGeneratingTags,
    handleGenerateSlug,
    handleGenerateSummary,
    handleGenerateTags,
    handlePublish,
    handleUnpublish,
    processState,
    canPublish,
    lockSlug,
  };
}
