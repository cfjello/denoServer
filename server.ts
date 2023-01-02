import { serve } from "https://deno.land/std@0.140.0/http/server.ts";

async function handler(_req) {
  // List the posts in the `blog` directory located at the root
  // of the repository.
  const posts = [];
  for await (const post of Deno.readDir(`./blog`)) {
    posts.push(post);
  }

  // Return JSON.
  return new Response(JSON.stringify(posts, null, 2), {
    headers: {
      "content-type": "application/json",
    },
  });
}

serve(handler);