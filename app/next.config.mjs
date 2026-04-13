const isVercel = !!process.env.VERCEL;

const config = isVercel
  ? {}
  : {
      distDir: "/tmp/care-next",
      experimental: {
        turbopackFileSystemCacheForDev: false,
      },
    };

export default config;
