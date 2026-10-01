import { listPosts } from "./actions"
import { BlogList } from "@/components/blog/BlogList"

export const dynamic = "force-dynamic"

export default async function BlogPage() {
  const posts = await listPosts()
  return <BlogList initialPosts={posts} />
}
