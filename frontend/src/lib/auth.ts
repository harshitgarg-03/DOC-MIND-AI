import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma"; // your prisma client instance
import { jwt } from "better-auth/plugins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  account: {
		accountLinking: {
			enabled: true,
			// Only auto-link for providers that verify emails
			trustedProviders: ["google", "github", "microsoft"],
			// If you want stricter control:
			// disableImplicitLinking: true,
		}
	},
	// Additional protection: require email verification for auto-linking
	emailVerification: {
		requireEmailVerification: true, // Optional extra safety
		sendVerificationEmail: async ({ user, url }) => {
			// Your email sending logic
		},
	},

  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_OAUTH_ID as string,
      clientSecret: process.env.GOOGLE_OAUTH_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_OAUTH_ID as string,
      clientSecret: process.env.GITHUB_OAUTH_SECRET as string,
    }, 
  },

  plugins: [jwt()],
});
