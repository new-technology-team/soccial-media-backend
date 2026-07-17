import { Flame, Hash, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import type { FeedPost } from "@/types";

interface TrendingHashtag {
  tag: string;
  count: number;
}

interface TrendingWidgetProps {
  hashtags: TrendingHashtag[];
  trendingPosts: FeedPost[];
  loading: boolean;
}

export default function TrendingWidget({
  hashtags,
  trendingPosts,
  loading,
}: TrendingWidgetProps) {
  if (loading) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="mb-3 flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Thịnh hành</h3>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const showHashtags = hashtags.length > 0;
  const showPosts = trendingPosts.length > 0;
  const showContent = showHashtags || showPosts;

  if (!showContent) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="mb-2 flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Thịnh hành</h3>
        </div>
        <p className="text-xs text-gray-500">Chưa có nội dung thịnh hành.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <div className="mb-3 flex items-center gap-2">
        <Flame size={16} className="text-orange-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Thịnh hành</h3>
      </div>

      {showHashtags && (
        <div className="mb-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <Hash size={12} />
            Hashtags
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.slice(0, 8).map(({ tag, count }) => (
              <Link
                key={tag}
                to={`/explore?q=${encodeURIComponent(`#${tag}`)}`}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <span className="font-medium">#{tag}</span>
                <span className="text-gray-400">{count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showPosts && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <TrendingUp size={12} />
            Bài viết nổi bật
          </h4>
          <div className="space-y-2.5">
            {trendingPosts.slice(0, 4).map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className="group block"
              >
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs leading-relaxed text-gray-700 group-hover:text-blue-600 transition-colors">
                      {post.content
                        ? post.content.replace(/#[^\s#.,!?;:]+/g, "").trim()
                        : "(Bài viết không có nội dung)"}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{post.authorName}</span>
                      <span>·</span>
                      <span>{post.reactionCount} reactions</span>
                      <span>·</span>
                      <span>{post.commentCount} comments</span>
                    </div>
                  </div>
                  {post.mediaUrl && (
                    <img
                      src={post.mediaUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
