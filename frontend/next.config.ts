import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/jira/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.atlassian.net https://*.jira.com;",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://*.atlassian.net",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
