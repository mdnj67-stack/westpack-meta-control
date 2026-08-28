const WESTPACK_UNIVERSAL_CONTENT = Object.freeze({
  header: { name: "Header - 2023", universalId: "dfdb43a7c0604849ac74c09f7919ae09" },
  footer: { name: "Footer - 2023", universalId: "3cf1619390714ca7a5d735fad6ad82d5" },
  logoUrl: "https://d3k81ch9hvuctc.cloudfront.net/company/VRPp5S/images/09b9808b-916c-4482-8701-db15e6db1d9a.png"
});

const SOCIAL_LINKS = Object.freeze([
  ["Instagram", "https://www.instagram.com/westpackdk/", "instagram"],
  ["YouTube", "https://www.youtube.com/channel/UCYZNm6OMwbZN42xK4iUi06A", "youtube"],
  ["Pinterest", "https://www.pinterest.com/WestpackCom/", "pinterest"],
  ["Facebook", "https://www.facebook.com/westpackdk/", "facebook"],
  ["LinkedIn", "https://www.linkedin.com/company/108849/", "linkedin"]
]);

function renderUniversalHeader({ isDanish = false } = {}) {
  const labels = isDanish
    ? { online: "Se mail online", inspiration: "Inspiration", blog: "Blog", sale: "Tilbud" }
    : { online: "View email online", inspiration: "Inspiration", blog: "Blog", sale: "Offers" };
  return `
          <!-- Locked Klaviyo universal content: ${WESTPACK_UNIVERSAL_CONTENT.header.name} -->
          <tr data-universal-content="${WESTPACK_UNIVERSAL_CONTENT.header.name}" data-universal-id="${WESTPACK_UNIVERSAL_CONTENT.header.universalId}">
            <td style="padding:0;background:#ffffff;border-top:2px solid #008764;border-bottom:2px solid #008764;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td align="center" style="padding:8px 18px 4px;font:11px/1.3 Arial,sans-serif;">
                  <a href="{% web_view_link %}" style="color:#606060;text-decoration:underline;">${labels.online}</a>
                </td></tr>
                <tr><td style="padding:8px 20px 18px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                    <td class="uc-logo" width="55%" valign="middle">
                      <a href="{{ organization.url }}" style="text-decoration:none;"><img src="${WESTPACK_UNIVERSAL_CONTENT.logoUrl}" width="160" alt="Westpack — When packaging matters" style="display:block;width:160px;max-width:100%;height:auto;border:0;"></a>
                    </td>
                    <td class="uc-nav" align="right" valign="middle" style="font:300 15px/1.2 Poppins,Helvetica,Arial,sans-serif;white-space:nowrap;">
                      <a href="{{ organization.url }}buy-the-whole-look.html" style="color:#333333;text-decoration:none;margin-left:20px;">${labels.inspiration}</a>
                      <a href="{{ organization.url }}blog" style="color:#333333;text-decoration:none;margin-left:20px;">${labels.blog}</a>
                      <a href="{{ organization.url }}sale.html" style="color:#333333;text-decoration:none;margin-left:20px;">${labels.sale}</a>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td>
          </tr>`;
}

function renderUniversalFooter({ isDanish = false } = {}) {
  const legal = isDanish
    ? { reservation: "Der tages forbehold for trykfejl og udsolgte varer.", fsc: "FSC® er miljømærket for ansvarligt skovbrug. www.fsc.org.", license: "Vores FSC licens nummer er FSC®C112509.", unsubscribe: "Afmeld nyhedsbreve fra Westpack" }
    : { reservation: "Subject to printing errors and sold-out items.", fsc: "FSC® is the label for responsible forestry. www.fsc.org.", license: "Our FSC licence number is FSC®C112509.", unsubscribe: "Unsubscribe from Westpack newsletters" };
  const icons = SOCIAL_LINKS.map(([label, href, icon]) => `
                    <td align="center" style="padding:0 2px;"><a href="${href}" aria-label="${label}" style="text-decoration:none;"><img src="https://d3k81ch9hvuctc.cloudfront.net/assets/email/buttons/subtle/${icon}_96.png" width="28" alt="${label}" style="display:block;width:28px;height:28px;border:0;"></a></td>`).join("");
  return `
          <!-- Locked Klaviyo universal content: ${WESTPACK_UNIVERSAL_CONTENT.footer.name} -->
          <tr data-universal-content="${WESTPACK_UNIVERSAL_CONTENT.footer.name}" data-universal-id="${WESTPACK_UNIVERSAL_CONTENT.footer.universalId}">
            <td style="padding:24px 28px 26px;background:#f4f4f4;border-top:2px solid #008764;border-bottom:2px solid #008764;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td align="center" style="padding:2px 0 14px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${icons}</tr></table></td></tr>
                <tr><td align="center" style="padding:0 0 14px;color:#727272;font:12px/1.6 Helvetica,Arial,sans-serif;">
                  <strong>Westpack A/S</strong> | Sletten 21, DK-7500 Holstebro<br>(+45) 7080 9333 &nbsp;|&nbsp; <span style="color:#24a95a;">(+45) 2488 8113</span> &nbsp;|&nbsp; sales@westpack.com
                </td></tr>
                <tr><td style="height:1px;background:#cccccc;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr><td align="center" style="padding:16px 0 0;color:#727272;font:12px/1.5 Helvetica,Arial,sans-serif;">
                  <p style="margin:0 0 9px;">${legal.reservation}</p><p style="margin:0 0 9px;">${legal.fsc}<br>${legal.license}</p><p style="margin:0;"><a href="{% unsubscribe_link %}" style="color:#727272;text-decoration:underline;">${legal.unsubscribe}</a></p>
                </td></tr>
              </table>
            </td>
          </tr>`;
}

function getUniversalContentStatus(html = "") {
  const value = String(html || "");
  return {
    header: value.includes(`data-universal-id="${WESTPACK_UNIVERSAL_CONTENT.header.universalId}"`),
    footer: value.includes(`data-universal-id="${WESTPACK_UNIVERSAL_CONTENT.footer.universalId}"`),
    webView: value.includes("{% web_view_link %}"),
    unsubscribe: value.includes("{% unsubscribe_link %}")
  };
}

module.exports = { WESTPACK_UNIVERSAL_CONTENT, getUniversalContentStatus, renderUniversalFooter, renderUniversalHeader };
