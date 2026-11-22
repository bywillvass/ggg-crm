import { Extension } from "@tiptap/react"

// Paragraph variants. Each one is saved as a class on the <p> (e.g. <p class="lead">)
// and styled the same way in the editor (globals.css .blog-content) and on the
// website (ginga-global-group-site css/style.css .post-content).
export const PARAGRAPH_STYLES = ["headline", "kicker", "lead", "info", "ends", "boilerplate", "small"] as const
export type ParagraphStyle = (typeof PARAGRAPH_STYLES)[number]

function isParagraphStyle(v: string): v is ParagraphStyle {
  return (PARAGRAPH_STYLES as readonly string[]).includes(v)
}

export const BlockStyle = Extension.create({
  name: "blockStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          blockStyle: {
            default: null,
            parseHTML: (el) => {
              const match = Array.from(el.classList).find(isParagraphStyle)
              return match ?? null
            },
            renderHTML: (attrs) => (attrs.blockStyle ? { class: attrs.blockStyle } : {}),
          },
        },
      },
    ]
  },
})

export const MEDIA_RELEASE_TEMPLATE = `
<p class="kicker">MEDIA RELEASE | FOR IMMEDIATE RELEASE | [Date]</p>
<p class="headline">[Release headline]</p>
<p class="lead">[Opening paragraph: who, what, when, where and why in two or three sentences.]</p>
<p>[Supporting detail.]</p>
<h2>[Section heading]</h2>
<p>[Body copy.]</p>
<p>"[Quote]," said [Name], [title] of Ginga Global Group.</p>
<h2>[Event or key details heading]</h2>
<p class="info"><strong>When:</strong> [Date]</p>
<p class="info"><strong>Where:</strong> [Venue, address]</p>
<p class="info"><strong>Time:</strong> [Time]</p>
<p><strong>Register:</strong> gingaglobalgroup.com</p>
<p class="ends">ENDS</p>
<p class="boilerplate">Ginga Global Group is an Australian football management and sports tourism organisation founded by Theo Vassilikopoulos, working with players and families in every state.</p>
<h3>Media contact</h3>
<p class="info">[Name], Ginga Global Group</p>
<p class="info">Phone: [Number]</p>
<p class="info">Email: [Email]</p>
<h3>Notes for editors</h3>
<p class="small">[Interview availability, photos, consent notes.]</p>
`.trim().replace(/\n/g, "")

export const BLOG_POST_TEMPLATE = `
<p class="lead">[Intro: one or two sentences that tell the reader what this post is about.]</p>
<h2>[Section heading]</h2>
<p>[Body copy.]</p>
<h3>[Subheading]</h3>
<p>[Body copy.]</p>
<ul><li><p>[Point one]</p></li><li><p>[Point two]</p></li></ul>
<blockquote><p>[Pull quote]</p></blockquote>
<h2>[Section heading]</h2>
<p>[Body copy.]</p>
<p class="small">Photos: [Credit]</p>
`.trim().replace(/\n/g, "")
