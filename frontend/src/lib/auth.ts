import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { jwt } from "better-auth/plugins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
      // requireLocalEmailVerified ko CHHEDNA MAT (default: true).
      // Isi ki wajah se sirf verified email wale local account par Google/GitHub
      // auto-link hota hai, aur "account pre-hijacking" attack rukta hai.
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  // requireEmailVerification: true hai, to verification link bhejne wala function zaroori hai.
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,              // unverified user login try kare to naya link bhejo
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // DEV: link terminal me print hota hai, use browser me kholo.
      // PRODUCTION: yahan Resend / Nodemailer / SES se asli email bhejo.
      console.log(`\n📧 VERIFY EMAIL for ${user.email}\n${url}\n`);
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_OAUTH_ID!,
      clientSecret: process.env.GOOGLE_OAUTH_SECRET!,
      prompt: "select_account",
    },

    github: {
      clientId: process.env.GITHUB_OAUTH_ID!,
      clientSecret: process.env.GITHUB_OAUTH_SECRET!,
    },
  },

  plugins: [jwt()],
});