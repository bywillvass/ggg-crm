import { getPost } from "../actions"
import { PostEditor } from "@/components/blog/PostEditor"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()
  return <PostEditor post={post} />
}
