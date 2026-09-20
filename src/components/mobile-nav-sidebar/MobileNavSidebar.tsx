import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import React from "react";
import { t } from "@/utils/translation";
import Image from "next/image";
import { socialIconUrl } from "@/utils/socialIcon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiCloseFill } from "react-icons/ri";
import { useSelector } from "react-redux";
import { FaCaretDown } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import useZoneHref from "@/hooks/useZoneHref";

// `language` param mirrors the raw API language object shape (id/name/code) —
// no shared Language type exists yet in this codebase, kept as `any` at this
// genuinely-unknown-shape boundary.
interface MobileNavSidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  handleLanguageChange: (language: any) => void;
}

const MobileNavSidebar = ({ open, setOpen, handleLanguageChange }: MobileNavSidebarProps) => {
  const zoneHref = useZoneHref();
  const pathname = usePathname();
  const setting = useSelector((state: any) => state?.Setting?.setting);
  const language = useSelector((state: any) => state.Language);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        className="p-0 w-full sm:w-[900px]"
        side="left"
        aria-describedby={undefined}
      >
        <SheetHeader>
          <SheetTitle className="flex justify-between px-4 py-4 items-center border-b">
            <div className="w-36 h-9 relative">
              <Image
                src={setting?.web_settings?.web_logo}
                alt="mobileLogo"
                fill
                sizes="144px"
                priority
                className="object-contain"
              />
            </div>
            <SheetTrigger className="focus:outline-none closeButtonBg rounded-full p-[8px]">
              <RiCloseFill size={22} />
            </SheetTrigger>
          </SheetTitle>
        </SheetHeader>

        {/* Links Mobile Sidebar */}
        <div>
          <ul className="flex flex-col textColor text-base font-medium">
            <Link
              href={"/"}
              onClick={() => setOpen(false)}
              className={`p-4 text-start border-b border-dashed ${
                pathname === "/" ? "primaryColor" : ""
              }`}
            >
              <li>{t("home")}</li>
            </Link>
            <Link
              href={zoneHref("/categories/all")}
              onClick={() => setOpen(false)}
              className={`p-4 text-start border-b border-dashed ${
                pathname === "/categories/all" ? "primaryColor" : ""
              }`}
            >
              <li>{t("all_categories") || t("all_category")}</li>
            </Link>
            <Link
              href={zoneHref("/about-us")}
              onClick={() => setOpen(false)}
              className={`p-4 text-start border-b border-dashed ${
                pathname === "/about-us" ? "primaryColor" : ""
              }`}
            >
              <li>{t("about_us")}</li>
            </Link>
            <Link
              href={zoneHref("/faqs")}
              onClick={() => setOpen(false)}
              className={`p-4 text-start border-b border-dashed ${
                pathname === "/faqs" ? "primaryColor" : ""
              }`}
            >
              <li> {t("faq")}</li>
            </Link>
            <Link
              href={zoneHref("/contact-us")}
              onClick={() => setOpen(false)}
              className={`p-4 text-start border-b border-dashed ${
                pathname === "/contact-us" ? "primaryColor" : ""
              }`}
            >
              <li>{t("contact_us")}</li>
            </Link>
            <Link
              href={zoneHref("/blogs")}
              onClick={() => setOpen(false)}
              className={`p-4 text-start border-b border-dashed ${
                pathname === "/blogs" ? "primaryColor" : ""
              }`}
            >
              <li>{t("blogs")}</li>
            </Link>
          </ul>
        </div>

        {/* Follow Us Mobile Sidebar */}
        {setting?.social_media?.length > 0 && (
          <div className="p-4 flex flex-col gap-2">
            <div className="flex flex-col items-start">{t("follow_us")}</div>
            <div className="flex justify-center ">
              <ul className="flex justify-center gap-1 items-center h-12 w-full backgroundColor">
                {setting?.social_media &&
                  setting?.social_media?.slice(0, 7)?.map?.((social: any, index: number) => {
                    return (
                      <React.Fragment key={social?.id}>
                        <Link href={social?.link || "#"} target="_blank" rel="noopener noreferrer">
                          {/* Uploaded icons render as an image; icon-font
                              entries render the glyph. socialIconUrl() returns
                              "" for the latter — their icon_url exists but does
                              not point at an image. */}
                          {socialIconUrl(social) ? (
                            <Image
                              src={socialIconUrl(social)}
                              alt=""
                              width={16}
                              height={16}
                              className="h-4 w-4 object-contain"
                            />
                          ) : social?.icon?.toLowerCase().includes("wechat") ? (
                            <i className="fab fa-weixin"></i>
                          ) : social?.icon?.toLowerCase().includes("twitter") ? (
                            <FaXTwitter
                              className={`${social?.icon} text-gray-400`}
                            />
                          ) : (
                            <i className={`${social?.icon} text-gray-400`}></i>
                          )}
                        </Link>
                        <span className="border-l border-gray-200 h-6 last:hidden mx-2"></span>
                      </React.Fragment>
                    );
                  })}
              </ul>
            </div>
          </div>
        )}

        {/* Language Mobile Sidebar */}
        <div className="p-4 w-full flex justify-center ">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full rounded cardBorder border text-base textColor p-4 flex items-center gap-2 group justify-between">
              <div className="font-medium">
                {language?.selectedLanguage
                  ? language?.selectedLanguage?.name
                  : "English"}
              </div>
              <div>
                <FaCaretDown className="transition-transform duration-300 ease-in-out group-data-[state=open]:-rotate-180" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[min(285px,90vw)] transition-all duration-300 ease-in-out">
              {language?.availableLanguages &&
                language?.availableLanguages?.map((language: any) => {
                  return (
                    <DropdownMenuItem
                      key={language?.id}
                      onSelect={() => handleLanguageChange(language)}
                      className="text-base textColor"
                    >
                      {language?.name}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNavSidebar;
