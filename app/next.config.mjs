const isVercel = !!process.env.VERCEL;

const config = {
  ...(isVercel ? {} : { distDir: "/tmp/care-next" }),
};

export default config;
