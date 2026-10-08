export function buildStructuredEmail(opts: {
  eyebrow?: string | null
  heading: string
  subheading?: string | null
  body: string
  unsubscribeUrl?: string
}): string {
  const MAIN_LOGO = "https://iaigtvfdteagnvkljvcq.supabase.co/storage/v1/object/sign/email-attachments/Main%20logo%20whiite.png?token=eyJraWQiOiI5YzA2ZGU3My1iM2JkLTQ2ZTgtODE0Zi01NjE3MWQyZmI0OTUiLCJhbGciOiJIUzUxMiJ9.eyJ1cmwiOiJlbWFpbC1hdHRhY2htZW50cy9NYWluIGxvZ28gd2hpaXRlLnBuZyIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3OTE0MjA0NDQsImV4cCI6MjQyMjE0MDQ0NH0.smrhE7e5fIOBzG4pNrO3R9k7sC3SzpppHkx8m_4aVA_aBHUM_QgUPSUuXWKgkHA76atHPM8484AoqE7Gf7ysrw"
  const G_LOGO = "https://iaigtvfdteagnvkljvcq.supabase.co/storage/v1/object/sign/email-attachments/G%20logo%20white.png?token=eyJraWQiOiI5YzA2ZGU3My1iM2JkLTQ2ZTgtODE0Zi01NjE3MWQyZmI0OTUiLCJhbGciOiJIUzUxMiJ9.eyJ1cmwiOiJlbWFpbC1hdHRhY2htZW50cy9HIGxvZ28gd2hpdGUucG5nIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc5MTQyMDQ5OCwiZXhwIjoyNDIyMTQwNDk4fQ.Okyr-bHXd9CFjFS_Dl8WvzMaTEYFNYRNFVouLMagTYXkjwWHvj0HWQ0pgtE8TnzI1RPXPWl6AWsxVP-Q3lcVAg"
  const year = new Date().getFullYear()

  const paragraphs = opts.body
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")

  const eyebrowHtml = opts.eyebrow ? `
    <tr><td style="padding:36px 40px 0 40px;">
      <div style="font-family:'Poppins',Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:600;letter-spacing:2px;color:#C9A227;text-transform:uppercase;">${opts.eyebrow}</div>
    </td></tr>` : ""

  const headingTopPad = opts.eyebrow ? "12px" : "36px"

  const subheadingHtml = opts.subheading ? `
    <tr><td style="padding:12px 40px 0 40px;">
      <div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;line-height:26px;font-weight:500;color:#4B4D6A;">${opts.subheading}</div>
    </td></tr>` : ""

  const unsubHtml = opts.unsubscribeUrl ? `<p style="margin:8px 0 0 0;"><a href="${opts.unsubscribeUrl}" style="color:#A9ABC8;text-decoration:underline;font-size:11px;">Unsubscribe</a></p>` : ""

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<!--<![endif]-->
<style>body{margin:0;padding:0;background:#F3F4F8;}table{border-collapse:collapse;}img{display:block;border:0;}a{color:#0C0F4C;}</style>
</head>
<body style="margin:0;padding:0;background:#F3F4F8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F8;">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;">
  <tr><td align="center" style="background:#0C0F4C;padding:28px 40px;">
    <a href="https://gingaglobalgroup.com" target="_blank" style="text-decoration:none;">
      <img src="${MAIN_LOGO}" width="180" alt="Ginga Global Group" style="width:180px;height:auto;margin:0 auto;">
    </a>
  </td></tr>
  <tr><td style="background:#C9A227;height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
  ${eyebrowHtml}
  <tr><td style="padding:${headingTopPad} 40px 0 40px;">
    <div style="font-family:'Poppins',Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;font-weight:700;color:#0C0F4C;">${opts.heading}</div>
  </td></tr>
  ${subheadingHtml}
  <tr><td style="padding:20px 40px 40px 40px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#2B2D42;">
    ${paragraphs}
  </td></tr>
  <tr><td align="center" style="background:#0C0F4C;padding:24px 40px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#ffffff;">
    <a href="https://gingaglobalgroup.com" target="_blank" style="text-decoration:none;">
      <img src="${G_LOGO}" width="40" alt="GGG" style="width:40px;height:auto;margin:0 auto 12px auto;">
    </a>
    <div style="font-family:'Poppins',Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2.5px;color:#C9A227;padding-bottom:8px;">GINGA GLOBAL GROUP</div>
    <a href="https://gingaglobalgroup.com" target="_blank" style="color:#ffffff;text-decoration:none;">gingaglobalgroup.com</a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="https://instagram.com/gingaglobalgroup" target="_blank" style="color:#ffffff;text-decoration:none;">Instagram</a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="https://facebook.com/gingaglobalgroup" target="_blank" style="color:#ffffff;text-decoration:none;">Facebook</a>
    <div style="padding-top:10px;font-size:11px;color:#A9ABC8;">&copy; ${year} Ginga Global Group. All rights reserved.</div>
    ${unsubHtml}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
