import type { SiteConfig } from "@/features/config/site-config.schema";

export const blogConfig = {
  title: "小辉辉b的博客",
  author: "小辉辉b",
  description:
    "一只可爱的小猫咪的博客~",
  social: [
    { platform: "github", url: "https://github.com/xiaohuihuib" },
    { platform: "email", url: "mailto:xiaohuihuib@qq.com" },
    { platform: "bilibili", url: "https://space.bilibili.com/1378832819" },
    { platform: "rss", url: "/rss.xml" },
    {"platform":"custom","url":"https://www.ccw.site/student/66adb1d9fefe470607b03ce0","icon":"/images/asset/social/custom-4?v=1774446551","label":"CCW"}
  ],
  navLinks: [{"label":"状态","href":"https://up.xhhb.dpdns.org/"},{"label":"公告","href":"/posts?categoryName=%E5%85%AC%E5%91%8A"},{"label":"隐私协议","href":"/post/%E5%B0%8F%E8%BE%89%E8%BE%89b%E7%9A%84%E5%8D%9A%E5%AE%A2%E9%9A%90%E7%A7%81%E5%8D%8F%E8%AE%AE"},{"label":"投稿","href":"/post/%E5%85%AC%E5%91%8A%E6%88%91%E7%9A%84%E5%8D%9A%E5%AE%A2%E6%8A%95%E7%A8%BF%E9%80%9A%E9%81%93%E4%BB%8A%E5%A4%A9%E6%AD%A3%E5%BC%8F%E5%BC%80%E6%94%BE%E5%95%A6"}],
  icons: {
    faviconSvg: "/favicon.svg",
    faviconIco: "/favicon.ico",
    favicon96: "/favicon-96x96.png",
    appleTouchIcon: "/apple-touch-icon.png",
    webApp192: "/web-app-manifest-192x192.png",
    webApp512: "/web-app-manifest-512x512.png",
  },
  theme: {
    fuwari: {
      homeBg: "/images/home-bg.webp",
      avatar: "/images/avatar.png",
      primaryHue: 250,
    },
  },
} as const satisfies SiteConfig;
