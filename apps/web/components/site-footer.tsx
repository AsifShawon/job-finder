import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Linkedin, Mail, Phone, Youtube } from "lucide-react";

type SiteFooterProps = {
  locale: string;
};

const content = {
  bn: {
    newsletterTitle: "আমাদের সংবাদ আপডেট পেতে চান? আমাদের নিউজলেটারের জন্য সাইন আপ করুন।",
    newsletterPlaceholder: "আপনার ইমেইল লিখুন",
    newsletterButton: "সাবস্ক্রাইব করুন",
    about:
      "সুদক্ষ - আইটি, স্বাস্থ্যসেবা, নির্মাণ, কারিগরি শিক্ষা ও প্রবাসী কর্মসংস্থান নিয়ে কাজ করে এবং ইউটিউবে দক্ষতা উন্নয়নভিত্তিক প্রতিবেদন প্রকাশ করে।",
    socialTitle: "সোশ্যাল মিডিয়া প্ল্যাটফর্মে আমাদের অনুসরণ করুন",
    adTitle: "বিজ্ঞাপন",
    salesTitle: "বিক্রয়, সাবস্ক্রিপশন ও বিতরণ",
    phoneLabel: "ফোন",
    emailLabel: "ইমেইল",
    quickLinks: ["আমাদের সম্পর্কে", "যোগাযোগ করুন", "ক্যারিয়ার"],
    credit: "ফ্লিক বাংলাদেশ দ্বারা তৈরি",
    rights: "© ২০২৬ সুদক্ষ। সর্বস্বত্ব সংরক্ষিত।",
  },
  en: {
    newsletterTitle: "Want our news updates? Sign up for our newsletter.",
    newsletterPlaceholder: "Enter your email",
    newsletterButton: "Subscribe",
    about:
      "Sudokkho works on IT, healthcare, construction, technical education, and expatriate employment, and publishes skill-focused reports on YouTube.",
    socialTitle: "Follow us on our social media platforms",
    adTitle: "Advertisement",
    salesTitle: "Sales, Subscription & Distribution",
    phoneLabel: "Phone",
    emailLabel: "Email",
    quickLinks: ["About Us", "Contact", "Career"],
    credit: "Developed by Fleek Bangladesh",
    rights: "© 2026 Sudokkho. All rights reserved.",
  },
} as const;

export function SiteFooter({ locale }: SiteFooterProps) {
  const isBangla = locale.toLowerCase().startsWith("bn");
  const t = isBangla ? content.bn : content.en;

  return (
    <footer className="relative mt-12 text-white">
      <section className="bg-[radial-gradient(circle_at_20%_10%,#121212_0%,#050505_45%,#2d0006_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-16 text-center fade-up">
          <h2 className="mx-auto max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
            {t.newsletterTitle}
          </h2>
          <form className="mx-auto mt-7 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <label htmlFor="footer-newsletter-email" className="sr-only">
              Email
            </label>
            <input
              id="footer-newsletter-email"
              type="email"
              placeholder={t.newsletterPlaceholder}
              className="h-11 w-full rounded-md border border-white/15 bg-white/10 px-4 text-sm text-white placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
            />
            <button
              type="submit"
              className="h-11 rounded-md bg-primary px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t.newsletterButton}
            </button>
          </form>
        </div>
      </section>

      <section className="bg-[#061736]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-4 fade-up">
              <Link href="/" className="inline-flex items-center">
                <Image
                  src="/assets/images/sudokkho-logo.png"
                  alt="Sudokkho logo"
                  width={220}
                  height={74}
                  className="h-auto w-[180px] sm:w-[220px]"
                  priority={false}
                />
              </Link>
              <p className="max-w-xl text-sm leading-relaxed text-slate-200">{t.about}</p>

              <div className="space-y-1 text-sm text-slate-100">
                <p>
                  <span className="font-semibold">{t.phoneLabel}:</span> +8801897621274
                </p>
                <p className="pl-[4.4rem] sm:pl-[4.8rem]">+8801897621275</p>
                <p>
                  <span className="font-semibold">{t.emailLabel}:</span> info@sudokkho.xyz
                </p>
              </div>
            </div>

            <div className="fade-up" style={{ animationDelay: "90ms" }}>
              <h3 className="text-base font-semibold text-slate-100">{t.socialTitle}</h3>
              <div className="mt-4 flex items-center gap-4 text-slate-200">
                <Link href="#" aria-label="Facebook" className="hover:text-white transition-colors">
                  <Facebook className="h-5 w-5" />
                </Link>
                <Link href="#" aria-label="YouTube" className="hover:text-white transition-colors">
                  <Youtube className="h-5 w-5" />
                </Link>
                <Link href="#" aria-label="LinkedIn" className="hover:text-white transition-colors">
                  <Linkedin className="h-5 w-5" />
                </Link>
                <Link href="#" aria-label="Instagram" className="hover:text-white transition-colors">
                  <Instagram className="h-5 w-5" />
                </Link>
                <Link href="mailto:info@sudokkho.xyz" aria-label="Email" className="hover:text-white transition-colors">
                  <Mail className="h-5 w-5" />
                </Link>
              </div>

              <div className="mt-8 space-y-2 text-center lg:text-left">
                <p className="text-2xl font-semibold text-white">{t.adTitle}</p>
                <p className="inline-flex items-center gap-2 text-lg text-slate-100">
                  <Phone className="h-4 w-4" />
                  +8801897621274
                </p>
                <p className="text-2xl font-semibold text-white">{t.salesTitle}</p>
                <p className="text-lg text-slate-100">+8801897621275</p>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-white/15 pt-4 text-sm text-slate-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <nav className="flex flex-wrap items-center gap-4">
                <Link href="/" className="hover:text-white transition-colors">
                  {t.quickLinks[0]}
                </Link>
                <Link href="/" className="hover:text-white transition-colors">
                  {t.quickLinks[1]}
                </Link>
                <Link href="/" className="hover:text-white transition-colors">
                  {t.quickLinks[2]}
                </Link>
              </nav>
              <p>{t.credit}</p>
              <p>{t.rights}</p>
            </div>
          </div>
        </div>
      </section>
    </footer>
  );
}