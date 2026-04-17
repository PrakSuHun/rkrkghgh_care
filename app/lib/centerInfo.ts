export const CENTER_INFO = {
  name: process.env.CENTER_NAME || "가가호호노인복지센터",
  head: process.env.CENTER_HEAD || "박현식",
  address: process.env.CENTER_ADDRESS || "-",
  phone: process.env.CENTER_PHONE || "-",
  code: process.env.CENTER_CODE || "33011000246",
  socialWorkers: (process.env.CENTER_SOCIAL_WORKERS || "권오성,봉현옥").split(",").map((s) => s.trim()).filter(Boolean),
};
